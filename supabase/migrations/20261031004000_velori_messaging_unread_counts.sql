-- Return exact unread message counts for each conversation the caller belongs
-- to. Counts exclude the caller's own messages and soft-deleted messages.

create or replace function public.conversation_unread_counts()
returns table (conversation_id uuid, unread_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select participant.conversation_id,
         greatest(
           count(message.id)::integer,
           case when participant.mark_unread_at is not null then 1 else 0 end
         ) as unread_count
    from public.conversation_participants participant
    left join public.messages message
      on message.conversation_id = participant.conversation_id
     and message.sender_id <> auth.uid()
     and message.deleted_at is null
     and message.created_at > coalesce(participant.last_read_at, participant.joined_at)
   where participant.user_id = auth.uid()
   group by participant.conversation_id, participant.mark_unread_at;
$$;

revoke all on function public.conversation_unread_counts() from public, anon;
grant execute on function public.conversation_unread_counts() to authenticated;

-- The navigation badge and conversation counts share the same source of truth.
create or replace function public.conversation_unread_total()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(counts.unread_count), 0)::integer
    from public.conversation_unread_counts() counts
    join public.conversation_participants participant
      on participant.conversation_id = counts.conversation_id
     and participant.user_id = auth.uid()
   where participant.archived_at is null;
$$;

revoke all on function public.conversation_unread_total() from public, anon;
grant execute on function public.conversation_unread_total() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'conversation_participants'
     ) then
    alter publication supabase_realtime add table public.conversation_participants;
  end if;
end;
$$;

notify pgrst, 'reload schema';
