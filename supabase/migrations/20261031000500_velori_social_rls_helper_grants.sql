-- RLS policy helpers must be executable by the authenticated role. Keep the
-- viewer-bound helpers from being used to probe another member's relationships.

create or replace function private.viewer_is_group_member(p_group_id uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_viewer is not null
    and p_viewer = (select auth.uid())
    and exists (
      select 1 from public.group_members m
      where m.group_id = p_group_id
        and m.user_id = p_viewer
        and m.status = 'active'
    );
$$;

create or replace function private.viewer_outranks_group_member(
  p_group_id uuid,
  p_viewer uuid,
  p_target uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_viewer is not null
    and p_viewer = (select auth.uid())
    and exists (
      select 1
      from public.group_members viewer
      join public.group_members target on target.group_id = viewer.group_id
      where viewer.group_id = p_group_id
        and viewer.user_id = p_viewer
        and viewer.status = 'active'
        and target.user_id = p_target
        and target.status <> 'banned'
        and private.group_role_rank(viewer.role) > private.group_role_rank(target.role)
    );
$$;

create or replace function private.is_conversation_participant(p_conversation_id uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_viewer is not null
    and p_viewer = (select auth.uid())
    and exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = p_conversation_id
        and p.user_id = p_viewer
    );
$$;

revoke all on function private.group_role_rank(text) from public, anon;
revoke all on function private.viewer_is_group_member(uuid, uuid) from public, anon;
revoke all on function private.viewer_outranks_group_member(uuid, uuid, uuid) from public, anon;
revoke all on function private.is_conversation_participant(uuid, uuid) from public, anon;

grant execute on function private.group_role_rank(text) to authenticated;
grant execute on function private.viewer_is_group_member(uuid, uuid) to authenticated;
grant execute on function private.viewer_outranks_group_member(uuid, uuid, uuid) to authenticated;
grant execute on function private.is_conversation_participant(uuid, uuid) to authenticated;
