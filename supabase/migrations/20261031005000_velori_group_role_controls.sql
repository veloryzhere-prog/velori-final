-- Group role changes must be authorized by the database, not by client-side
-- visibility or an update policy that cannot safely constrain the new role.
revoke update on public.group_members from authenticated;

create or replace function public.set_group_member_role(
  p_group_id uuid,
  p_user_id uuid,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  viewer_role text;
  target_role text;
begin
  if viewer is null then
    raise exception 'You must be signed in to manage group roles.'
      using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('member', 'moderator', 'admin') then
    raise exception 'Choose a valid group role.'
      using errcode = '22023';
  end if;

  select m.role into viewer_role
    from public.group_members m
   where m.group_id = p_group_id
     and m.user_id = viewer
     and m.status = 'active'
   for update;
  if viewer_role is null or viewer_role not in ('owner', 'admin') then
    raise exception 'Only the group owner or an admin can change member roles.'
      using errcode = '42501';
  end if;

  select m.role into target_role
    from public.group_members m
   where m.group_id = p_group_id
     and m.user_id = p_user_id
     and m.status = 'active'
   for update;
  if target_role is null or target_role = 'owner' or p_user_id = viewer then
    raise exception 'This member role cannot be changed.'
      using errcode = '42501';
  end if;

  if viewer_role = 'admin'
     and (
       private.group_role_rank(target_role) >= private.group_role_rank('admin')
       or private.group_role_rank(p_role) >= private.group_role_rank('admin')
     ) then
    raise exception 'Admins can only manage members and moderators.'
      using errcode = '42501';
  end if;

  update public.group_members
     set role = p_role
   where group_id = p_group_id
     and user_id = p_user_id
     and status = 'active';

  return found;
end;
$$;

revoke all on function public.set_group_member_role(uuid, uuid, text)
  from public, anon;
grant execute on function public.set_group_member_role(uuid, uuid, text)
  to authenticated;

-- Membership changes that affect ownership, invitations, or moderator decisions
-- must go through the existing transactional RPCs.
revoke delete on public.group_members from authenticated;

drop policy if exists "Members read private groups" on public.groups;
create policy "Members read private groups" on public.groups
  for select to authenticated
  using (
    (privacy = 'public' and not is_locked)
    or private.viewer_is_group_member(id, auth.uid())
    or private.viewer_outranks_group_member(id, auth.uid(), owner_id)
    or exists (
      select 1
        from public.group_members pending
       where pending.group_id = groups.id
         and pending.user_id = auth.uid()
         and pending.status in ('requested', 'invited')
    )
  );

create or replace function public.leave_group(p_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  member_role text;
  member_status text;
  successor uuid;
begin
  if viewer is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select m.role, m.status into member_role, member_status
    from public.group_members m
   where m.group_id = p_group_id
     and m.user_id = viewer
   for update;
  if member_status is null then
    return false;
  end if;

  if member_status in ('requested', 'invited') then
    delete from public.group_members
     where group_id = p_group_id and user_id = viewer;
    return true;
  end if;
  if member_status <> 'active' then
    return false;
  end if;

  if member_role <> 'owner' then
    delete from public.group_members
     where group_id = p_group_id and user_id = viewer;
    return true;
  end if;

  select candidate.user_id into successor
    from (
      select m.user_id,
             private.group_role_rank(m.role) as rank,
             m.joined_at
        from public.group_members m
       where m.group_id = p_group_id
         and m.user_id <> viewer
         and m.status = 'active'
       order by rank desc, m.joined_at asc
       limit 1
    ) candidate;

  if successor is null then
    delete from public.groups where id = p_group_id;
    return true;
  end if;

  update public.group_members
     set role = 'owner'
   where group_id = p_group_id and user_id = successor;
  update public.groups set owner_id = successor where id = p_group_id;
  delete from public.group_members
   where group_id = p_group_id and user_id = viewer;
  return true;
end;
$$;

revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;

create or replace function public.remove_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null or p_user_id is null or p_user_id = viewer
     or not private.viewer_outranks_group_member(p_group_id, viewer, p_user_id) then
    raise exception 'You cannot remove this group member.'
      using errcode = '42501';
  end if;

  delete from public.group_members
   where group_id = p_group_id
     and user_id = p_user_id
     and status = 'active';
  return found;
end;
$$;

revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

create or replace function public.review_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_approve boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  viewer_role text;
  group_locked boolean;
  group_name text;
  group_slug text;
begin
  select m.role into viewer_role
    from public.group_members m
   where m.group_id = p_group_id
     and m.user_id = viewer
     and m.status = 'active';
  if coalesce(private.group_role_rank(viewer_role), 0)
       < private.group_role_rank('moderator')
     or p_user_id = viewer then
    raise exception 'You cannot review members of that group.'
      using errcode = '42501';
  end if;

  select g.is_locked, g.name, g.slug
    into group_locked, group_name, group_slug
    from public.groups g
   where g.id = p_group_id
   for update;
  if not found then
    raise exception 'That group was not found.' using errcode = 'P0002';
  end if;
  if p_approve and group_locked then
    raise exception 'This group is locked and cannot accept new members.'
      using errcode = '42501';
  end if;

  if p_approve then
    update public.group_members
       set status = 'active', joined_at = now(), responded_at = now()
     where group_id = p_group_id
       and user_id = p_user_id
       and status = 'requested';
    if found then
      perform public.enqueue_social_notification(
        p_user_id,
        viewer,
        'group',
        'Join request approved',
        'Your request to join ' || group_name || ' was approved.',
        '/groups/' || group_slug,
        'group',
        p_group_id
      );
    end if;
    return found;
  end if;

  delete from public.group_members
   where group_id = p_group_id
     and user_id = p_user_id
     and status = 'requested';
  if found then
    perform public.enqueue_social_notification(
      p_user_id,
      viewer,
      'group',
      'Join request declined',
      'Your request to join ' || group_name || ' was declined.',
      '/groups',
      'group',
      p_group_id
    );
  end if;
  return found;
end;
$$;

revoke all on function public.review_group_member(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.review_group_member(uuid, uuid, boolean)
  to authenticated;

create or replace function public.accept_group_invite(p_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  group_locked boolean;
begin
  if viewer is null then
    raise exception 'You must be signed in to accept a group invitation.'
      using errcode = '42501';
  end if;
  select g.is_locked into group_locked
    from public.groups g
   where g.id = p_group_id
   for update;
  if not found then
    raise exception 'That group was not found.' using errcode = 'P0002';
  end if;
  if group_locked then
    raise exception 'This group is locked and cannot accept new members.'
      using errcode = '42501';
  end if;

  update public.group_members
     set status = 'active', joined_at = now(), responded_at = now()
   where group_id = p_group_id
     and user_id = viewer
     and status = 'invited';
  return found;
end;
$$;

revoke all on function public.accept_group_invite(uuid) from public, anon;
grant execute on function public.accept_group_invite(uuid) to authenticated;

create or replace function public.group_member_directory(
  p_group_id uuid,
  p_query text default '',
  p_filter text default 'all',
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  role text,
  status text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  viewer_role text;
  search_text text := lower(trim(coalesce(p_query, '')));
begin
  if viewer is null then
    raise exception 'Sign in to view group members.'
      using errcode = '42501';
  end if;
  if p_filter is null or p_filter not in ('all', 'admins', 'moderators', 'recent', 'requests') then
    raise exception 'Choose a valid member filter.'
      using errcode = '22023';
  end if;
  if p_limit is null or p_offset is null or p_limit < 1 or p_limit > 50 or p_offset < 0 then
    raise exception 'Member page limits are invalid.'
      using errcode = '22023';
  end if;

  select m.role into viewer_role
    from public.group_members m
   where m.group_id = p_group_id
     and m.user_id = viewer
     and m.status = 'active';
  if viewer_role is null then
    raise exception 'Join the group to view its member directory.'
      using errcode = '42501';
  end if;
  if p_filter = 'requests'
     and private.group_role_rank(viewer_role) < private.group_role_rank('moderator') then
    raise exception 'You cannot view this group’s join requests.'
      using errcode = '42501';
  end if;

  return query
  select m.user_id, p.username, p.display_name, p.avatar_url, m.role, m.status, m.joined_at
    from public.group_members m
    join public.profiles p on p.id = m.user_id
   where m.group_id = p_group_id
     and (
       (p_filter = 'requests' and m.status = 'requested')
       or (
         p_filter <> 'requests'
         and m.status = 'active'
         and (p_filter <> 'admins' or m.role in ('owner', 'admin'))
         and (p_filter <> 'moderators' or m.role = 'moderator')
       )
     )
     and not private.blocked_between(viewer, m.user_id)
     and (
       search_text = ''
       or position(search_text in lower(coalesce(p.display_name, '') || ' ' || p.username)) > 0
     )
   order by
     case when p_filter = 'recent' then m.joined_at end desc nulls last,
     case when p_filter <> 'recent' then m.joined_at end asc nulls last,
     m.user_id
   limit p_limit
   offset p_offset;
end;
$$;

revoke all on function public.group_member_directory(uuid, text, text, integer, integer)
  from public, anon;
grant execute on function public.group_member_directory(uuid, text, text, integer, integer)
  to authenticated;

comment on function public.set_group_member_role(uuid, uuid, text) is
  'Changes a group role with database-enforced owner/admin limits; direct member updates are revoked.';
comment on function public.group_member_directory(uuid, text, text, integer, integer) is
  'Returns a paginated, searchable member or join-request directory only to active group members with sufficient role access.';

create or replace function public.enqueue_social_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_link text,
  p_entity_type text,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enabled boolean := true;
begin
  if p_recipient_id is null or p_actor_id is null or p_recipient_id = p_actor_id then
    return;
  end if;

  select case p_kind
    when 'like' then coalesce(preferences.likes, true)
    when 'comment' then coalesce(preferences.comments, true)
    when 'reply' then coalesce(preferences.replies, true)
    when 'follow' then coalesce(preferences.follows, true)
    when 'follow_request' then coalesce(preferences.follows, true)
    when 'mention' then coalesce(preferences.mentions, true)
    when 'tag' then coalesce(preferences.mentions, true)
    when 'story_reply' then coalesce(preferences.stories, true)
    when 'story_reaction' then coalesce(preferences.stories, true)
    when 'reel_interaction' then coalesce(preferences.reels, true)
    when 'message' then coalesce(preferences.messages, true)
    when 'group' then coalesce(preferences.groups, true)
    when 'group_invite' then coalesce(preferences.groups, true)
    when 'group_join' then coalesce(preferences.groups, true)
    when 'group_request_approved' then coalesce(preferences.groups, true)
    when 'group_request_declined' then coalesce(preferences.groups, true)
    when 'security' then coalesce(preferences.security, true)
    else coalesce(preferences.system, true)
  end into enabled
    from public.notification_preferences preferences
   where preferences.profile_id = p_recipient_id;

  if not coalesce(enabled, true) then return; end if;

  insert into public.notifications (
    recipient_id, actor_id, kind, title, body, link, entity_type, entity_id
  ) values (
    p_recipient_id, p_actor_id, p_kind, left(p_title, 160), left(p_body, 2000),
    left(p_link, 300), p_entity_type, p_entity_id
  );
end;
$$;

revoke all on function public.enqueue_social_notification(uuid, uuid, text, text, text, text, text, uuid)
  from public, anon, authenticated;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.group_members'::regclass) then
    raise exception 'RLS must remain enabled on public.group_members.';
  end if;
  if has_table_privilege('authenticated', 'public.group_members', 'UPDATE')
     or has_table_privilege('authenticated', 'public.group_members', 'DELETE') then
    raise exception 'Group membership changes must use authorized RPCs.';
  end if;
  if not has_function_privilege('authenticated', 'public.set_group_member_role(uuid,uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.group_member_directory(uuid,text,text,integer,integer)', 'EXECUTE') then
    raise exception 'Group member RPC grants are missing.';
  end if;
end;
$$;
