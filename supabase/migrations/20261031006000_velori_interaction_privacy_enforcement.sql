-- Enforce the interaction controls stored on account_settings at the database
-- boundary. Visibility of the content itself continues to be handled by its
-- existing table policies.

alter table public.account_settings
  add column if not exists like_permission text not null default 'everyone'
    check (like_permission in ('everyone', 'followers', 'nobody')),
  add column if not exists like_list_visibility text not null default 'everyone'
    check (like_list_visibility in ('everyone', 'followers', 'nobody'));

create or replace function private.viewer_meets_permission(owner uuid, permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and (
      auth.uid() = owner
      or (
        private.viewer_not_blocked(owner)
        and case coalesce(permission, 'everyone')
          when 'everyone' then true
          when 'followers' then private.viewer_is_approved_follower(owner)
          when 'following' then exists (
            select 1 from public.follows f
             where f.follower_id = owner
               and f.following_id = auth.uid()
               and f.status = 'accepted'
          )
          else false
        end
      )
    );
$$;

create or replace function private.viewer_can_see_like_list(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() = owner
    or private.viewer_meets_permission(
      owner,
      coalesce((select s.like_list_visibility from public.account_settings s where s.profile_id = owner), 'everyone')
    );
$$;

create or replace function private.viewer_can_like_content(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.viewer_not_blocked(owner)
    and coalesce((select s.allow_likes_globally from public.account_settings s where s.profile_id = owner), true)
    and private.viewer_meets_permission(
      owner,
      coalesce((select s.like_permission from public.account_settings s where s.profile_id = owner), 'everyone')
    );
$$;

create or replace function private.viewer_can_comment_content(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.viewer_not_blocked(owner)
    and coalesce((select s.allow_comments_globally from public.account_settings s where s.profile_id = owner), true)
    and private.viewer_meets_permission(
      owner,
      coalesce((select s.default_comment_permission from public.account_settings s where s.profile_id = owner), 'everyone')
    );
$$;

revoke all on function private.viewer_meets_permission(uuid, text) from public;
revoke all on function private.viewer_can_see_like_list(uuid) from public;
revoke all on function private.viewer_can_like_content(uuid) from public;
revoke all on function private.viewer_can_comment_content(uuid) from public;
grant execute on function private.viewer_meets_permission(uuid, text) to authenticated;
grant execute on function private.viewer_can_see_like_list(uuid) to authenticated;
grant execute on function private.viewer_can_like_content(uuid) to authenticated;
grant execute on function private.viewer_can_comment_content(uuid) to authenticated;

drop policy if exists "Visible likes" on public.likes;
create policy "Visible likes" on public.likes for select to authenticated
  using (
    exists (
      select 1 from public.posts p
       where p.id = likes.post_id
         and private.viewer_can_see_like_list(p.author_id)
    )
  );

drop policy if exists "Like visible posts" on public.likes;
create policy "Like visible posts" on public.likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.posts p
       where p.id = likes.post_id
         and p.allow_likes
         and private.viewer_can_like_content(p.author_id)
    )
  );

drop policy if exists "Comment on visible posts" on public.comments;
create policy "Comment on visible posts" on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
        from public.posts p
       where p.id = comments.post_id
         and p.allow_comments
         and private.viewer_can_comment_content(p.author_id)
    )
    and (
      comments.parent_id is null
      or private.comment_parent_matches_post(comments.parent_id, comments.post_id)
    )
  );

drop policy if exists "Authors insert comments on enabled reels" on public.reel_comments;
create policy "Authors insert comments on enabled reels" on public.reel_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
        from public.reels r
       where r.id = reel_comments.reel_id
         and r.allow_comments
         and private.viewer_can_comment_content(r.author_id)
    )
  );

drop policy if exists "Users like enabled reels" on public.reel_likes;
create policy "Users like enabled reels" on public.reel_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.reels r
       where r.id = reel_likes.reel_id
         and r.allow_likes
         and private.viewer_can_like_content(r.author_id)
    )
  );

drop policy if exists "Readers see likes for visible reels" on public.reel_likes;
create policy "Readers see likes for visible reels" on public.reel_likes
  for select to authenticated
  using (
    exists (
      select 1 from public.reels r
       where r.id = reel_likes.reel_id
         and private.viewer_can_see_like_list(r.author_id)
    )
  );

drop policy if exists "Users react to enabled visible stories" on public.story_likes;
create policy "Users react to enabled visible stories" on public.story_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
        from public.stories s
       where s.id = story_likes.story_id
         and s.allow_reactions
         and s.status = 'active'
         and s.expires_at > now()
         and private.viewer_can_like_content(s.author_id)
    )
  );

drop policy if exists "Readers see reactions for visible stories" on public.story_likes;
create policy "Readers see reactions for visible stories" on public.story_likes
  for select to authenticated
  using (
    exists (
      select 1 from public.stories s
       where s.id = story_likes.story_id
         and private.viewer_can_see_like_list(s.author_id)
    )
  );

do $$
begin
  if not has_function_privilege('authenticated', 'private.viewer_meets_permission(uuid,text)', 'execute')
     or not has_function_privilege('authenticated', 'private.viewer_can_see_like_list(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'private.viewer_can_like_content(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'private.viewer_can_comment_content(uuid)', 'execute') then
    raise exception 'Authenticated privacy permission helpers are not executable.';
  end if;
  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.likes'::regclass and polname = 'Like visible posts'
  ) or not exists (
    select 1 from pg_policy
     where polrelid = 'public.comments'::regclass and polname = 'Comment on visible posts'
  ) then
    raise exception 'Post interaction RLS policies are missing.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
