-- Presence shares only self-reported online state inside a readable thread.
-- Members who opt out never track a presence key from the client.

drop policy if exists "Conversation members receive private presence" on realtime.messages;
create policy "Conversation members receive private presence"
  on realtime.messages for select to authenticated
  using (
    extension = 'presence'
    and (select realtime.topic()) ~ '^velori:conversation:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and private.is_conversation_participant(
      substring((select realtime.topic()) from 21)::uuid,
      (select auth.uid())
    )
  );

drop policy if exists "Conversation members publish private presence" on realtime.messages;
create policy "Conversation members publish private presence"
  on realtime.messages for insert to authenticated
  with check (
    extension = 'presence'
    and (select realtime.topic()) ~ '^velori:conversation:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and private.is_conversation_participant(
      substring((select realtime.topic()) from 21)::uuid,
      (select auth.uid())
    )
  );
