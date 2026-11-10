-- Phase 2 foundation: durable drafts, post audience/interaction controls,
-- and reversible archive/trash state. Existing post rows remain public,
-- commentable, likable, and active by default.

alter table public.posts
  add column if not exists visibility text not null default 'public',
  add column if not exists allow_comments boolean not null default true,
  add column if not exists allow_likes boolean not null default true,
  add column if not exists hide_like_count boolean not null default false,
  add column if not exists allow_sharing boolean not null default true,
  add column if not exists is_published boolean not null default true,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.posts'::regclass and conname = 'posts_visibility_check'
  ) then
    alter table public.posts add constraint posts_visibility_check
      check (visibility in ('public', 'private'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.posts'::regclass and conname = 'posts_lifecycle_exclusive_check'
  ) then
    alter table public.posts add constraint posts_lifecycle_exclusive_check
      check (archived_at is null or deleted_at is null);
  end if;
end;
$$;

create index if not exists posts_public_feed_idx
  on public.posts (created_at desc, id desc)
  where archived_at is null and deleted_at is null and visibility = 'public';
create index if not exists posts_owner_lifecycle_idx
  on public.posts (author_id, archived_at, deleted_at, created_at desc);

create or replace function public.maintain_post_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    new.archived_at := null;
    if tg_op = 'INSERT' or old.deleted_at is null then
      new.delete_expires_at := now() + interval '30 days';
    else
      new.delete_expires_at := old.delete_expires_at;
    end if;
  else
    new.delete_expires_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.maintain_post_lifecycle() from public, anon, authenticated;
drop trigger if exists maintain_post_lifecycle_before_write on public.posts;
create trigger maintain_post_lifecycle_before_write
  before insert or update of archived_at, deleted_at, delete_expires_at on public.posts
  for each row execute function public.maintain_post_lifecycle();

create table if not exists public.post_drafts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  allow_comments boolean not null default true,
  allow_likes boolean not null default true,
  hide_like_count boolean not null default false,
  allow_sharing boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  position integer not null default 0 check (position between 0 and 9),
  alt_text text not null default '' check (char_length(alt_text) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.post_draft_media (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.post_drafts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  object_path text not null unique,
  media_type text not null check (media_type in ('image', 'video')),
  position integer not null default 0 check (position between 0 and 9),
  alt_text text not null default '' check (char_length(alt_text) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists post_drafts_owner_updated_idx
  on public.post_drafts (author_id, updated_at desc);
create index if not exists post_media_post_position_idx
  on public.post_media (post_id, position);
create index if not exists post_draft_media_owner_idx
  on public.post_draft_media (draft_id, author_id, position);

alter table public.post_drafts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_draft_media enable row level security;
revoke all on public.post_drafts from public, anon;
revoke all on public.post_media from public, anon;
revoke all on public.post_draft_media from public, anon;
grant select, insert, update, delete on public.post_drafts to authenticated;
grant select on public.post_media to anon, authenticated;
grant insert, update, delete on public.post_media to authenticated;
grant select, insert, update, delete on public.post_draft_media to authenticated;
grant all on public.post_drafts to service_role;
grant all on public.post_media to service_role;
grant all on public.post_draft_media to service_role;

drop policy if exists "Users manage own post drafts" on public.post_drafts;
create policy "Users manage own post drafts" on public.post_drafts for all to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "View media for visible posts" on public.post_media;
create policy "View media for visible posts" on public.post_media for select
  using (exists (select 1 from public.posts p where p.id = post_id));

drop policy if exists "Post owners manage their media" on public.post_media;
create policy "Post owners manage their media" on public.post_media for all to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and split_part(object_path, '/', 1) = (select auth.uid())::text
    and exists (
      select 1 from public.posts p
      where p.id = post_id and p.author_id = (select auth.uid())
    )
  );

drop policy if exists "Users manage media on own drafts" on public.post_draft_media;
create policy "Users manage media on own drafts" on public.post_draft_media for all to authenticated
  using (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.post_drafts d
      where d.id = draft_id and d.author_id = (select auth.uid())
    )
  )
  with check (
    author_id = (select auth.uid())
    and split_part(object_path, '/', 1) = (select auth.uid())::text
    and split_part(object_path, '/', 2) = draft_id::text
    and exists (
      select 1 from public.post_drafts d
      where d.id = draft_id and d.author_id = (select auth.uid())
    )
  );

drop policy if exists "Visible posts" on public.posts;
create policy "Visible posts" on public.posts for select
  using (
    (
      author_id = (select auth.uid())
      and (deleted_at is null or delete_expires_at > now())
    )
    or (
      visibility = 'public'
      and is_published
      and archived_at is null
      and deleted_at is null
      and (delete_expires_at is null or delete_expires_at > now())
      and exists (
        select 1 from public.profiles p
        where p.id = author_id and not p.is_private
      )
    )
  );

drop policy if exists "Publish own posts" on public.posts;
create policy "Publish own posts" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));

drop policy if exists "Edit own posts" on public.posts;
create policy "Edit own posts" on public.posts for update to authenticated
  using (
    author_id = (select auth.uid())
    and (deleted_at is null or delete_expires_at > now())
  )
  with check (author_id = (select auth.uid()));

drop policy if exists "Delete own posts" on public.posts;
create policy "Delete own posts" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "Visible likes" on public.likes;
create policy "Visible likes" on public.likes for select
  using (exists (
    select 1 from public.posts p
    where p.id = post_id
      and (not p.hide_like_count or p.author_id = (select auth.uid()) or user_id = (select auth.uid()))
  ));

drop policy if exists "Like visible posts" on public.likes;
create policy "Like visible posts" on public.likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.allow_likes)
  );

drop policy if exists "Comment on visible posts" on public.comments;
create policy "Comment on visible posts" on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id and p.allow_comments)
    and (parent_id is null or exists (
      select 1 from public.comments c where c.id = parent_id and c.post_id = post_id
    ))
  );

comment on column public.posts.visibility is 'Public, followers-only, or owner-only. Approved follower access is enforced by RLS.';
comment on column public.posts.delete_expires_at is 'Trash recovery deadline; rows are hidden after expiry and should be purged by the scheduled cleanup job.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', false, 104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Read media attached to visible posts" on storage.objects;
create policy "Read media attached to visible posts" on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'post-media'
    and exists (
      select 1 from public.post_media pm
      where pm.object_path = name
    )
  );

drop policy if exists "Read media in own post drafts" on storage.objects;
create policy "Read media in own post drafts" on storage.objects for select to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.post_draft_media dm
      join public.post_drafts d on d.id = dm.draft_id
      where dm.object_path = name
        and dm.author_id = (select auth.uid())
        and d.author_id = (select auth.uid())
    )
  );

drop policy if exists "Upload media to own post drafts" on storage.objects;
create policy "Upload media to own post drafts" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.post_drafts d
      where d.id::text = (storage.foldername(name))[2]
        and d.author_id = (select auth.uid())
    )
  );

drop policy if exists "Delete media attached to own posts or drafts" on storage.objects;
create policy "Delete media attached to own posts or drafts" on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (
      exists (
        select 1 from public.post_drafts d
        where d.id::text = (storage.foldername(name))[2]
          and d.author_id = (select auth.uid())
      )
      or
      exists (select 1 from public.post_draft_media dm where dm.object_path = name and dm.author_id = (select auth.uid()))
      or exists (select 1 from public.post_media pm where pm.object_path = name and pm.author_id = (select auth.uid()))
    )
  );

create extension if not exists pg_cron;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'velori-purge-expired-posts') then
    perform cron.schedule(
      'velori-purge-expired-posts',
      '15 3 * * *',
      'delete from public.posts where deleted_at is not null and delete_expires_at <= now()'
    );
  end if;
  if not exists (select 1 from cron.job where jobname = 'velori-purge-expired-posts') then
    raise exception 'VELORI trash expiration job was not installed.';
  end if;
end;
$$;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.post_drafts'::regclass) then
    raise exception 'RLS must remain enabled on public.post_drafts.';
  end if;
  if not has_table_privilege('authenticated', 'public.post_drafts', 'select')
     or not has_table_privilege('authenticated', 'public.post_drafts', 'insert')
     or not has_table_privilege('authenticated', 'public.post_drafts', 'update')
     or not has_table_privilege('authenticated', 'public.post_drafts', 'delete') then
    raise exception 'Authenticated users are missing the expected post-draft table grants.';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_drafts'
      and policyname = 'Users manage own post drafts'
  ) then
    raise exception 'The post-draft ownership policy is missing.';
  end if;
  if not exists (select 1 from storage.buckets where id = 'profile-avatars' and public) then
    raise exception 'The public profile avatar bucket is missing.';
  end if;
  if not exists (select 1 from storage.buckets where id = 'post-media' and not public) then
    raise exception 'The private post-media bucket is missing.';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.post_media'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.post_draft_media'::regclass) then
    raise exception 'RLS must remain enabled on both post media relations.';
  end if;
end;
$$;
