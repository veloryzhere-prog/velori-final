-- Enforce parent-content visibility when readers access private story/reel
-- media. The former policies only checked that a parent row existed, allowing
-- signed URLs for private content to be minted by unrelated readers.

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
                 and exists (
                   select 1 from public.profiles p
                    where p.id = s.author_id and not p.is_private
                 )
               else
                 public.viewer_can_see((select auth.uid()), s.author_id)
                 and not exists (
                   select 1 from public.story_hides sh
                    where sh.owner_id = (select auth.uid())
                      and sh.hidden_profile_id = s.author_id
                 )
                 and (
                   (
                     s.audience = 'public'
                     and (
                       not exists (
                         select 1 from public.profiles p
                          where p.id = s.author_id and p.is_private
                       )
                       or exists (
                         select 1 from public.follows f
                          where f.follower_id = (select auth.uid())
                            and f.following_id = s.author_id
                            and f.status = 'accepted'
                       )
                     )
                   )
                   or (
                     s.audience = 'followers'
                     and exists (
                       select 1 from public.follows f
                        where f.follower_id = (select auth.uid())
                          and f.following_id = s.author_id
                          and f.status = 'accepted'
                     )
                   )
                   or (
                     s.audience = 'close_friends'
                     and public.viewer_is_close_friend(s.author_id, (select auth.uid()))
                   )
                 )
             end
           )
         )
       )
  );
$$;

create or replace function private.viewer_can_read_story_media_path(p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.story_media sm
     where sm.object_path = p_object_path
       and private.viewer_can_read_story(sm.story_id)
  );
$$;

create or replace function private.viewer_can_read_reel_media_path(p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.reel_media rm
      join public.reels r on r.id = rm.reel_id
     where rm.object_path = p_object_path
       and r.moderation_state = 'clean'
       and (
         r.author_id = (select auth.uid())
         or (
           r.status = 'published'
           and not r.is_deleted
           and (r.expires_at is null or r.expires_at > now())
           and case
             when (select auth.uid()) is null then
               r.visibility = 'public'
               and exists (
                 select 1 from public.profiles p
                  where p.id = r.author_id and not p.is_private
               )
             else
               public.viewer_can_see((select auth.uid()), r.author_id)
               and (
                 (
                   r.visibility = 'public'
                   and (
                     not exists (
                       select 1 from public.profiles p
                        where p.id = r.author_id and p.is_private
                     )
                     or exists (
                       select 1 from public.follows f
                        where f.follower_id = (select auth.uid())
                          and f.following_id = r.author_id
                          and f.status = 'accepted'
                     )
                   )
                 )
                 or (
                   r.visibility = 'followers'
                   and exists (
                     select 1 from public.follows f
                      where f.follower_id = (select auth.uid())
                        and f.following_id = r.author_id
                        and f.status = 'accepted'
                   )
                 )
               )
           end
         )
       )
  );
$$;

revoke all on function private.viewer_can_read_story(uuid) from public;
revoke all on function private.viewer_can_read_story_media_path(text) from public;
revoke all on function private.viewer_can_read_reel_media_path(text) from public;
grant execute on function private.viewer_can_read_story(uuid) to anon, authenticated;
grant execute on function private.viewer_can_read_story_media_path(text) to anon, authenticated;
grant execute on function private.viewer_can_read_reel_media_path(text) to anon, authenticated;

drop policy if exists "Readers see media for visible stories" on public.story_media;
create policy "Readers see media for visible stories" on public.story_media
  for select to anon, authenticated
  using (private.viewer_can_read_story(story_id));

drop policy if exists "Readers see media for visible reels" on public.reel_media;
create policy "Readers see media for visible reels" on public.reel_media
  for select to anon, authenticated
  using (private.viewer_can_read_reel_media_path(object_path));

drop policy if exists "Readers download visible story media" on storage.objects;
create policy "Readers download visible story media" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'story-media'
    and private.viewer_can_read_story_media_path(name)
  );

drop policy if exists "Readers download visible reel media" on storage.objects;
create policy "Readers download visible reel media" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'reel-media'
    and private.viewer_can_read_reel_media_path(name)
  );

comment on function private.viewer_can_read_story(uuid) is
  'RLS gate applying the deployed story audience, profile privacy, blocking/hiding, moderation, and expiry rules.';
