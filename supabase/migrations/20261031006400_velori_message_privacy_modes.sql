-- Add the remaining message modes while preserving the existing direct thread
-- authorization boundary: mode applies to new or continuing message sends.

alter table public.account_settings
  drop constraint if exists account_settings_message_permission_check;
alter table public.account_settings
  add constraint account_settings_message_permission_check
  check (message_permission in ('everyone', 'followers', 'following', 'mutuals', 'existing', 'nobody'));

create or replace function private.can_send_direct_message(
  p_conversation_id uuid,
  p_sender_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_sender_id = (select auth.uid())
    and exists (
      select 1
        from public.conversations c
        join public.conversation_participants sender
          on sender.conversation_id = c.id and sender.user_id = p_sender_id
        join public.conversation_participants recipient
          on recipient.conversation_id = c.id and recipient.user_id <> p_sender_id
        left join public.account_settings settings on settings.profile_id = recipient.user_id
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
           when 'mutuals' then exists (
             select 1 from public.follows f
              where f.follower_id = p_sender_id
                and f.following_id = recipient.user_id
                and f.status = 'accepted'
           ) and exists (
             select 1 from public.follows f
              where f.follower_id = recipient.user_id
                and f.following_id = p_sender_id
                and f.status = 'accepted'
           )
           when 'existing' then exists (
             select 1 from public.messages m
              where m.conversation_id = c.id
                and m.deleted_at is null
           )
           else false
         end
    );
$$;

revoke all on function private.can_send_direct_message(uuid, uuid) from public, anon, authenticated;
grant execute on function private.can_send_direct_message(uuid, uuid) to authenticated;

create or replace function public.open_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  conversation uuid;
  allowed boolean := false;
  permission text;
  direct_key_value text;
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
        where r.restrictor_id = p_other_user_id
          and r.restricted_id = viewer
     ) then
    raise exception 'You cannot message this account.' using errcode = '42501';
  end if;

  direct_key_value := least(viewer::text, p_other_user_id::text) || ':'
    || greatest(viewer::text, p_other_user_id::text);
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
    ))
    or (permission = 'mutuals' and exists (
      select 1 from public.follows f
       where f.follower_id = viewer and f.following_id = p_other_user_id and f.status = 'accepted'
    ) and exists (
      select 1 from public.follows f
       where f.follower_id = p_other_user_id and f.following_id = viewer and f.status = 'accepted'
    ))
    or (permission = 'existing' and exists (
      select 1
        from public.conversations c
        join public.messages m on m.conversation_id = c.id and m.deleted_at is null
       where c.kind = 'direct' and c.direct_key = direct_key_value
    ));
  if not allowed then
    raise exception 'This account only accepts messages from selected people or existing conversations.'
      using errcode = '42501';
  end if;

  insert into public.conversations (kind, direct_key)
  values ('direct', direct_key_value)
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

notify pgrst, 'reload schema';
