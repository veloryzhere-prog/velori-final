-- Private typing broadcast is scoped to members who can currently read the
-- conversation. Message bodies and other user data are never broadcast.

drop policy if exists "Conversation members receive typing broadcasts" on realtime.messages;
create policy "Conversation members receive typing broadcasts"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and (select realtime.topic()) ~ '^velori:conversation:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and private.is_conversation_participant(
      substring((select realtime.topic()) from 21)::uuid,
      (select auth.uid())
    )
  );

drop policy if exists "Conversation members send typing broadcasts" on realtime.messages;
create policy "Conversation members send typing broadcasts"
  on realtime.messages for insert to authenticated
  with check (
    extension = 'broadcast'
    and (select realtime.topic()) ~ '^velori:conversation:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and private.is_conversation_participant(
      substring((select realtime.topic()) from 21)::uuid,
      (select auth.uid())
    )
  );
