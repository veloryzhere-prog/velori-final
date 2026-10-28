-- Separate public and administrator navigation, then enforce social parent
-- visibility for child records. This migration is repeatable so it also repairs
-- databases where the earlier product-infrastructure migration was run manually.

alter table public.navigation_items
  add column if not exists navigation_scope text not null default 'public';

alter table public.navigation_items
  drop constraint if exists navigation_items_navigation_scope_check;

alter table public.navigation_items
  add constraint navigation_items_navigation_scope_check
  check (navigation_scope in ('public', 'admin'));

alter table public.stories
  drop constraint if exists stories_audience_check;
alter table public.stories
  add constraint stories_audience_check
  check (audience in ('public', 'followers', 'close_friends', 'private'));

alter table public.story_settings
  drop constraint if exists story_settings_audience_check;
alter table public.story_settings
  add constraint story_settings_audience_check
  check (audience in ('public', 'followers', 'close_friends', 'private'));

create or replace function public.viewer_is_close_friend(p_owner_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_viewer_id = auth.uid()
    and p_viewer_id is not null
    and exists (
    select 1 from public.close_friends cf
     where cf.owner_id = p_owner_id
       and cf.friend_id = p_viewer_id
  );
$$;
revoke all on function public.viewer_is_close_friend(uuid, uuid) from public, anon;
grant execute on function public.viewer_is_close_friend(uuid, uuid) to authenticated;

-- Migration 120 seeded /admin links into the same table that the public shell
-- reads. Reclassify them before exposing the public rows under the new policy.
update public.navigation_items
   set navigation_scope = case when route = '/admin' or route like '/admin/%' then 'admin' else 'public' end
 where navigation_scope is distinct from case when route = '/admin' or route like '/admin/%' then 'admin' else 'public' end;

create index if not exists navigation_items_scope_position_idx
  on public.navigation_items (navigation_scope, position, visible);

drop policy if exists "Public reads public navigation" on public.navigation_items;
drop policy if exists "Signed-in reads role navigation" on public.navigation_items;

create policy "Public reads public navigation" on public.navigation_items
  for select to anon
  using (navigation_scope = 'public' and visible and required_role = 'all');

create policy "Signed-in reads public navigation" on public.navigation_items
  for select to authenticated
  using (navigation_scope = 'public' and visible and required_role = 'all');

-- Reels and stories are readable only when the parent item is readable. Never
-- make a private media row public just because its own table has an open policy.
drop policy if exists "Public reads published reels" on public.reels;
drop policy if exists "Authors read own reels" on public.reels;
drop policy if exists "Readers see visible reels" on public.reels;
create policy "Readers see visible reels" on public.reels
  for select to anon, authenticated
  using (
    status = 'published'
    and is_deleted = false
    and (
      author_id = auth.uid()
      or case
        when auth.uid() is null then
          visibility = 'public'
          and exists (select 1 from public.profiles p where p.id = reels.author_id and not p.is_private)
        else
          public.viewer_can_see(auth.uid(), reels.author_id)
          and (
            visibility = 'public'
            or exists (
              select 1 from public.follows f
               where f.follower_id = auth.uid()
                 and f.following_id = reels.author_id
                 and f.status = 'accepted'
            )
          )
          and (
            not exists (select 1 from public.profiles p where p.id = reels.author_id and p.is_private)
            or exists (
              select 1 from public.follows f
               where f.follower_id = auth.uid()
                 and f.following_id = reels.author_id
                 and f.status = 'accepted'
            )
          )
        end
    )
  );

create policy "Authors read own reels" on public.reels
  for select to authenticated
  using (author_id = auth.uid());

drop policy if exists "Public reads reel media" on public.reel_media;
drop policy if exists "Readers see media for visible reels" on public.reel_media;
create policy "Readers see media for visible reels" on public.reel_media
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.reels r
       where r.id = reel_media.reel_id
    )
  );

drop policy if exists "Readers see reel comments" on public.reel_comments;
drop policy if exists "Readers see comments for visible reels" on public.reel_comments;
create policy "Readers see comments for visible reels" on public.reel_comments
  for select to anon, authenticated
  using (
    not is_hidden
    and exists (
      select 1 from public.reels r
       where r.id = reel_comments.reel_id
    )
  );

drop policy if exists "Authors manage reel comments" on public.reel_comments;
drop policy if exists "Authors insert comments on enabled reels" on public.reel_comments;
drop policy if exists "Authors update own reel comments" on public.reel_comments;
drop policy if exists "Authors delete own reel comments" on public.reel_comments;
create policy "Authors insert comments on enabled reels" on public.reel_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.reels r
       where r.id = reel_comments.reel_id
         and r.allow_comments
    )
  );
create policy "Authors update own reel comments" on public.reel_comments
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
create policy "Authors delete own reel comments" on public.reel_comments
  for delete to authenticated
  using (author_id = auth.uid());

drop policy if exists "Users like reels" on public.reel_likes;
drop policy if exists "Users read own reel likes" on public.reel_likes;
drop policy if exists "Users like enabled reels" on public.reel_likes;
drop policy if exists "Users remove own reel likes" on public.reel_likes;
create policy "Users read own reel likes" on public.reel_likes
  for select to authenticated
  using (user_id = auth.uid());
create policy "Users like enabled reels" on public.reel_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.reels r
       where r.id = reel_likes.reel_id
         and r.allow_likes
    )
  );
create policy "Users remove own reel likes" on public.reel_likes
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Public reads active stories" on public.stories;
drop policy if exists "Readers see active stories" on public.stories;
create policy "Readers see active stories" on public.stories
  for select to anon, authenticated
  using (
    status = 'active'
    and expires_at > now()
    and (
      author_id = auth.uid()
      or case
        when auth.uid() is null then
          audience = 'public'
          and exists (select 1 from public.profiles p where p.id = stories.author_id and not p.is_private)
        else
          public.viewer_can_see(auth.uid(), stories.author_id)
          and not exists (
            select 1 from public.story_hides sh
             where sh.owner_id = auth.uid()
               and sh.hidden_profile_id = stories.author_id
          )
          and (
            audience = 'public'
            or (
              audience = 'followers'
              and exists (
                select 1 from public.follows f
                 where f.follower_id = auth.uid()
                   and f.following_id = stories.author_id
                   and f.status = 'accepted'
              )
            )
            or (
              audience = 'close_friends'
              and public.viewer_is_close_friend(stories.author_id, auth.uid())
            )
          )
          and (
            not exists (select 1 from public.profiles p where p.id = stories.author_id and p.is_private)
            or exists (
              select 1 from public.follows f
               where f.follower_id = auth.uid()
                 and f.following_id = stories.author_id
                 and f.status = 'accepted'
            )
            or audience = 'private'
          )
        end
    )
  );

drop policy if exists "Readers see story media" on public.story_media;
drop policy if exists "Readers see media for visible stories" on public.story_media;
create policy "Readers see media for visible stories" on public.story_media
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.stories s
       where s.id = story_media.story_id
    )
  );

drop policy if exists "Readers see story replies" on public.story_replies;
drop policy if exists "Readers see replies for visible stories" on public.story_replies;
create policy "Readers see replies for visible stories" on public.story_replies
  for select to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.stories s
       where s.id = story_replies.story_id
    )
  );

drop policy if exists "Authors manage story replies" on public.story_replies;
drop policy if exists "Users reply to reply-enabled stories" on public.story_replies;
drop policy if exists "Authors update own story replies" on public.story_replies;
drop policy if exists "Authors delete own story replies" on public.story_replies;
create policy "Users reply to reply-enabled stories" on public.story_replies
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.stories s
       where s.id = story_replies.story_id
         and s.allow_replies
         and exists (
           select 1 from public.account_settings settings
            where settings.profile_id = s.author_id
              and (
                settings.story_reply_permission = 'everyone'
                or (
                  settings.story_reply_permission = 'followers'
                  and exists (
                    select 1 from public.follows f
                     where f.follower_id = auth.uid()
                       and f.following_id = s.author_id
                       and f.status = 'accepted'
                  )
                )
                or (
                  settings.story_reply_permission = 'close_friends'
                  and public.viewer_is_close_friend(s.author_id, auth.uid())
                )
              )
         )
    )
  );
create policy "Authors update own story replies" on public.story_replies
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
create policy "Authors delete own story replies" on public.story_replies
  for delete to authenticated
  using (author_id = auth.uid());

drop policy if exists "Users read own or own-story views" on public.story_views;
drop policy if exists "Users record story views" on public.story_views;
drop policy if exists "Users record visible story views" on public.story_views;
create policy "Users read own or own-story views" on public.story_views
  for select to authenticated
  using (
    viewer_id = auth.uid()
    or exists (
      select 1 from public.stories s
       where s.id = story_views.story_id
         and s.author_id = auth.uid()
    )
  );

drop policy if exists "Users record story views" on public.story_views;
create policy "Users record visible story views" on public.story_views
  for insert to authenticated
  with check (
    viewer_id = auth.uid()
    and exists (select 1 from public.stories s where s.id = story_views.story_id)
  );

-- Notifications are server-generated. Clients may only mark their own item
-- read; they cannot forge, retarget, or delete notifications from the browser.
revoke insert, delete on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "Users mark own notifications read" on public.notifications;
create policy "Users mark own notifications read" on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- In-app notifications are emitted by database events rather than browser
-- inserts, so clients cannot spoof an actor or target another recipient.
create or replace function public.enqueue_social_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_link text,
  p_entity_type text,
  p_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  enabled boolean := true;
begin
  if p_recipient_id is null or p_actor_id is null or p_recipient_id = p_actor_id then
    return;
  end if;

  select case p_kind
    when 'like' then coalesce(preferences.likes, true)
    when 'comment' then coalesce(preferences.comments, true)
    when 'reply' then coalesce(preferences.replies, true)
    when 'follow' then coalesce(preferences.follows, true)
    when 'follow_request' then coalesce(preferences.follows, true)
    when 'story_reply' then coalesce(preferences.stories, true)
    when 'reel_interaction' then coalesce(preferences.reels, true)
    else coalesce(preferences.system, true)
  end
    into enabled
    from public.notification_preferences preferences
   where preferences.profile_id = p_recipient_id;

  if not coalesce(enabled, true) then
    return;
  end if;

  insert into public.notifications (
    recipient_id, actor_id, kind, title, body, link, entity_type, entity_id
  ) values (
    p_recipient_id, p_actor_id, p_kind, left(p_title, 160), left(p_body, 2000),
    left(p_link, 300), p_entity_type, p_entity_id
  );
end;
$$;
revoke all on function public.enqueue_social_notification(uuid, uuid, text, text, text, text, text, uuid)
  from public, anon, authenticated;

create or replace function public.notify_social_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  actor uuid;
  kind text;
  title text;
  body text;
  link text;
  entity_type text;
  entity_id uuid;
  post_owner uuid;
  parent_owner uuid;
  owner_name text;
begin
  if tg_table_name = 'likes' then
    actor := new.user_id;
    entity_type := 'post';
    entity_id := new.post_id;
    select p.author_id into recipient from public.posts p where p.id = new.post_id;
    if recipient is not null and actor <> recipient then
      perform public.enqueue_social_notification(recipient, actor, 'like', 'New like',
        'Someone liked your post.', '/post/' || new.post_id::text, entity_type, entity_id);
    end if;
    return new;
  elsif tg_table_name = 'comments' then
    actor := new.author_id;
    entity_type := 'comment';
    entity_id := new.id;
    select p.author_id into post_owner from public.posts p where p.id = new.post_id;
    link := '/post/' || new.post_id::text || '?comment=' || new.id::text;
    if new.parent_id is not null then
      select c.author_id into parent_owner from public.comments c where c.id = new.parent_id;
      if parent_owner is not null and parent_owner <> actor then
        perform public.enqueue_social_notification(parent_owner, actor, 'reply', 'New reply',
          left(new.body, 180), link, entity_type, entity_id);
      end if;
    end if;
    if post_owner is not null and post_owner <> actor and post_owner is distinct from parent_owner then
      kind := case when new.parent_id is null then 'comment' else 'reply' end;
      title := case when new.parent_id is null then 'New comment' else 'New reply on your post' end;
      perform public.enqueue_social_notification(post_owner, actor, kind, title,
        left(new.body, 180), link, entity_type, entity_id);
    end if;
    return new;
  elsif tg_table_name = 'follows' then
    if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
      recipient := new.follower_id;
      actor := new.following_id;
      kind := 'follow';
      title := 'Follow request accepted';
      body := 'Your follow request was accepted.';
    elsif tg_op = 'INSERT' then
      recipient := new.following_id;
      actor := new.follower_id;
      kind := case when new.status = 'pending' then 'follow_request' else 'follow' end;
      title := case when new.status = 'pending' then 'New follow request' else 'New follower' end;
      body := case when new.status = 'pending' then 'Someone requested to follow you.' else 'Someone followed you.' end;
    else
      return new;
    end if;
    select p.username into owner_name from public.profiles p where p.id = actor;
    perform public.enqueue_social_notification(recipient, actor, kind, title,
      body, '/profile/' || coalesce(owner_name, ''), 'profile', actor);
    return new;
  elsif tg_table_name = 'reel_likes' then
    actor := new.user_id;
    entity_type := 'reel';
    entity_id := new.reel_id;
    select r.author_id into recipient from public.reels r where r.id = new.reel_id;
    if recipient is not null and actor <> recipient then
      perform public.enqueue_social_notification(recipient, actor, 'reel_interaction', 'Reel activity',
        'Someone liked your reel.', '/reels?id=' || new.reel_id::text, entity_type, entity_id);
    end if;
    return new;
  elsif tg_table_name = 'reel_comments' then
    actor := new.author_id;
    entity_type := 'reel';
    entity_id := new.reel_id;
    select r.author_id into recipient from public.reels r where r.id = new.reel_id;
    if recipient is not null and actor <> recipient then
      perform public.enqueue_social_notification(recipient, actor, 'reel_interaction', 'Reel activity',
        left(new.body, 180), '/reels?id=' || new.reel_id::text, entity_type, entity_id);
    end if;
    return new;
  elsif tg_table_name = 'story_replies' then
    actor := new.author_id;
    entity_type := 'story';
    entity_id := new.story_id;
    select s.author_id into recipient from public.stories s where s.id = new.story_id;
    if recipient is not null and actor <> recipient then
      perform public.enqueue_social_notification(recipient, actor, 'story_reply', 'Story reply',
        left(new.body, 180), '/stories?id=' || new.story_id::text, entity_type, entity_id);
    end if;
    return new;
  end if;
  return new;
end;
$$;
revoke all on function public.notify_social_event() from public, anon, authenticated;

drop trigger if exists notify_post_like on public.likes;
create trigger notify_post_like after insert on public.likes
  for each row execute function public.notify_social_event();
drop trigger if exists notify_post_comment on public.comments;
create trigger notify_post_comment after insert on public.comments
  for each row execute function public.notify_social_event();
drop trigger if exists notify_follow_event on public.follows;
create trigger notify_follow_event after insert or update of status on public.follows
  for each row execute function public.notify_social_event();
drop trigger if exists notify_reel_like on public.reel_likes;
create trigger notify_reel_like after insert on public.reel_likes
  for each row execute function public.notify_social_event();
drop trigger if exists notify_reel_comment on public.reel_comments;
create trigger notify_reel_comment after insert on public.reel_comments
  for each row execute function public.notify_social_event();
drop trigger if exists notify_story_reply on public.story_replies;
create trigger notify_story_reply after insert on public.story_replies
  for each row execute function public.notify_social_event();

-- The preceding migration deliberately left browser roles without table grants.
-- Grant only the operations supported by the owner-scoped policies above.
grant select on public.reels, public.reel_media, public.reel_comments, public.stories, public.story_media
  to anon, authenticated;
grant insert, update, delete on public.reels, public.reel_media, public.reel_comments, public.stories, public.story_media
  to authenticated;
grant select, insert, update, delete on public.reel_drafts to authenticated;
grant select, insert, delete on public.reel_likes, public.reel_saves to authenticated;
grant select, insert on public.reel_reports, public.story_reports to authenticated;
grant select, insert, update on public.reel_settings, public.story_settings,
  public.notification_preferences to authenticated;
grant select, insert on public.story_views to authenticated;
grant select, insert, update, delete on public.story_replies to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant all on public.reels, public.reel_media, public.reel_drafts, public.reel_likes,
  public.reel_saves, public.reel_comments, public.reel_reports, public.reel_settings,
  public.stories, public.story_media, public.story_views, public.story_replies,
  public.story_reports, public.story_settings, public.notifications,
  public.notification_preferences to service_role;

