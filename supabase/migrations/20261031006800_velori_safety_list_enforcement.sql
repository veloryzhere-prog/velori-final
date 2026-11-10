-- Finish the account safety model: restricted comments are private to their
-- author, muted accounts' stories are hidden, and safety-list labels are
-- available only to the signed-in owner of those lists.

create or replace function private.viewer_can_read_story(p_story_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.stories s
     where s.id = p_story_id
       and s.moderation_state = 'clean'
       and (
         (s.status = 'archived' and s.author_id = (select auth.uid()))
         or (
           s.status = 'active'
           and s.expires_at > now()
           and (
             s.author_id = (select auth.uid())
             or case
               when (select auth.uid()) is null then
                 s.audience = 'public'
                 and exists (select 1 from public.profiles p where p.id = s.author_id and not p.is_private)
               else
                 public.viewer_can_see((select auth.uid()), s.author_id)
                 and not exists (
                   select 1 from public.story_hides sh
                    where sh.owner_id = (select auth.uid()) and sh.hidden_profile_id = s.author_id
                 )
                 and not exists (
                   select 1 from public.mutes m
                    where m.muter_id = (select auth.uid()) and m.muted_id = s.author_id
                      and m.hide_stories
                 )
                 and (
                   (s.audience = 'public' and (
                     not exists (select 1 from public.profiles p where p.id = s.author_id and p.is_private)
                     or exists (select 1 from public.follows f where f.follower_id = (select auth.uid())
                       and f.following_id = s.author_id and f.status = 'accepted')
                   ))
                   or (s.audience = 'followers' and exists (
                     select 1 from public.follows f where f.follower_id = (select auth.uid())
                       and f.following_id = s.author_id and f.status = 'accepted'
                   ))
                   or (s.audience = 'close_friends' and public.viewer_is_close_friend(s.author_id, (select auth.uid())))
                 )
             end
           )
         )
       )
  );
$$;

revoke all on function private.viewer_can_read_story(uuid) from public;
grant execute on function private.viewer_can_read_story(uuid) to anon, authenticated;

create or replace function public.my_safety_lists()
returns table (list_name text, target_id uuid, username text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'blocks'::text, b.blocked_id, p.username
    from public.blocks b join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = (select auth.uid())
  union all
  select 'mutes'::text, m.muted_id, p.username
    from public.mutes m join public.profiles p on p.id = m.muted_id
   where m.muter_id = (select auth.uid())
  union all
  select 'restrictions'::text, r.restricted_id, p.username
    from public.restrictions r join public.profiles p on p.id = r.restricted_id
   where r.restrictor_id = (select auth.uid());
$$;

revoke all on function public.my_safety_lists() from public, anon;
grant execute on function public.my_safety_lists() to authenticated;
