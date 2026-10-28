-- Private groups are discoverable to signed-in users so they can request to
-- join. Hidden groups remain visible only to members, moderators, and invitees.
drop policy if exists "Members read private groups" on public.groups;
create policy "Members read private groups" on public.groups
  for select to authenticated
  using (
    (privacy in ('public', 'private') and not is_locked)
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
