-- A small read-only capability check lets profile surfaces avoid presenting a
-- message action that the transactional RPC would reject.

create or replace function public.can_message_profile(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_other_user_id is not null
    and p_other_user_id <> auth.uid()
    and exists (
      select 1 from public.profiles target
      left join public.account_settings settings on settings.profile_id = target.id
      where target.id = p_other_user_id
        and not private.blocked_between(auth.uid(), target.id)
        and not exists (
          select 1 from public.restrictions r
           where r.restrictor_id = target.id
             and r.restricted_id = auth.uid()
        )
        and case coalesce(settings.message_permission, 'followers')
          when 'everyone' then true
          when 'followers' then exists (
            select 1 from public.follows f
             where f.follower_id = auth.uid()
               and f.following_id = target.id
               and f.status = 'accepted'
          )
          when 'following' then exists (
            select 1 from public.follows f
             where f.follower_id = target.id
               and f.following_id = auth.uid()
               and f.status = 'accepted'
          )
          when 'mutuals' then exists (
            select 1 from public.follows f
             where f.follower_id = auth.uid()
               and f.following_id = target.id
               and f.status = 'accepted'
          ) and exists (
            select 1 from public.follows f
             where f.follower_id = target.id
               and f.following_id = auth.uid()
               and f.status = 'accepted'
          )
          when 'existing' then exists (
            select 1
              from public.conversations c
              join public.messages m on m.conversation_id = c.id and m.deleted_at is null
             where c.kind = 'direct'
               and c.direct_key = least(auth.uid()::text, target.id::text) || ':'
                 || greatest(auth.uid()::text, target.id::text)
          )
          else false
        end
    );
$$;

revoke all on function public.can_message_profile(uuid) from public, anon;
grant execute on function public.can_message_profile(uuid) to authenticated;
