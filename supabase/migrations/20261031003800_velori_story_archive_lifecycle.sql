-- Preserve published Stories in a private owner archive after expiration.
-- Staged media rows use status=archived too; published_at distinguishes those
-- uploads from actual archive entries.

alter table public.story_settings
  add column if not exists save_to_archive boolean not null default true;

alter table public.stories
  add column if not exists published_at timestamptz,
  add column if not exists archived_at timestamptz;

update public.stories
   set published_at = created_at
 where published_at is null
   and status <> 'archived';

create index if not exists stories_owner_archive_idx
  on public.stories (author_id, archived_at desc, created_at desc)
  where status = 'archived' and published_at is not null;

create or replace function public.prepare_story_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lifetime_minutes integer;
  verify_asset boolean := false;
begin
  if tg_op = 'INSERT' then
    select settings.auto_expire_minutes
      into lifetime_minutes
      from public.story_settings settings
     where settings.author_id = new.author_id;

    new.expires_at := now() + make_interval(mins => coalesce(lifetime_minutes, 1440));
    if new.status = 'active' then
      new.published_at := now();
    else
      new.published_at := null;
    end if;
    new.archived_at := null;
  else
    -- Expiration is assigned from database time on insert and cannot be moved
    -- forward or backward later by a browser client.
    new.expires_at := old.expires_at;
    new.published_at := old.published_at;
    new.archived_at := old.archived_at;

    if new.status = 'archived' and old.status = 'active' then
      if old.expires_at > now() then
        raise exception 'A Story can be archived after it expires.' using errcode = '22023';
      end if;
      new.archived_at := coalesce(old.archived_at, old.expires_at);
    elsif new.status = 'active' and old.status = 'archived' then
      if old.published_at is not null then
        raise exception 'An archived Story cannot be republished.' using errcode = '22023';
      end if;
      new.published_at := now();
      new.archived_at := null;
    end if;
  end if;

  -- Media Stories are staged as archived while their private Storage object is
  -- uploaded. They become active only after both the metadata row and bytes
  -- exist under the author's own folder.
  if new.status = 'active' and new.media_type <> 'text' then
    if tg_op = 'INSERT' then
      verify_asset := true;
    else
      verify_asset := old.status <> 'active';
    end if;

    if verify_asset and not exists (
         select 1
           from public.story_media media
         join storage.objects storage_object
             on storage_object.bucket_id = 'story-media'
            and storage_object.name = media.object_path
          where media.story_id = new.id
            and media.media_type = new.media_type
            and media.object_path <> ''
            and (storage.foldername(media.object_path))[1] = new.author_id::text
       ) then
      raise exception 'Upload the Story media before publishing.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_story_lifecycle() from public, anon, authenticated;
drop trigger if exists stories_prepare_lifecycle on public.stories;
create trigger stories_prepare_lifecycle
  before insert or update
  on public.stories
  for each row
  execute function public.prepare_story_lifecycle();

create or replace function public.archive_my_expired_stories()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  archived_count integer;
  viewer uuid := auth.uid();
begin
  if viewer is null then
    raise exception 'Sign in to view your Story archive.' using errcode = '42501';
  end if;

  update public.stories story
     set status = 'archived', archived_at = story.expires_at
   where story.author_id = viewer
     and story.status = 'active'
     and story.published_at is not null
     and story.expires_at <= now()
     and coalesce((
       select settings.save_to_archive
         from public.story_settings settings
        where settings.author_id = viewer
     ), true);
  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;

revoke all on function public.archive_my_expired_stories() from public, anon;
grant execute on function public.archive_my_expired_stories() to authenticated;

create or replace function public.delete_own_story(p_story_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null then
    raise exception 'Sign in to delete a Story.' using errcode = '42501';
  end if;

  perform 1
    from public.stories story
   where story.id = p_story_id
     and story.author_id = viewer
   for update;
  if not found then
    return false;
  end if;

  -- Queue bytes and remove metadata in one database transaction. The worker
  -- deletes the private Storage objects asynchronously and retries failures.
  insert into public.storage_cleanup_queue (bucket_id, object_path)
  select 'story-media', media.object_path
    from public.story_media media
   where media.story_id = p_story_id
     and media.object_path <> ''
     and (storage.foldername(media.object_path))[1] = viewer::text
  on conflict (bucket_id, object_path) do nothing;

  delete from public.stories story
   where story.id = p_story_id
     and story.author_id = viewer;
  return found;
end;
$$;

revoke all on function public.delete_own_story(uuid) from public, anon;
grant execute on function public.delete_own_story(uuid) to authenticated;

create or replace function public.cleanup_expired_stories()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  update public.stories story
     set status = 'archived', archived_at = story.expires_at
   where story.status = 'active'
     and story.published_at is not null
     and story.expires_at <= now()
     and coalesce((
       select settings.save_to_archive
         from public.story_settings settings
        where settings.author_id = story.author_id
     ), true);

  insert into public.storage_cleanup_queue (bucket_id, object_path)
  select 'story-media', media.object_path
    from public.story_media media
    join public.stories story on story.id = media.story_id
   where story.expires_at <= now()
     and (story.status <> 'archived' or story.published_at is null)
     and media.object_path <> ''
     and (storage.foldername(media.object_path))[1] = story.author_id::text
  on conflict (bucket_id, object_path) do nothing;

  delete from public.stories story
   where story.expires_at <= now()
     and (story.status <> 'archived' or story.published_at is null);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.cleanup_expired_stories() from public, anon, authenticated;
grant execute on function public.cleanup_expired_stories() to service_role;

comment on column public.stories.published_at is
  'Database-assigned publication time; NULL distinguishes an unpublished staged media upload from an archived Story.';
comment on column public.stories.archived_at is
  'Database-assigned time an expired Story entered its owner-only archive.';

notify pgrst, 'reload schema';
