-- Keep the private message-media metadata writer in step with direct-message
-- privacy and group media settings, even when callers bypass the UI.

create or replace function private.can_attach_conversation_media(
  p_conversation_id uuid,
  p_sender_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case c.kind
    when 'direct' then private.can_send_direct_message(p_conversation_id, p_sender_id)
    when 'group' then p_sender_id = (select auth.uid())
      and exists (
        select 1
        from public.conversations c2
        join public.group_members member
          on member.group_id = c2.group_id
          and member.user_id = p_sender_id
          and member.status = 'active'
        join public.groups g on g.id = member.group_id
        left join public.group_settings settings on settings.group_id = g.id
        where c2.id = p_conversation_id
          and not c2.is_locked
          and not g.is_locked
          and coalesce(settings.allow_messages, true)
          and coalesce(settings.allow_media, true)
      )
    else false
  end
  from public.conversations c
  where c.id = p_conversation_id;
$$;

revoke all on function private.can_attach_conversation_media(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.can_attach_conversation_media(uuid, uuid)
  to authenticated;

drop policy if exists "Senders attach their own media" on public.message_attachments;
create policy "Senders attach their own media" on public.message_attachments
  for insert to authenticated
  with check (exists (
    select 1
    from public.messages m
    where m.id = message_id
      and m.sender_id = auth.uid()
      and m.deleted_at is null
      and private.is_conversation_participant(m.conversation_id, auth.uid())
      and private.can_attach_conversation_media(m.conversation_id, auth.uid())
  ));
