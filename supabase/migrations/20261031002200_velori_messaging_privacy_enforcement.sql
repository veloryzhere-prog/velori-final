-- Enforce direct message privacy at the database boundary, including existing
-- threads. Reactions, pins, and voice-note schema are handled in 20261031002000.

create or replace function private.is_conversation_participant(
  p_conversation_id uuid,
  p_viewer uuid
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
      from public.conversation_participants p
      join public.conversations c on c.id = p.conversation_id
      where p.conversation_id = p_conversation_id
        and p.user_id = p_viewer
        and (
          c.kind <> 'direct'
          or not exists (
            select 1
            from public.conversation_participants other
            where other.conversation_id = c.id
              and other.user_id <> p_viewer
              and private.blocked_between(p_viewer, other.user_id)
          )
        )
    );
$$;

revoke all on function private.is_conversation_participant(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.is_conversation_participant(uuid, uuid)
  to authenticated;

create or replace function private.can_send_direct_message(
  p_conversation_id uuid,
  p_sender_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_sender_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      join public.conversation_participants sender
        on sender.conversation_id = c.id and sender.user_id = p_sender_id
      join public.conversation_participants recipient
        on recipient.conversation_id = c.id and recipient.user_id <> p_sender_id
      left join public.account_settings settings
        on settings.profile_id = recipient.user_id
      where c.id = p_conversation_id
        and c.kind = 'direct'
        and not c.is_locked
        and not private.blocked_between(p_sender_id, recipient.user_id)
        and not exists (
          select 1 from public.restrictions r
          where r.restrictor_id = recipient.user_id
            and r.restricted_id = p_sender_id
        )
        and case coalesce(settings.message_permission, 'followers')
          when 'everyone' then true
          when 'followers' then exists (
            select 1 from public.follows f
            where f.follower_id = p_sender_id
              and f.following_id = recipient.user_id
              and f.status = 'accepted'
          )
          when 'following' then exists (
            select 1 from public.follows f
            where f.follower_id = recipient.user_id
              and f.following_id = p_sender_id
              and f.status = 'accepted'
          )
          else false
        end
    );
$$;

revoke all on function private.can_send_direct_message(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.can_send_direct_message(uuid, uuid)
  to authenticated;

create or replace function private.can_send_conversation_message(
  p_conversation_id uuid,
  p_sender_id uuid,
  p_kind text
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
          and (p_kind = 'text' or coalesce(settings.allow_media, true))
          and (
            coalesce(settings.slow_mode_seconds, 0) = 0
            or not exists (
              select 1 from public.messages recent
              where recent.conversation_id = p_conversation_id
                and recent.sender_id = p_sender_id
                and recent.created_at > now() - make_interval(secs => settings.slow_mode_seconds)
            )
          )
      )
    else false
  end
  from public.conversations c
  where c.id = p_conversation_id;
$$;

revoke all on function private.can_send_conversation_message(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function private.can_send_conversation_message(uuid, uuid, text)
  to authenticated;

-- Retain the original RPC contract while refusing to create a thread when the
-- recipient's current message privacy settings do not permit contact.
create or replace function public.open_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  viewer uuid := auth.uid();
  conversation uuid;
  allowed boolean := false;
  permission text;
begin
  if viewer is null then
    raise exception 'You must be signed in to start a conversation.' using errcode = '42501';
  end if;
  if p_other_user_id is null or p_other_user_id = viewer then
    raise exception 'Choose a different person to message.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_other_user_id) then
    raise exception 'That account was not found.' using errcode = 'P0002';
  end if;
  if private.blocked_between(viewer, p_other_user_id)
     or exists (
       select 1 from public.restrictions r
       where r.restrictor_id = p_other_user_id and r.restricted_id = viewer
     ) then
    raise exception 'You cannot message this account.' using errcode = '42501';
  end if;

  select coalesce(s.message_permission, 'followers') into permission
  from public.account_settings s where s.profile_id = p_other_user_id;
  permission := coalesce(permission, 'followers');
  allowed := permission = 'everyone'
    or (permission = 'followers' and exists (
      select 1 from public.follows f
      where f.follower_id = viewer and f.following_id = p_other_user_id and f.status = 'accepted'
    ))
    or (permission = 'following' and exists (
      select 1 from public.follows f
      where f.follower_id = p_other_user_id and f.following_id = viewer and f.status = 'accepted'
    ));
  if not allowed then
    raise exception 'This person only accepts messages from people they follow.'
      using errcode = '42501';
  end if;

  insert into public.conversations (kind, direct_key)
  values (
    'direct',
    least(viewer::text, p_other_user_id::text) || ':' || greatest(viewer::text, p_other_user_id::text)
  )
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

drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and deleted_at is null
    and private.is_conversation_participant(conversation_id, auth.uid())
    and private.can_send_conversation_message(conversation_id, auth.uid(), kind)
  );
