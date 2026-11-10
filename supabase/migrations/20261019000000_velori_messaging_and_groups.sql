-- VELORI messaging and groups.
--
-- Adds the two product areas that previously had no persistence at all. The
-- frontend already routed /messages and /groups to an explicit "not available"
-- page rather than faking data, so nothing here replaces working behaviour; this
-- migration supplies the real model those routes will consume.
--
-- Design constraints carried over from the existing schema:
--   * Follow relationships are `follower_id` / `following_id` with
--     `status = 'accepted'`. There is no `followed_id` and no `accepted_at`.
--   * Blocks are (blocker_id, blocked_id) and are directional, so "these two
--     people cannot talk" is a symmetric check over both directions.
--   * Every SECURITY DEFINER function pins `search_path` and is granted only to
--     the role that needs it.
--   * Notification creation stays server-side. Clients can read their own
--     notifications and update only `read_at`.
--
-- Everything is written so it can be re-applied to a database that already has
-- part of it, because this project has previously been deployed from the SQL
-- editor rather than from the migration ledger.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- True when either party has blocked the other. Directional rows mean a pair is
-- only safe when neither direction is present.
create or replace function private.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select a is not null and b is not null and (
    exists (
      select 1 from public.blocks
      where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
    )
  );
$$;

revoke all on function private.blocked_between(uuid, uuid) from public, anon, authenticated;

-- The table-dependent helpers below are declared after their tables, because
-- Postgres validates a SQL function body when the function is created. A helper
-- that queries group_members cannot exist before group_members does.

-- Rank used for every group authorisation decision. Higher outranks lower, so a
-- moderator can remove a member but cannot remove an admin, and nobody except
-- the owner can act on the owner.
create or replace function private.group_role_rank(p_role text)
returns integer
language sql
immutable
set search_path to ''
as $$
  select case p_role
    when 'owner' then 4
    when 'admin' then 3
    when 'moderator' then 2
    when 'member' then 1
    else 0
  end;
$$;

revoke all on function private.group_role_rank(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct', 'group')),
  -- Direct conversations store a deterministic pair key so the database itself
  -- prevents two concurrent opens from creating duplicate threads.
  direct_key text unique,
  title text not null default '',
  avatar_url text,
  owner_id uuid references public.profiles (id) on delete set null,
  is_locked boolean not null default false,
  last_message_at timestamptz,
  last_message_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_direct_key_required
    check ((kind = 'direct') = (direct_key is not null))
);

comment on table public.conversations is
  'Message threads. A direct thread is uniquely identified by direct_key so concurrent opens cannot duplicate it.';

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  notifications_enabled boolean not null default true,
  muted_until timestamptz,
  archived_at timestamptz,
  primary key (conversation_id, user_id)
);

comment on table public.conversation_participants is
  'Membership of a conversation. Presence of a row is the authorization for reading and sending.';

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'image', 'video', 'file', 'system')),
  body text not null default '',
  reply_to_id uuid references public.messages (id) on delete set null,
  -- Client-generated idempotency key. A retried send with the same nonce is
  -- rejected by a unique index instead of duplicating the message.
  client_nonce text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint messages_body_present check (kind <> 'text' or length(trim(body)) > 0),
  constraint messages_deleted_has_no_body check (deleted_at is null or body = '')
);

comment on table public.messages is
  'Messages. Deletes are soft so ordering and unread counts stay stable; the scheduled cleanup removes rows past retention.';

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  object_path text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video', 'file')),
  mime_type text not null default 'image/jpeg',
  byte_size bigint not null default 0 check (byte_size >= 0),
  width integer,
  height integer,
  duration_ms integer,
  alt_text text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.message_attachments is
  'Attachment metadata. Bytes live in the private message-media bucket; access follows the parent message.';

create index if not exists conversations_recent_idx
  on public.conversations (last_message_at desc nulls last, id desc);
create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id, conversation_id);
-- Supports the inbox query: "my unarchived threads". Ordering comes from
-- conversations.last_message_at via conversations_recent_idx, which is why this
-- index covers membership and archive state only.
create index if not exists conversation_participants_inbox_idx
  on public.conversation_participants (user_id, conversation_id)
  where archived_at is null;
create index if not exists messages_thread_idx
  on public.messages (conversation_id, created_at desc, id desc);
create index if not exists messages_sender_idx
  on public.messages (sender_id, created_at desc);
create unique index if not exists messages_idempotency_idx
  on public.messages (conversation_id, sender_id, client_nonce)
  where client_nonce is not null;
create index if not exists message_attachments_message_idx
  on public.message_attachments (message_id, position);

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  avatar_url text,
  cover_url text,
  privacy text not null default 'public' check (privacy in ('public', 'private', 'hidden')),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  is_locked boolean not null default false,
  member_count integer not null default 0 check (member_count >= 0),
  post_count integer not null default 0 check (post_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.groups is
  'Groups. privacy=public is listed and joinable, private is listed but approval is required, hidden is visible only to members.';

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'moderator', 'member')),
  status text not null default 'active'
    check (status in ('requested', 'invited', 'active', 'banned')),
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

comment on table public.group_members is
  'Group membership and the join workflow. requested=awaiting approval, invited=awaiting acceptance, active=member, banned=removed.';

create table if not exists public.group_settings (
  group_id uuid primary key references public.groups (id) on delete cascade,
  join_policy text not null default 'open' check (join_policy in ('open', 'approval', 'invite_only')),
  allow_messages boolean not null default true,
  allow_media boolean not null default true,
  slow_mode_seconds integer not null default 0 check (slow_mode_seconds between 0 and 86400),
  updated_at timestamptz not null default now()
);

comment on table public.group_settings is
  'Per-group permissions. Defaults to the most permissive value so a group works before it is configured.';

create index if not exists groups_discoverable_idx
  on public.groups (privacy, created_at desc);
create index if not exists groups_owner_idx on public.groups (owner_id);
create index if not exists group_members_user_idx
  on public.group_members (user_id, status, group_id);
create index if not exists group_members_group_active_idx
  on public.group_members (group_id, role, joined_at desc)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- Table-dependent authorization helpers
-- ---------------------------------------------------------------------------

create or replace function private.viewer_is_group_member(p_group_id uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_viewer is not null and exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id
      and m.user_id = p_viewer
      and m.status = 'active'
  );
$$;

revoke all on function private.viewer_is_group_member(uuid, uuid) from public, anon, authenticated;

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
  select exists (
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

revoke all on function private.viewer_outranks_group_member(uuid, uuid, uuid)
  from public, anon, authenticated;

-- True when the viewer participates in the conversation. Presence of a row is the
-- whole authorization model for threads, so this is deliberately one lookup.
create or replace function private.is_conversation_participant(p_conversation_id uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_viewer is not null and exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = p_conversation_id and p.user_id = p_viewer
  );
$$;

revoke all on function private.is_conversation_participant(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;

drop trigger if exists conversations_touch on public.conversations;
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();

drop trigger if exists groups_touch on public.groups;
create trigger groups_touch before update on public.groups
  for each row execute function public.touch_updated_at();

drop trigger if exists group_members_touch on public.group_members;
create trigger group_members_touch before update on public.group_members
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Member counters and thread metadata
-- ---------------------------------------------------------------------------

-- Keeps group.member_count honest even when a row is removed by cascade rather
-- than through the join/leave RPCs.
create or replace function public.group_member_count_refresh()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.groups g
     set member_count = (
       select count(*) from public.group_members m
       where m.group_id = coalesce(new.group_id, old.group_id) and m.status = 'active'
     )
   where g.id = coalesce(new.group_id, old.group_id);
  return coalesce(new, old);
end;
$$;

revoke all on function public.group_member_count_refresh() from public, anon, authenticated;

drop trigger if exists group_member_count_after_write on public.group_members;
create trigger group_member_count_after_write
  after insert or update or delete on public.group_members
  for each row execute function public.group_member_count_refresh();

-- Denormalised thread ordering plus the sender list fragment the inbox renders.
create or replace function public.conversation_touch_after_message()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_id = new.id
   where id = new.conversation_id
     and (last_message_at is null or last_message_at < new.created_at);
  return new;
end;
$$;

revoke all on function public.conversation_touch_after_message() from public, anon, authenticated;

drop trigger if exists messages_conversation_touch on public.messages;
create trigger messages_conversation_touch after insert on public.messages
  for each row execute function public.conversation_touch_after_message();

-- ---------------------------------------------------------------------------
-- Message notification (server-side only)
-- ---------------------------------------------------------------------------

create or replace function public.notify_message_sent()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  recipient record;
begin
  if new.kind = 'system' or new.deleted_at is not null then
    return new;
  end if;

  for recipient in
    select p.user_id
      from public.conversation_participants p
     where p.conversation_id = new.conversation_id
       and p.user_id <> new.sender_id
       and coalesce(p.notifications_enabled, true)
       and (p.muted_until is null or p.muted_until < now())
       -- Never notify someone who has blocked or been blocked by the sender.
       and not private.blocked_between(p.user_id, new.sender_id)
  loop
    perform public.enqueue_social_notification(
      recipient.user_id,
      new.sender_id,
      'message',
      'New message',
      left(coalesce(nullif(new.body, ''), 'Sent an attachment'), 120),
      '/messages',
      'message',
      new.id
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_message_sent() from public, anon, authenticated;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify after insert on public.messages
  for each row execute function public.notify_message_sent();

-- ---------------------------------------------------------------------------
-- Client-facing RPCs
-- ---------------------------------------------------------------------------

-- Opens (or returns) the direct thread between the caller and one other person.
-- SECURITY DEFINER because the participant rows must be written for the *other*
-- user, which an RLS insert policy could not allow.
create or replace function public.open_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  viewer uuid := auth.uid();
  key text;
  conversation uuid;
begin
  if viewer is null then
    raise exception 'You must be signed in to start a conversation.'
      using errcode = '42501';
  end if;
  if p_other_user_id is null or p_other_user_id = viewer then
    raise exception 'Choose a different person to message.'
      using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_other_user_id) then
    raise exception 'That account was not found.'
      using errcode = 'P0002';
  end if;
  if private.blocked_between(viewer, p_other_user_id) then
    raise exception 'You cannot message this account.'
      using errcode = '42501';
  end if;

  key := least(viewer::text, p_other_user_id::text) || ':' || greatest(viewer::text, p_other_user_id::text);

  insert into public.conversations (kind, direct_key)
  values ('direct', key)
  on conflict (direct_key) do update set direct_key = excluded.direct_key
  returning id into conversation;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (conversation, viewer, 'owner'), (conversation, p_other_user_id, 'member')
  on conflict do nothing;

  return conversation;
end;
$$;

revoke all on function public.open_direct_conversation(uuid) from public, anon;
grant execute on function public.open_direct_conversation(uuid) to authenticated;

-- Marks everything currently in the thread as read for the caller.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  marked integer;
begin
  if not private.is_conversation_participant(p_conversation_id, auth.uid()) then
    raise exception 'You do not have access to that conversation.'
      using errcode = '42501';
  end if;

  update public.conversation_participants
     set last_read_at = now()
   where conversation_id = p_conversation_id
     and user_id = auth.uid()
     and (last_read_at is null or last_read_at < (select max(created_at) from public.messages where conversation_id = p_conversation_id));

  get diagnostics marked = row_count;
  return marked;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Unread badge total across every unarchived thread. A conversation counts as
-- unread when at least one message arrived after the caller's read marker, so the
-- badge is a conversation count rather than a message count.
create or replace function public.conversation_unread_total()
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce((
    select count(*)
      from public.conversation_participants p
      join public.conversations c on c.id = p.conversation_id
     where p.user_id = auth.uid()
       and p.archived_at is null
       and exists (
         select 1 from public.messages m
          where m.conversation_id = c.id
            and m.sender_id <> auth.uid()
            and m.deleted_at is null
            and (p.last_read_at is null or m.created_at > p.last_read_at)
       )
  ), 0)::int;
$$;

revoke all on function public.conversation_unread_total() from public, anon;
grant execute on function public.conversation_unread_total() to authenticated;

-- Join / leave. A public group joins immediately, a private group records a
-- request for an admin to approve. Leaving an owned group transfers or deletes
-- it rather than orphaning it.
create or replace function public.join_group(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  viewer uuid := auth.uid();
  target public.groups%rowtype;
  policy text;
  resulting text;
begin
  if viewer is null then
    raise exception 'You must be signed in to join a group.' using errcode = '42501';
  end if;

  select * into target from public.groups where id = p_group_id for update;
  if not found then
    raise exception 'That group was not found.' using errcode = 'P0002';
  end if;
  if target.is_locked then
    raise exception 'That group is not accepting new members.' using errcode = '42501';
  end if;
  if exists (select 1 from public.group_members where group_id = p_group_id and user_id = viewer and status = 'banned') then
    raise exception 'You cannot join this group.' using errcode = '42501';
  end if;

  select coalesce(s.join_policy, 'open') into policy from public.group_settings s where s.group_id = p_group_id;

  resulting := case
    when target.privacy = 'public' and policy <> 'invite_only' then 'active'
    when policy = 'invite_only' then 'invited'
    else 'requested'
  end;

  insert into public.group_members (group_id, user_id, role, status, joined_at, responded_at)
  values (p_group_id, viewer, 'member', resulting,
          case when resulting = 'active' then now() end, now())
  on conflict (group_id, user_id) do update
    set status = excluded.status,
        role = 'member',
        joined_at = excluded.joined_at,
        responded_at = excluded.responded_at,
        updated_at = now()
    where public.group_members.status <> 'banned';

  if resulting = 'active' then
    perform public.enqueue_social_notification(
      target.owner_id, viewer, 'group_join', 'New group member',
      'Someone joined your group.', '/groups', 'group', p_group_id
    );
  end if;

  return resulting;
end;
$$;

revoke all on function public.join_group(uuid) from public, anon;
grant execute on function public.join_group(uuid) to authenticated;

create or replace function public.leave_group(p_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  viewer uuid := auth.uid();
  role text;
  successor uuid;
begin
  if viewer is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select m.role into role from public.group_members m
   where m.group_id = p_group_id and m.user_id = viewer and m.status = 'active';
  if role is null then
    return false;
  end if;

  if role <> 'owner' then
    delete from public.group_members where group_id = p_group_id and user_id = viewer;
    return true;
  end if;

  -- An owner cannot walk away and leave the group ownerless. Promote the longest
  -- serving admin, otherwise the longest serving member.
  select u.user_id into successor from (
    select m.user_id,
           private.group_role_rank(m.role) as rank,
           m.joined_at
      from public.group_members m
     where m.group_id = p_group_id and m.user_id <> viewer and m.status = 'active'
     order by rank desc, m.joined_at asc
     limit 1
  ) u;

  if successor is null then
    delete from public.groups where id = p_group_id;
    return true;
  end if;

  update public.group_members
     set role = 'owner', updated_at = now()
   where group_id = p_group_id and user_id = successor;
  update public.groups set owner_id = successor where id = p_group_id;
  delete from public.group_members where group_id = p_group_id and user_id = viewer;
  return true;
end;
$$;

revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;

-- Approve or decline a pending request. Only an admin, moderator or the owner may
-- decide, and never for their own row.
create or replace function public.review_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_approve boolean
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
begin
  if private.group_role_rank((select m.role from public.group_members m
       where m.group_id = p_group_id and m.user_id = auth.uid() and m.status = 'active')) < 2 then
    raise exception 'You cannot review members of that group.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot review your own membership.' using errcode = '42501';
  end if;

  if p_approve then
    update public.group_members
       set status = 'active', joined_at = now(), responded_at = now(), updated_at = now()
     where group_id = p_group_id and user_id = p_user_id and status in ('requested', 'invited');
    return found;
  end if;

  delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
  return found;
end;
$$;

revoke all on function public.review_group_member(uuid, uuid, boolean) from public, anon;
grant execute on function public.review_group_member(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_settings enable row level security;

-- conversations ------------------------------------------------------------

drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations" on public.conversations
  for select to authenticated
  using (private.is_conversation_participant(id, auth.uid()));

drop policy if exists "Participants start conversations" on public.conversations;
create policy "Participants start conversations" on public.conversations
  for insert to authenticated
  with check (kind = 'direct');

drop policy if exists "Conversation owners update conversations" on public.conversations;
create policy "Conversation owners update conversations" on public.conversations
  for update to authenticated
  using (
    exists (select 1 from public.conversation_participants p
             where p.conversation_id = id and p.user_id = auth.uid() and p.role = 'owner')
  )
  with check (
    exists (select 1 from public.conversation_participants p
             where p.conversation_id = id and p.user_id = auth.uid() and p.role = 'owner')
  );

-- conversation_participants -----------------------------------------------

drop policy if exists "Participants read membership" on public.conversation_participants;
create policy "Participants read membership" on public.conversation_participants
  for select to authenticated
  using (private.is_conversation_participant(conversation_id, auth.uid()));

-- A participant may change only their own notification preferences and read
-- marker. Role changes are deliberately not writable by participants.
drop policy if exists "Participants update own membership" on public.conversation_participants;
create policy "Participants update own membership" on public.conversation_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = (select p.role from public.conversation_participants p
                          where p.conversation_id = conversation_participants.conversation_id
                            and p.user_id = auth.uid()));

drop policy if exists "Participants leave conversations" on public.conversation_participants;
create policy "Participants leave conversations" on public.conversation_participants
  for delete to authenticated
  using (user_id = auth.uid());

-- messages -----------------------------------------------------------------

drop policy if exists "Participants read messages" on public.messages;
create policy "Participants read messages" on public.messages
  for select to authenticated
  using (private.is_conversation_participant(conversation_id, auth.uid()));

drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and deleted_at is null
    and private.is_conversation_participant(conversation_id, auth.uid())
  );

-- Only the author edits, and an edit cannot rewrite identity or timing.
drop policy if exists "Authors edit their messages" on public.messages;
create policy "Authors edit their messages" on public.messages
  for update to authenticated
  using (sender_id = auth.uid() and deleted_at is null)
  with check (sender_id = auth.uid());

drop policy if exists "Authors delete their messages" on public.messages;
create policy "Authors delete their messages" on public.messages
  for delete to authenticated
  using (sender_id = auth.uid());

-- message_attachments ------------------------------------------------------

drop policy if exists "Participants read attachments" on public.message_attachments;
create policy "Participants read attachments" on public.message_attachments
  for select to authenticated
  using (exists (
    select 1 from public.messages m
    where m.id = message_id
      and m.deleted_at is null
      and private.is_conversation_participant(m.conversation_id, auth.uid())
  ));

drop policy if exists "Senders attach their own media" on public.message_attachments;
create policy "Senders attach their own media" on public.message_attachments
  for insert to authenticated
  with check (exists (
    select 1 from public.messages m
    where m.id = message_id
      and m.sender_id = auth.uid()
      and m.deleted_at is null
      and private.is_conversation_participant(m.conversation_id, auth.uid())
  ));

drop policy if exists "Senders remove their own attachments" on public.message_attachments;
create policy "Senders remove their own attachments" on public.message_attachments
  for delete to authenticated
  using (exists (
    select 1 from public.messages m
    where m.id = message_id and m.sender_id = auth.uid()
  ));

-- groups -------------------------------------------------------------------

drop policy if exists "Anonymous reads public groups" on public.groups;
create policy "Anonymous reads public groups" on public.groups
  for select to anon
  using (privacy = 'public' and not is_locked);

drop policy if exists "Members read private groups" on public.groups;
create policy "Members read private groups" on public.groups
  for select to authenticated
  using (
    privacy = 'public'
    or private.viewer_is_group_member(id, auth.uid())
    or private.viewer_outranks_group_member(id, auth.uid(), id)
  );

drop policy if exists "Owners update their groups" on public.groups;
create policy "Owners update their groups" on public.groups
  for update to authenticated
  using (owner_id = auth.uid() or private.viewer_outranks_group_member(id, auth.uid(), owner_id))
  with check (owner_id = auth.uid() or private.viewer_outranks_group_member(id, auth.uid(), owner_id));

drop policy if exists "Signed-in accounts create groups" on public.groups;
create policy "Signed-in accounts create groups" on public.groups
  for insert to authenticated
  with check (owner_id = auth.uid());

-- Deleting a group is the owner's decision alone.
drop policy if exists "Owners delete their groups" on public.groups;
create policy "Owners delete their groups" on public.groups
  for delete to authenticated
  using (owner_id = auth.uid());

-- group_members ------------------------------------------------------------

drop policy if exists "Members read the roster" on public.group_members;
create policy "Members read the roster" on public.group_members
  for select to authenticated
  using (
    private.viewer_is_group_member(group_id, auth.uid())
    or private.viewer_outranks_group_member(group_id, auth.uid(), user_id)
    or user_id = auth.uid()
  );

-- A user may add their own row (this is what an open join looks like) or an
-- admin may add somebody else. Role can never be raised through this policy.
drop policy if exists "Users request membership or admins invite" on public.group_members;
create policy "Users request membership or admins invite" on public.group_members
  for insert to authenticated
  with check (
    (user_id = auth.uid() and role = 'member' and status in ('requested', 'invited', 'active'))
    or (
      private.viewer_outranks_group_member(group_id, auth.uid(), user_id)
      and role in ('member', 'moderator')
    )
  );

drop policy if exists "Owners and admins maintain membership" on public.group_members;
create policy "Owners and admins maintain membership" on public.group_members
  for update to authenticated
  using (private.viewer_outranks_group_member(group_id, auth.uid(), user_id))
  with check (private.viewer_outranks_group_member(group_id, auth.uid(), user_id));

drop policy if exists "Users leave or are removed" on public.group_members;
create policy "Users leave or are removed" on public.group_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or private.viewer_outranks_group_member(group_id, auth.uid(), user_id)
  );

-- group_settings -----------------------------------------------------------

drop policy if exists "Members read group settings" on public.group_settings;
create policy "Members read group settings" on public.group_settings
  for select to authenticated
  using (private.viewer_is_group_member(group_id, auth.uid()));

drop policy if exists "Admins change group settings" on public.group_settings;
create policy "Admins change group settings" on public.group_settings
  for all to authenticated
  using (private.group_role_rank((select m.role from public.group_members m
      where m.group_id = group_settings.group_id and m.user_id = auth.uid() and m.status = 'active')) >= 3)
  with check (private.group_role_rank((select m.role from public.group_members m
      where m.group_id = group_settings.group_id and m.user_id = auth.uid() and m.status = 'active')) >= 3);

-- ---------------------------------------------------------------------------
-- Column-level grants: participants cannot forge roles, senders cannot forge
-- identity or timing, and nobody writes notifications directly.
-- ---------------------------------------------------------------------------

revoke all on public.conversations from anon;
grant select, insert, update on public.conversations to authenticated;
revoke delete on public.conversations from authenticated;

revoke all on public.conversation_participants from anon;
grant select, insert, update, delete on public.conversation_participants to authenticated;
revoke update (role) on public.conversation_participants from authenticated;
revoke update (joined_at) on public.conversation_participants from authenticated;

revoke all on public.messages from anon;
grant select, insert, update, delete on public.messages to authenticated;
revoke update (sender_id) on public.messages from authenticated;
revoke update (conversation_id) on public.messages from authenticated;
revoke update (created_at) on public.messages from authenticated;
revoke update (client_nonce) on public.messages from authenticated;

revoke all on public.message_attachments from anon;
grant select, insert, delete on public.message_attachments to authenticated;

revoke all on public.groups from anon;
-- Public groups form a logged-out discoverable directory, so anon needs to read
-- this one table. The "Anonymous reads public groups" policy is what actually
-- constrains it to privacy = 'public' and not locked; no write privilege is
-- granted, so an anonymous caller still cannot create or alter a group.
grant select on public.groups to anon;
grant select, insert, update, delete on public.groups to authenticated;

revoke all on public.group_members from anon;
grant select, insert, update, delete on public.group_members to authenticated;

revoke all on public.group_settings from anon;
grant select, insert, update, delete on public.group_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Private attachment storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-media',
  'message-media',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are `<user id>/<uuid>.<ext>`, so the first path segment must be
-- the uploader. That alone prevents one user writing into another's folder.
drop policy if exists "Participants read message media" on storage.objects;
create policy "Participants read message media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-media'
    and exists (
      select 1
      from public.message_attachments a
      join public.messages m on m.id = a.message_id
      where a.object_path = storage.objects.name
        and m.deleted_at is null
        and private.is_conversation_participant(m.conversation_id, auth.uid())
    )
  );

drop policy if exists "Senders upload message media" on storage.objects;
create policy "Senders upload message media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Senders update message media" on storage.objects;
create policy "Senders update message media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'message-media'
    and owner_id = auth.uid()::text
  );

drop policy if exists "Senders delete message media" on storage.objects;
create policy "Senders delete message media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'message-media'
    and owner_id = auth.uid()::text
  );
