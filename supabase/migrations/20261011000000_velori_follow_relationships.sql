-- Phase 3 application contract for the follow graph created by migration 090.
-- Extend that table in place; never create a second or conflicting graph.

alter table public.follows
  add column if not exists updated_at timestamptz not null default now();

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility in ('public', 'followers', 'private'));

alter table public.post_drafts drop constraint if exists post_drafts_visibility_check;
alter table public.post_drafts add constraint post_drafts_visibility_check
  check (visibility in ('public', 'followers', 'private'));

create index if not exists follows_incoming_request_idx
  on public.follows (following_id, created_at desc) where status = 'pending';

alter table public.follows enable row level security;
revoke all on public.follows from public, anon;
grant select, insert, update, delete on public.follows to authenticated;
grant all on public.follows to service_role;

-- Replace migration 090's permissive policies. PostgreSQL combines permissive
-- policies with OR, so leaving the old policy names in place would defeat the
-- tighter pending-request visibility and acceptance rules below.
drop policy if exists "Read visible follows" on public.follows;
drop policy if exists "Request follow" on public.follows;
drop policy if exists "Respond to follow request" on public.follows;
drop policy if exists "Remove own follow" on public.follows;
drop policy if exists "Read relevant follow relationships" on public.follows;
drop policy if exists "Request follows as self" on public.follows;
drop policy if exists "Accept incoming follow requests" on public.follows;
drop policy if exists "Remove own follow relationship" on public.follows;

create policy "Read relevant follow relationships" on public.follows for select to authenticated
  using (
    follower_id = (select auth.uid())
    or following_id = (select auth.uid())
  );

create policy "Accept incoming follow requests" on public.follows for update to authenticated
  using (following_id = (select auth.uid()) and status = 'pending')
  with check (following_id = (select auth.uid()) and status = 'accepted');

create policy "Remove own follow relationship" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

create or replace function public.protect_follow_relationship()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.follower_id <> old.follower_id
       or new.following_id <> old.following_id
       or old.status <> 'pending'
       or new.status <> 'accepted'
      or old.following_id <> auth.uid()
      or not private.viewer_not_blocked(new.follower_id) then
      raise exception 'Only the profile owner can accept an incoming follow request.'
        using errcode = '42501';
    end if;
    new.responded_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.protect_follow_relationship() from public, anon, authenticated;

-- SECURITY DEFINER helpers avoid recursive RLS lookups while enforcing the
-- social graph and bilateral blocks inside policies on posts and profiles.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.viewer_not_blocked(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (select 1 from public.profiles p where p.id = owner)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = owner)
         or (b.blocker_id = owner and b.blocked_id = auth.uid())
    );
$$;

create or replace function private.viewer_follows_profile(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.viewer_not_blocked(owner)
    and exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = owner
        and f.status = 'accepted'
    );
$$;

-- The original helper accepted an arbitrary viewer UUID, which let any signed-in
-- user probe another pair's block/follow visibility. Bind it to the JWT identity.
create or replace function public.viewer_can_see(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer = auth.uid()
    and viewer is not null
    and (
      viewer = owner
      or (
        private.viewer_not_blocked(owner)
        and (
          exists (select 1 from public.profiles p where p.id = owner and not p.is_private)
          or exists (
            select 1 from public.follows f
            where f.follower_id = viewer and f.following_id = owner and f.status = 'accepted'
          )
          or exists (
            select 1 from public.follows f
            where f.follower_id = owner and f.following_id = viewer and f.status = 'accepted'
          )
        )
      )
    );
$$;

revoke all on function public.viewer_can_see(uuid, uuid) from public, anon;
revoke all on function private.viewer_not_blocked(uuid) from public;
revoke all on function private.viewer_follows_profile(uuid) from public;
grant execute on function public.viewer_can_see(uuid, uuid) to authenticated;
grant execute on function private.viewer_not_blocked(uuid) to anon, authenticated;
grant execute on function private.viewer_follows_profile(uuid) to anon, authenticated;

drop trigger if exists protect_follow_relationship_before_write on public.follows;
create trigger protect_follow_relationship_before_write
  before insert or update on public.follows
  for each row execute function public.protect_follow_relationship();

drop policy if exists "Request follows as self" on public.follows;
create policy "Request follows as self" on public.follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and follower_id <> following_id
    and private.viewer_not_blocked(following_id)
    and status = case
      when exists (
        select 1 from public.profiles target
        where target.id = following_id and target.is_private
      ) then 'pending'
      else 'accepted'
    end
  );

-- A signed-in member may see the discoverable profile header for a private
-- account unless either account has blocked the other; protected details and
-- posts remain subject to their own policies.
drop policy if exists "Public profiles or self" on public.profiles;
create policy "Public profiles or self" on public.profiles for select
  using (
    id = (select auth.uid())
    or (
      (select auth.uid()) is null and not is_private
    )
    or private.viewer_not_blocked(id)
  );

drop policy if exists "Visible posts" on public.posts;
create policy "Visible posts" on public.posts for select
  using (
    (
      author_id = (select auth.uid())
      and (deleted_at is null or delete_expires_at > now())
    )
    or (
      is_published
      and archived_at is null
      and deleted_at is null
      and (delete_expires_at is null or delete_expires_at > now())
      and exists (
        select 1 from public.profiles owner
        where owner.id = author_id
          and (
            (
              visibility = 'public'
              and (
                (not owner.is_private and (
                  (select auth.uid()) is null
                  or private.viewer_not_blocked(author_id)
                ))
                or private.viewer_follows_profile(author_id)
              )
            )
            or (
              visibility = 'followers'
              and private.viewer_follows_profile(author_id)
            )
          )
      )
    )
  );

create or replace function public.profile_follow_counts(target_profile_id uuid)
returns table (followers_count bigint, following_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_is_private boolean;
begin
  select p.is_private into target_is_private
  from public.profiles p where p.id = target_profile_id;
  if not found then
    return;
  end if;
  if target_is_private
     and target_profile_id is distinct from auth.uid()
     and not private.viewer_follows_profile(target_profile_id) then
    return query select null::bigint, null::bigint;
    return;
  end if;
  return query
    select
      (select count(*) from public.follows f where f.following_id = target_profile_id and f.status = 'accepted'),
      (select count(*) from public.follows f where f.follower_id = target_profile_id and f.status = 'accepted');
end;
$$;

revoke all on function public.profile_follow_counts(uuid) from public;
grant execute on function public.profile_follow_counts(uuid) to anon, authenticated;

comment on function public.profile_follow_counts(uuid) is 'Returns accepted relationship counts for public profiles; private counts are visible only to the owner and accepted followers.';

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.follows'::regclass) then
    raise exception 'RLS must remain enabled on public.follows.';
  end if;
  if not has_table_privilege('authenticated', 'public.follows', 'select')
     or not has_table_privilege('authenticated', 'public.follows', 'insert')
     or not has_table_privilege('authenticated', 'public.follows', 'update')
     or not has_table_privilege('authenticated', 'public.follows', 'delete') then
    raise exception 'Authenticated users are missing expected follow relationship grants.';
  end if;
  if not has_function_privilege('anon', 'public.profile_follow_counts(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.profile_follow_counts(uuid)', 'execute') then
    raise exception 'The profile follow-count RPC grants are missing.';
  end if;
end;
$$;
