-- Fix mark_conversation_read so reading a thread always clears the mark-unread
-- watermark.
--
-- 20261031002000 folded mark_unread_at = null into the same UPDATE that advances
-- last_read_at, but that UPDATE carries the pre-existing "only advance if there
-- is something newer" guard. When a participant had already read the newest
-- message, the guard matched zero rows, so the watermark survived and the thread
-- stayed flagged unread forever. Reading the conversation must always clear the
-- watermark; only the read cursor is conditional.

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  marked integer;
begin
  if not private.is_conversation_participant(p_conversation_id, auth.uid()) then
    raise exception 'You do not have access to that conversation.'
      using errcode = '42501';
  end if;

  -- Unconditional: opening the thread is what dismisses an explicit
  -- "mark unread", independent of whether any message arrived since.
  update public.conversation_participants
     set mark_unread_at = null
   where conversation_id = p_conversation_id
     and user_id = auth.uid()
     and mark_unread_at is not null;

  -- The read cursor still only moves forward, so the returned count keeps its
  -- original meaning: how many messages this call actually marked as read.
  update public.conversation_participants
     set last_read_at = now()
   where conversation_id = p_conversation_id
     and user_id = auth.uid()
     and (last_read_at is null
          or last_read_at < (select max(created_at) from public.messages where conversation_id = p_conversation_id));

  get diagnostics marked = row_count;
  return marked;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;