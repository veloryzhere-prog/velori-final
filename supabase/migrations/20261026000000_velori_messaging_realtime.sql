-- Publish messages for conversation-scoped Supabase Realtime listeners.
-- Row-level security remains enabled and participant-only read policies govern
-- which authenticated clients can receive Postgres Changes events.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'messages'
     ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
