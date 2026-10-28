-- Make publication depend on an uploaded private MP4 and record authenticated
-- reel views once per viewer per calendar day.

create table if not exists public.reel_views (
  reel_id uuid not null references public.reels(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_on date not null default (now() at time zone 'utc')::date,
  created_at timestamptz not null default now(),
  primary key (reel_id, viewer_id, viewed_on)
);

create index if not exists reel_views_owner_day_idx
  on public.reel_views (reel_id, viewed_on desc);

alter table public.reel_media
  add column if not exists duration_seconds numeric(10,3),
  add column if not exists processing_state text not null default 'ready';
alter table public.reel_media
  drop constraint if exists reel_media_processing_state_check;
alter table public.reel_media
  add constraint reel_media_processing_state_check
  check (processing_state in ('uploading', 'uploaded', 'ready', 'failed'));

drop policy if exists "Authors manage reel media" on public.reel_media;
drop policy if exists "Public reads reel media" on public.reel_media;
drop policy if exists "Authors read own reel media" on public.reel_media;
drop policy if exists "Authors insert reel media" on public.reel_media;
drop policy if exists "Authors update unready reel media" on public.reel_media;
drop policy if exists "Authors delete own reel media" on public.reel_media;
create policy "Authors read own reel media" on public.reel_media
  for select to authenticated
  using (exists (
    select 1 from public.reels reel
     where reel.id = reel_media.reel_id
       and reel.author_id = (select auth.uid())
  ));
create policy "Authors insert reel media" on public.reel_media
  for insert to authenticated
  with check (
    processing_state = 'uploading'
    and exists (
      select 1 from public.reels reel
       where reel.id = reel_media.reel_id
         and reel.author_id = (select auth.uid())
    )
  );
create policy "Authors update unready reel media" on public.reel_media
  for update to authenticated
  using (
    processing_state in ('uploading', 'uploaded')
    and exists (
      select 1 from public.reels reel
       where reel.id = reel_media.reel_id
         and reel.author_id = (select auth.uid())
    )
  )
  with check (
    processing_state in ('uploading', 'uploaded')
    and exists (
      select 1 from public.reels reel
       where reel.id = reel_media.reel_id
         and reel.author_id = (select auth.uid())
    )
  );
create policy "Authors delete own reel media" on public.reel_media
  for delete to authenticated
  using (exists (
    select 1 from public.reels reel
     where reel.id = reel_media.reel_id
       and reel.author_id = (select auth.uid())
  ));

alter table public.reel_views enable row level security;
revoke all on public.reel_views from public, anon, authenticated;
grant select on public.reel_views to authenticated;

drop policy if exists "Authors see reel views" on public.reel_views;
create policy "Authors see reel views" on public.reel_views
  for select to authenticated
  using (exists (
    select 1 from public.reels reel
     where reel.id = reel_views.reel_id
       and reel.author_id = (select auth.uid())
  ));

create or replace function public.record_reel_view(p_reel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  reel public.reels%rowtype;
  allowed boolean := false;
begin
  if viewer is null then return false; end if;

  select * into reel
    from public.reels candidate
   where candidate.id = p_reel_id
     and candidate.status = 'published'
     and not candidate.is_deleted
     and candidate.moderation_state = 'clean'
     and (candidate.expires_at is null or candidate.expires_at > now());
  if not found then return false; end if;

  if reel.author_id = viewer then
    allowed := true;
  elsif public.viewer_can_see(viewer, reel.author_id) then
    if reel.visibility = 'public' then
      select (not profile.is_private or exists (
        select 1 from public.follows follow
         where follow.follower_id = viewer
           and follow.following_id = reel.author_id
           and follow.status = 'accepted'
      )) into allowed
      from public.profiles profile
      where profile.id = reel.author_id;
    elsif reel.visibility = 'followers' then
      select exists (
        select 1 from public.follows follow
         where follow.follower_id = viewer
           and follow.following_id = reel.author_id
           and follow.status = 'accepted'
      ) into allowed;
    end if;
  end if;

  if not coalesce(allowed, false) then return false; end if;

  insert into public.reel_views (reel_id, viewer_id)
  values (p_reel_id, viewer)
  on conflict do nothing;
  return found;
end;
$$;

revoke all on function public.record_reel_view(uuid) from public, anon;
grant execute on function public.record_reel_view(uuid) to authenticated;

create or replace function public.delete_own_reel(p_reel_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null then
    raise exception 'Sign in to delete a Reel.' using errcode = '42501';
  end if;

  perform 1 from public.reels reel
   where reel.id = p_reel_id and reel.author_id = viewer
   for update;
  if not found then return false; end if;

  insert into public.storage_cleanup_queue (bucket_id, object_path)
  select 'reel-media', media.object_path
    from public.reel_media media
   where media.reel_id = p_reel_id
     and media.object_path <> ''
     and (storage.foldername(media.object_path))[1] = viewer::text
  on conflict (bucket_id, object_path) do nothing;

  delete from public.reels reel
   where reel.id = p_reel_id and reel.author_id = viewer;
  return found;
end;
$$;

revoke all on function public.delete_own_reel(uuid) from public, anon;
grant execute on function public.delete_own_reel(uuid) to authenticated;

create or replace function public.guard_reel_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  verify_upload boolean := false;
begin
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      verify_upload := true;
    else
      verify_upload := old.status <> 'published';
    end if;
  end if;

  if verify_upload then
    if not exists (
      select 1
        from public.reel_media media
        join storage.objects storage_object
          on storage_object.bucket_id = 'reel-media'
         and storage_object.name = media.object_path
       where media.reel_id = new.id
         and media.media_type = 'video'
         and media.mime_type = 'video/mp4'
         and media.processing_state in ('uploaded', 'ready')
         and media.byte_size between 1 and 104857600
         and media.duration_seconds > 0
         and media.duration_seconds <= 600
         and media.width > 0
         and media.height > 0
         and media.object_path <> ''
         and (storage.foldername(media.object_path))[1] = new.author_id::text
    ) then
      raise exception 'Upload a valid Reel MP4 before publishing.' using errcode = '23514';
    end if;
    update public.reel_media media
       set processing_state = 'ready'
     where media.reel_id = new.id
       and media.media_type = 'video'
       and media.processing_state = 'uploaded'
       and exists (
         select 1 from storage.objects storage_object
          where storage_object.bucket_id = 'reel-media'
            and storage_object.name = media.object_path
       );
    new.published_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.guard_reel_publication() from public, anon, authenticated;
drop trigger if exists reels_guard_publication on public.reels;
create trigger reels_guard_publication
  before insert or update on public.reels
  for each row execute function public.guard_reel_publication();

notify pgrst, 'reload schema';
