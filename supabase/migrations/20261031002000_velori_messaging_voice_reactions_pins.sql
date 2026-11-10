-- Messaging: voice notes, emoji reactions, pinned messages and explicit mark-unread.
--
-- Voice notes were already implemented end to end in the client
-- (src/lib/message-media.ts maps audio/mp4, audio/webm and audio/ogg to
-- media_type "audio" and src/app/social-views.tsx inserts kind "audio"), but the
-- database rejected all three layers, so a voice note could never be sent:
-- messages_kind_check had no 'audio', message_attachments_media_type_check had
-- no 'audio', and the message-media bucket allowlisted no audio mime type.
--
-- Reactions and per-conversation pinning had no representation at all, and the
-- inbox could derive unread state only from last_read_at, so "mark unread" was
-- impossible without rewinding read history.

-- ---------------------------------------------------------------------------
-- 1. Voice notes
-- ---------------------------------------------------------------------------

alter table public.messages
  drop constraint if exists messages_kind_check;
alter table public.messages
  add constraint messages_kind_check
  check (kind in ('text', 'image', 'video', 'file', 'audio', 'system'));

alter table public.message_attachments
  drop constraint if exists message_attachments_media_type_check;
alter table public.message_attachments
  add constraint message_attachments_media_type_check
  check (media_type in ('image', 'video', 'file', 'audio'));

-- Only the mime types the client accepts and magic-byte checks, so the bucket
-- allowlist stays in step with src/lib/message-media.ts rather than widening
-- what an attacker could try to upload.
update storage.buckets
   set allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp',
         'video/mp4',
         'application/pdf',
         'audio/mp4', 'audio/webm', 'audio/ogg'
       ],
       updated_at = now()
 where id = 'message-media';

-- ---------------------------------------------------------------------------
-- 2. Emoji reactions
-- ---------------------------------------------------------------------------

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  -- One reaction per user per message. Changing your mind is an update, which
  -- keeps the unique conflict usable as the client's toggle primitive.
  constraint message_reactions_user_message_key unique (message_id, user_id),
  -- Deliberately not a fixed emoji allowlist: a hard-coded list would block
  -- every emoji added after this migration. Control characters are rejected so
  -- a reaction can never smuggle formatting or break out of its chip.
  constraint message_reactions_reaction_shape
    check (char_length(reaction) between 1 and 8 and reaction !~ '[[:cntrl:]]')
);

comment on table public.message_reactions is
  'One emoji reaction per user per message. Reacts change the whole message (text included), unlike post and reel reactions which address the item.';

create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);
create index if not exists message_reactions_user_idx
  on public.message_reactions (user_id, created_at desc);

alter table public.message_reactions enable row level security;

-- A reaction is only visible to people who can already read the message, and a
-- deleted message stops being reactable so the thread does not sprout reactions
-- on a tombstone.
create policy "Participants read reactions"
  on public.message_reactions for select
  using (
    exists (
      select 1
      from public.messages m
      where m.id = message_reactions.message_id
        and m.deleted_at is null
        and private.is_conversation_participant(m.conversation_id, auth.uid())
    )
  );

create policy "Participants react to messages"
  on public.message_reactions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.messages m
      where m.id = message_reactions.message_id
        and m.deleted_at is null
        and private.is_conversation_participant(m.conversation_id, auth.uid())
    )
  );

-- Reacting to your own message is allowed, so only the user column is pinned.
create policy "Participants change their own reaction"
  on public.message_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Participants remove their own reaction"
  on public.message_reactions for delete
  using (user_id = auth.uid());

revoke all on public.message_reactions from anon;
grant select, insert, update, delete on public.message_reactions to authenticated;
grant all on public.message_reactions to service_role;

-- Reaction chips update live in an open thread, so the table has to be in the
-- realtime publication alongside messages.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Pinned conversations and pinned messages
-- ---------------------------------------------------------------------------

alter table public.conversation_participants
  add column if not exists pinned boolean not null default false;

-- Pinning is per participant rather than per conversation: two people in the
-- same thread may pin different messages, which is what "jump to" needs.
alter table public.conversation_participants
  add column if not exists pinned_message_id uuid
  references public.messages (id) on delete set null;

create index if not exists conversation_participants_pinned_idx
  on public.conversation_participants (user_id, pinned desc, conversation_id);

-- A pin must point at a message in the same conversation. This cannot be a check
-- constraint because Postgres forbids subqueries in CHECK, so it is a trigger.
-- It runs as the invoker, which is what makes the authorization correct: a
-- participant can read their own conversation's messages, so a message from a
-- conversation they are not in is invisible here and the pin is refused.
create or replace function private.message_pin_belongs_to_conversation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.pinned_message_id is not null
     and not exists (
       select 1
       from public.messages m
       where m.id = new.pinned_message_id
         and m.conversation_id = new.conversation_id
     ) then
    raise exception 'Pinned message must belong to this conversation.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists conversation_participants_pin_scope on public.conversation_participants;
create trigger conversation_participants_pin_scope
  before insert or update of pinned_message_id
  on public.conversation_participants
  for each row
  execute function private.message_pin_belongs_to_conversation();

-- ---------------------------------------------------------------------------
-- 4. Explicit mark-unread
-- ---------------------------------------------------------------------------

-- Marking unread must not rewind last_read_at, because that cursor is also what
-- the unread count and the read-receipt view are derived from. A separate
-- watermark expresses "unread from here on" without falsifying read history.
alter table public.conversation_participants
  add column if not exists mark_unread_at timestamptz;

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

  -- Opening a conversation clears any pending mark-unread watermark, so read
  -- state cannot be resurrected by a later message arriving.
  update public.conversation_participants
     set last_read_at = now(),
         mark_unread_at = null
   where conversation_id = p_conversation_id
     and user_id = auth.uid()
     and (last_read_at is null or last_read_at < (select max(created_at) from public.messages where conversation_id = p_conversation_id));

  get diagnostics marked = row_count;
  return marked;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;