-- Centralize private-profile visibility in the existing profile/settings/follow
-- model. Private profiles are no longer readable as complete rows by visitors.

alter table public.account_settings
  add column if not exists followers_visibility text not null default 'followers'
    check (followers_visibility in ('everyone', 'followers', 'only_me')),
  add column if not exists following_visibility text not null default 'followers'
    check (following_visibility in ('everyone', 'followers', 'only_me')),
  add column if not exists show_follower_count boolean not null default true,
  add column if not exists show_following_count boolean not null default true,
  add column if not exists show_bio boolean not null default true,
  add column if not exists show_avatar boolean not null default true,
  add column if not exists show_website boolean not null default false,
  add column if not exists show_account_type boolean not null default true;

create or replace function private.viewer_is_approved_follower(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and auth.uid() <> owner
    and private.viewer_not_blocked(owner)
    and exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = owner
        and f.status = 'accepted'
    );
$$;

create or replace function private.viewer_can_view_profile(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = owner
      and (
        p.id = auth.uid()
        or (
          (auth.uid() is null and not p.is_private)
          or (
            auth.uid() is not null
            and private.viewer_not_blocked(owner)
            and (not p.is_private or private.viewer_is_approved_follower(owner))
          )
        )
      )
  );
$$;

-- Keep the historical public helper signature for existing RLS policies, but
-- bind it to the caller and require the caller to follow the target.
create or replace function public.viewer_can_see(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer = auth.uid()
    and viewer is not null
    and private.viewer_can_view_profile(owner);
$$;

revoke all on function private.viewer_is_approved_follower(uuid) from public;
revoke all on function private.viewer_can_view_profile(uuid) from public;
grant execute on function private.viewer_is_approved_follower(uuid) to anon, authenticated;
grant execute on function private.viewer_can_view_profile(uuid) to anon, authenticated;
revoke all on function public.viewer_can_see(uuid, uuid) from public, anon;
grant execute on function public.viewer_can_see(uuid, uuid) to authenticated;

drop policy if exists "Public profiles or self" on public.profiles;
create policy "Readable profiles only" on public.profiles for select
  using (
    id = (select auth.uid())
    or (
      (select auth.uid()) is null and not is_private
    )
    or (
      (select auth.uid()) is not null
      and private.viewer_not_blocked(id)
      and (not is_private or private.viewer_is_approved_follower(id))
    )
  );

-- A discoverable profile preview only returns fields the owner has elected to
-- show. Private details are returned only to the owner or approved followers.
create or replace function public.profile_discovery_by_username(p_username text)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  is_private boolean,
  website_url text,
  link_title text,
  account_type text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         p.username,
         p.display_name,
         case when allowed.full_profile or coalesce(s.show_bio, true) then p.bio else '' end,
         case when allowed.full_profile or coalesce(s.show_avatar, true) then p.avatar_url else null end,
         p.is_private,
         case when allowed.full_profile or coalesce(s.show_website, false) then p.website_url else null end,
         case when allowed.full_profile or coalesce(s.show_website, false) then p.link_title else null end,
         case when allowed.full_profile or coalesce(s.show_account_type, true) then p.account_type::text else null end
    from public.profiles p
    left join public.account_settings s on s.profile_id = p.id
    cross join lateral (
      select p.id = auth.uid()
        or (
          auth.uid() is not null
          and private.viewer_not_blocked(p.id)
          and (not p.is_private or private.viewer_is_approved_follower(p.id))
        ) as full_profile
    ) allowed
   where lower(p.username) = lower(trim(p_username))
     and (
       allowed.full_profile
       or coalesce(s.searchable, true)
     )
     and (auth.uid() is null or private.viewer_not_blocked(p.id));
$$;

revoke all on function public.profile_discovery_by_username(text) from public;
grant execute on function public.profile_discovery_by_username(text) to anon, authenticated;

create or replace function public.profile_search(p_query text default '', p_limit integer default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  is_private boolean,
  website_url text,
  link_title text,
  account_type text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id,
         p.username,
         p.display_name,
         case when coalesce(s.show_bio, true) then p.bio else '' end,
         case when coalesce(s.show_avatar, true) then p.avatar_url else null end,
         p.is_private,
         case when coalesce(s.show_website, false) then p.website_url else null end,
         case when coalesce(s.show_website, false) then p.link_title else null end,
         case when coalesce(s.show_account_type, true) then p.account_type::text else null end
    from public.profiles p
    left join public.account_settings s on s.profile_id = p.id
   where coalesce(s.searchable, true)
     and (coalesce(trim(p_query), '') = ''
       or p.username ilike '%' || left(trim(p_query), 80) || '%'
       or p.display_name ilike '%' || left(trim(p_query), 80) || '%')
     and (auth.uid() is null or private.viewer_not_blocked(p.id))
   order by (p.username ilike left(trim(p_query), 80) || '%') desc, p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 40));
$$;

revoke all on function public.profile_search(text, integer) from public;
grant execute on function public.profile_search(text, integer) to anon, authenticated;

-- This RPC is the only API that exposes connection rows. A caller can only
-- read a list when the owner's setting permits it; blocks always take priority.
create or replace function public.profile_connections(
  p_profile_id uuid,
  p_direction text,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  with owner_settings as (
    select p.is_private,
           coalesce(s.followers_visibility, 'followers') as followers_visibility,
           coalesce(s.following_visibility, 'followers') as following_visibility
      from public.profiles p
      left join public.account_settings s on s.profile_id = p.id
     where p.id = p_profile_id
  ), allowed as (
    select exists (
      select 1 from owner_settings o
      where auth.uid() = p_profile_id
         or (
           (auth.uid() is null and not o.is_private and
             case when p_direction = 'followers' then o.followers_visibility else o.following_visibility end = 'everyone')
           or (
             auth.uid() is not null
             and private.viewer_not_blocked(p_profile_id)
             and case when p_direction = 'followers' then o.followers_visibility else o.following_visibility end = 'everyone'
           )
           or (
             auth.uid() is not null
             and private.viewer_is_approved_follower(p_profile_id)
             and case when p_direction = 'followers' then o.followers_visibility else o.following_visibility end = 'followers'
           )
         )
    ) as can_read
  ), relation_ids as (
    select case when p_direction = 'followers' then f.follower_id else f.following_id end as profile_id,
           f.created_at
      from public.follows f
     where f.status = 'accepted'
       and ((p_direction = 'followers' and f.following_id = p_profile_id)
         or (p_direction = 'following' and f.follower_id = p_profile_id))
  )
  select p.id, p.username, p.display_name,
         case when coalesce(s.show_avatar, true) then p.avatar_url else null end
    from relation_ids r
    join public.profiles p on p.id = r.profile_id
    left join public.account_settings s on s.profile_id = p.id
    cross join allowed a
   where a.can_read
     and p_direction in ('followers', 'following')
     and (auth.uid() is null or private.viewer_not_blocked(p.id))
   order by r.created_at desc, p.id
   limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.profile_connections(uuid, text, integer, integer) from public;
grant execute on function public.profile_connections(uuid, text, integer, integer) to anon, authenticated;

create or replace function public.profile_follow_counts(target_profile_id uuid)
returns table (followers_count bigint, following_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_is_private boolean;
  can_view boolean;
begin
  select p.is_private into target_is_private
    from public.profiles p where p.id = target_profile_id;
  if not found then return; end if;
  can_view := target_profile_id = auth.uid()
    or (auth.uid() is not null and private.viewer_not_blocked(target_profile_id)
        and (not target_is_private or private.viewer_is_approved_follower(target_profile_id)))
    or (auth.uid() is null and not target_is_private);
  if not can_view then
    return query select null::bigint, null::bigint;
    return;
  end if;
  return query
    select
      case when target_profile_id = auth.uid()
             or coalesce((select s.show_follower_count from public.account_settings s where s.profile_id = target_profile_id), true)
           then (select count(*) from public.follows f where f.following_id = target_profile_id and f.status = 'accepted')
           else null::bigint end,
      case when target_profile_id = auth.uid()
             or coalesce((select s.show_following_count from public.account_settings s where s.profile_id = target_profile_id), true)
           then (select count(*) from public.follows f where f.follower_id = target_profile_id and f.status = 'accepted')
           else null::bigint end;
end;
$$;

revoke all on function public.profile_follow_counts(uuid) from public;
grant execute on function public.profile_follow_counts(uuid) to anon, authenticated;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass) then
    raise exception 'RLS must remain enabled on profiles.';
  end if;
  if not has_function_privilege('anon', 'public.profile_discovery_by_username(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.profile_connections(uuid,text,integer,integer)', 'execute')
     or not has_function_privilege('anon', 'public.profile_search(text,integer)', 'execute') then
    raise exception 'Privacy-safe profile RPC grants are incomplete.';
  end if;
  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.profiles'::regclass and polname = 'Readable profiles only'
  ) then
    raise exception 'Protected profiles are missing the restrictive read policy.';
  end if;
end;
$$;
