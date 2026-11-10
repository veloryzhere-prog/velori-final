-- Complete the missing interaction paths while keeping the existing post and
-- reel tables authoritative. Story reactions had no persisted table, and
-- comment likes had no common model for post/reel comments.

create table if not exists public.story_likes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_comment_id uuid references public.comments(id) on delete cascade,
  reel_comment_id uuid references public.reel_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint comment_likes_one_target check (
    (post_comment_id is not null)::integer + (reel_comment_id is not null)::integer = 1
  )
);

create unique index if not exists comment_likes_post_actor_unique
  on public.comment_likes(user_id, post_comment_id) where post_comment_id is not null;
create unique index if not exists comment_likes_reel_actor_unique
  on public.comment_likes(user_id, reel_comment_id) where reel_comment_id is not null;
create index if not exists comment_likes_post_target_idx
  on public.comment_likes(post_comment_id, created_at desc) where post_comment_id is not null;
create index if not exists comment_likes_reel_target_idx
  on public.comment_likes(reel_comment_id, created_at desc) where reel_comment_id is not null;

-- Realtime DELETE payloads need the content and actor IDs so clients can
-- reconcile a specific counter without refetching every item in a feed.
alter table public.comments replica identity full;
alter table public.reel_comments replica identity full;
alter table public.comment_likes replica identity full;

alter table public.story_likes enable row level security;
alter table public.comment_likes enable row level security;

-- Reel likes previously had an owner-only SELECT policy, which made every
-- public count and liked-by list silently return only the current viewer's row.
drop policy if exists "Users read own reel likes" on public.reel_likes;
drop policy if exists "Readers see likes for visible reels" on public.reel_likes;
create policy "Readers see likes for visible reels" on public.reel_likes
  for select to authenticated
  using (exists (select 1 from public.reels r where r.id = reel_likes.reel_id));

drop policy if exists "Readers see reactions for visible stories" on public.story_likes;
create policy "Readers see reactions for visible stories" on public.story_likes
  for select to authenticated
  using (exists (select 1 from public.stories s where s.id = story_likes.story_id));

drop policy if exists "Users react to enabled visible stories" on public.story_likes;
create policy "Users react to enabled visible stories" on public.story_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
       where s.id = story_likes.story_id
         and s.allow_reactions
         and s.status = 'active'
         and s.expires_at > now()
    )
  );

drop policy if exists "Users remove own story reactions" on public.story_likes;
create policy "Users remove own story reactions" on public.story_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Readers see likes for visible comments" on public.comment_likes;
create policy "Readers see likes for visible comments" on public.comment_likes
  for select to authenticated
  using (
    (post_comment_id is not null and exists (
      select 1 from public.comments c where c.id = comment_likes.post_comment_id
    ))
    or
    (reel_comment_id is not null and exists (
      select 1 from public.reel_comments c where c.id = comment_likes.reel_comment_id
    ))
  );

drop policy if exists "Users like visible comments" on public.comment_likes;
create policy "Users like visible comments" on public.comment_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (post_comment_id is not null and exists (
        select 1 from public.comments c where c.id = comment_likes.post_comment_id
      ))
      or
      (reel_comment_id is not null and exists (
        select 1 from public.reel_comments c where c.id = comment_likes.reel_comment_id
      ))
    )
  );

drop policy if exists "Users remove own comment likes" on public.comment_likes;
create policy "Users remove own comment likes" on public.comment_likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.story_likes, public.comment_likes from public, anon, authenticated;
grant select, insert, delete on public.story_likes, public.comment_likes to authenticated;
grant all on public.story_likes, public.comment_likes to service_role;

-- Report content through the same moderated queue used by the admin console.
-- The security-definer boundary validates that the reporter can access the
-- target before inserting a row into the service-managed report table.
create or replace function public.report_social_content(
  p_target_type text,
  p_target_id uuid,
  p_category text default 'other',
  p_reason text default ''
)
returns table(report_id uuid, already_reported boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  content_owner uuid;
  target_author uuid;
  report_uuid uuid;
  target_found boolean := false;
  report_category text := coalesce(nullif(p_category, ''), 'other');
  report_reason text := coalesce(p_reason, '');
begin
  if viewer is null then
    raise exception 'Sign in to report content.' using errcode = '42501';
  end if;
  if p_target_id is null or p_target_type is null or p_target_type not in ('post', 'comment', 'story', 'reel') then
    raise exception 'That content cannot be reported.' using errcode = '22023';
  end if;
  if report_category not in ('spam', 'harassment', 'impersonation', 'hate', 'dangerous', 'copyright', 'privacy', 'scam', 'fake_account', 'other')
     or char_length(report_reason) > 2000 then
    raise exception 'Check the report category and reason.' using errcode = '22023';
  end if;

  if p_target_type = 'post' then
    select p.author_id into content_owner
      from public.posts p
     where p.id = p_target_id
       and p.is_published
       and p.archived_at is null
       and p.deleted_at is null
       and (p.delete_expires_at is null or p.delete_expires_at > now())
       and private.viewer_not_blocked(p.author_id)
       and exists (
         select 1 from public.profiles profile
          where profile.id = p.author_id
            and (
              (p.visibility = 'public' and (not profile.is_private or exists (
                select 1 from public.follows f
                 where f.follower_id = viewer and f.following_id = p.author_id and f.status = 'accepted'
              )))
              or (p.visibility = 'followers' and exists (
                select 1 from public.follows f
                 where f.follower_id = viewer and f.following_id = p.author_id and f.status = 'accepted'
              ))
            )
       );
    target_found := found;
    target_author := content_owner;
  elsif p_target_type = 'story' then
    select s.author_id into content_owner
      from public.stories s
     where s.id = p_target_id
       and s.status = 'active'
       and s.expires_at > now()
       and s.audience in ('public', 'followers', 'close_friends')
       and (
         s.audience = 'public'
         or (s.audience = 'followers' and exists (
           select 1 from public.follows f
            where f.follower_id = viewer and f.following_id = s.author_id and f.status = 'accepted'
         ))
         or (s.audience = 'close_friends' and public.viewer_is_close_friend(s.author_id, viewer))
       )
       and public.viewer_can_see(viewer, s.author_id)
       and (
         not exists (select 1 from public.profiles profile where profile.id = s.author_id and profile.is_private)
         or exists (
           select 1 from public.follows f
            where f.follower_id = viewer and f.following_id = s.author_id and f.status = 'accepted'
         )
       )
       and not exists (
         select 1 from public.story_hides sh
          where sh.owner_id = viewer and sh.hidden_profile_id = s.author_id
       );
    target_found := found;
    target_author := content_owner;
  elsif p_target_type = 'reel' then
    select r.author_id into content_owner
      from public.reels r
     where r.id = p_target_id
       and r.status = 'published'
       and not r.is_deleted
       and r.moderation_state = 'clean'
       and public.viewer_can_see(viewer, r.author_id)
       and (
         not exists (select 1 from public.profiles profile where profile.id = r.author_id and profile.is_private)
         or exists (
           select 1 from public.follows f
            where f.follower_id = viewer and f.following_id = r.author_id and f.status = 'accepted'
         )
       )
       and (
         r.visibility = 'public'
         or exists (
           select 1 from public.follows f
            where f.follower_id = viewer and f.following_id = r.author_id and f.status = 'accepted'
         )
       );
    target_found := found;
    target_author := content_owner;
  else
    select p.author_id, c.author_id into content_owner, target_author
      from public.comments c
      join public.posts p on p.id = c.post_id
     where c.id = p_target_id
       and not c.is_hidden
       and p.is_published
       and p.archived_at is null
       and p.deleted_at is null
       and (p.delete_expires_at is null or p.delete_expires_at > now())
       and private.viewer_not_blocked(p.author_id)
       and exists (
         select 1 from public.profiles profile
          where profile.id = p.author_id
            and (
              (p.visibility = 'public' and (not profile.is_private or exists (
                select 1 from public.follows f
                 where f.follower_id = viewer and f.following_id = p.author_id and f.status = 'accepted'
              )))
              or (p.visibility = 'followers' and exists (
                select 1 from public.follows f
                 where f.follower_id = viewer and f.following_id = p.author_id and f.status = 'accepted'
              ))
            )
       );
    target_found := found;
    if not target_found then
      select r.author_id, c.author_id into content_owner, target_author
        from public.reel_comments c
        join public.reels r on r.id = c.reel_id
       where c.id = p_target_id
         and not c.is_hidden
         and r.status = 'published'
         and not r.is_deleted
         and r.moderation_state = 'clean'
         and public.viewer_can_see(viewer, r.author_id)
         and (
           not exists (select 1 from public.profiles profile where profile.id = r.author_id and profile.is_private)
           or exists (
             select 1 from public.follows f
              where f.follower_id = viewer and f.following_id = r.author_id and f.status = 'accepted'
           )
         )
         and (
           r.visibility = 'public'
           or exists (
             select 1 from public.follows f
              where f.follower_id = viewer and f.following_id = r.author_id and f.status = 'accepted'
           )
         );
      target_found := found;
    end if;
  end if;

  if not target_found or content_owner = viewer or target_author = viewer then
    raise exception 'That content is unavailable for reporting.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(viewer::text || ':' || p_target_type || ':' || p_target_id::text, 0));
  select cr.id into report_uuid
    from public.content_reports cr
   where cr.reporter_id = viewer
     and cr.target_type = p_target_type
     and cr.target_id = p_target_id
   limit 1;
  if report_uuid is not null then
    return query select report_uuid, true;
    return;
  end if;

  insert into public.content_reports(target_type, target_id, reporter_id, category, reason)
  values (p_target_type, p_target_id, viewer, report_category, report_reason)
  returning id into report_uuid;
  return query select report_uuid, false;
end;
$$;
revoke all on function public.report_social_content(text, uuid, text, text) from public, anon;
grant execute on function public.report_social_content(text, uuid, text, text) to authenticated;

create or replace function public.get_social_comment_counts(
  p_post_comment_ids uuid[] default array[]::uuid[],
  p_reel_comment_ids uuid[] default array[]::uuid[]
)
returns table(target_type text, comment_id uuid, like_count bigint, reply_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'post'::text, c.id,
         count(distinct likes.id), count(distinct replies.id)
    from public.comments c
    left join public.comment_likes likes on likes.post_comment_id = c.id
    left join public.comments replies on replies.parent_id = c.id
   where c.id = any(coalesce(p_post_comment_ids, array[]::uuid[]))
   group by c.id
  union all
  select 'reel'::text, c.id,
         count(distinct likes.id), count(distinct replies.id)
    from public.reel_comments c
    left join public.comment_likes likes on likes.reel_comment_id = c.id
    left join public.reel_comments replies on replies.parent_id = c.id
   where c.id = any(coalesce(p_reel_comment_ids, array[]::uuid[]))
   group by c.id;
$$;
revoke all on function public.get_social_comment_counts(uuid[], uuid[]) from public, anon;
grant execute on function public.get_social_comment_counts(uuid[], uuid[]) to authenticated;

create or replace function public.get_post_engagement_counts(p_post_ids uuid[])
returns table(post_id uuid, like_count bigint, comment_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id,
         case when not p.hide_like_count or p.author_id = (select auth.uid())
              then (select count(*) from public.likes l where l.post_id = p.id)
              else null::bigint end,
         (select count(*) from public.comments c where c.post_id = p.id)
    from public.posts p
   where p.id = any(coalesce(p_post_ids, array[]::uuid[]));
$$;
revoke all on function public.get_post_engagement_counts(uuid[]) from public;
grant execute on function public.get_post_engagement_counts(uuid[]) to anon, authenticated;

-- Story and comment reactions respect the recipient's existing preferences.
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
    when 'story_reaction' then coalesce(preferences.stories, true)
    when 'reel_interaction' then coalesce(preferences.reels, true)
    else coalesce(preferences.system, true)
  end into enabled
    from public.notification_preferences preferences
   where preferences.profile_id = p_recipient_id;

  if not coalesce(enabled, true) then return; end if;

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

create or replace function public.notify_story_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  select s.author_id into owner_id from public.stories s where s.id = new.story_id;
  if owner_id is not null and owner_id <> new.user_id then
    perform public.enqueue_social_notification(
      owner_id, new.user_id, 'story_reaction', 'Story liked',
      'Someone liked your story.', '/stories?story=' || new.story_id::text,
      'story', new.story_id
    );
  end if;
  return new;
end;
$$;
revoke all on function public.notify_story_like() from public, anon, authenticated;
drop trigger if exists notify_story_like on public.story_likes;
create trigger notify_story_like after insert on public.story_likes
  for each row execute function public.notify_story_like();

create or replace function public.notify_reel_like_exact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  select r.author_id into owner_id from public.reels r where r.id = new.reel_id;
  if owner_id is not null and owner_id <> new.user_id then
    perform public.enqueue_social_notification(
      owner_id, new.user_id, 'reel_interaction', 'Reel liked',
      'Someone liked your reel.', '/reels?reel=' || new.reel_id::text,
      'reel', new.reel_id
    );
  end if;
  return new;
end;
$$;
revoke all on function public.notify_reel_like_exact() from public, anon, authenticated;
drop trigger if exists notify_reel_like on public.reel_likes;
create trigger notify_reel_like after insert on public.reel_likes
  for each row execute function public.notify_reel_like_exact();

create or replace function public.notify_comment_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  destination text;
  target_id uuid;
begin
  if new.post_comment_id is not null then
    select c.author_id, '/post/' || c.post_id::text || '?comment=' || c.id::text, c.id
      into recipient, destination, target_id
      from public.comments c where c.id = new.post_comment_id;
  else
    select c.author_id, '/reels?reel=' || c.reel_id::text || '&comment=' || c.id::text, c.id
      into recipient, destination, target_id
      from public.reel_comments c where c.id = new.reel_comment_id;
  end if;
  if recipient is not null and recipient <> new.user_id then
    perform public.enqueue_social_notification(
      recipient, new.user_id, 'like', 'Comment liked',
      'Someone liked your comment.', destination, 'comment', target_id
    );
  end if;
  return new;
end;
$$;
revoke all on function public.notify_comment_like() from public, anon, authenticated;
drop trigger if exists notify_comment_like on public.comment_likes;
create trigger notify_comment_like after insert on public.comment_likes
  for each row execute function public.notify_comment_like();

-- Correct deep links for new reel and story replies; the page reads `reel` and
-- `story` query parameters, not the legacy `id` parameter.
create or replace function public.notify_reel_comment_exact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  parent_owner uuid;
  target_link text;
begin
  select r.author_id into owner_id from public.reels r where r.id = new.reel_id;
  target_link := '/reels?reel=' || new.reel_id::text || '&comment=' || new.id::text;
  if new.parent_id is not null then
    select c.author_id into parent_owner from public.reel_comments c where c.id = new.parent_id;
    if parent_owner is not null and parent_owner <> new.author_id then
      perform public.enqueue_social_notification(
        parent_owner, new.author_id, 'reply', 'New reel reply', left(new.body, 180),
        target_link, 'reel', new.reel_id
      );
    end if;
  end if;
  if owner_id is not null and owner_id <> new.author_id and owner_id is distinct from parent_owner then
    perform public.enqueue_social_notification(
      owner_id, new.author_id, case when new.parent_id is null then 'comment' else 'reply' end,
      case when new.parent_id is null then 'New reel comment' else 'New reply on your reel' end,
      left(new.body, 180), target_link, 'reel', new.reel_id
    );
  end if;
  return new;
end;
$$;
revoke all on function public.notify_reel_comment_exact() from public, anon, authenticated;
drop trigger if exists notify_reel_comment on public.reel_comments;
create trigger notify_reel_comment after insert on public.reel_comments
  for each row execute function public.notify_reel_comment_exact();

create or replace function public.notify_story_reply_exact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  select s.author_id into owner_id from public.stories s where s.id = new.story_id;
  if owner_id is not null and owner_id <> new.author_id then
    perform public.enqueue_social_notification(
      owner_id, new.author_id, 'story_reply', 'Story reply', left(new.body, 180),
      '/stories?story=' || new.story_id::text, 'story', new.story_id
    );
  end if;
  return new;
end;
$$;
revoke all on function public.notify_story_reply_exact() from public, anon, authenticated;
drop trigger if exists notify_story_reply on public.story_replies;
create trigger notify_story_reply after insert on public.story_replies
  for each row execute function public.notify_story_reply_exact();

-- Story replies are sent as real direct messages. The message stores a typed
-- reference so both people can reopen the original story from the conversation.
alter table public.messages
  add column if not exists shared_content_type text,
  add column if not exists shared_content_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.messages'::regclass
       and conname = 'messages_shared_content_pair'
  ) then
    alter table public.messages add constraint messages_shared_content_pair
      check (
        (shared_content_type is null and shared_content_id is null)
        or (shared_content_type in ('post', 'reel', 'story') and shared_content_id is not null)
      );
  end if;
end;
$$;

-- Extend the administrator's exact table inventory for the two new durable
-- interaction tables. This keeps schema health checks honest after rollout.
create or replace function public.admin_table_health()
returns table (name text, ok boolean, diagnosis text)
language sql
security definer
set search_path = ''
as $$
  select
    managed.name,
    to_regclass('public.' || managed.name) is not null,
    case
      when to_regclass('public.' || managed.name) is not null then null
      else 'Apply supabase/migrations/' || managed.migration || '.'
    end
  from (values
    ('comments', '20261001000000_velori_core.sql'),
    ('likes', '20261001000000_velori_core.sql'),
    ('post_tags', '20261001000000_velori_core.sql'),
    ('posts', '20261001000000_velori_core.sql'),
    ('profiles', '20261001000000_velori_core.sql'),
    ('saves', '20261001000000_velori_core.sql'),
    ('admin_audit_logs', '20261002000000_veloryz_admin.sql'),
    ('admin_login_attempts', '20261002000000_veloryz_admin.sql'),
    ('admin_profiles', '20261002000000_veloryz_admin.sql'),
    ('site_settings', '20261002000000_veloryz_admin.sql'),
    ('admin_access_code', '20261007000000_veloryz_admin_bootstrap_claim.sql'),
    ('admin_bootstrap_claims', '20261007000000_veloryz_admin_bootstrap_claim.sql'),
    ('account_modes', '20261009000000_velori_platform_core.sql'),
    ('account_settings', '20261009000000_velori_platform_core.sql'),
    ('blocks', '20261009000000_velori_platform_core.sql'),
    ('close_friends', '20261009000000_velori_platform_core.sql'),
    ('follows', '20261009000000_velori_platform_core.sql'),
    ('hidden_authors', '20261009000000_velori_platform_core.sql'),
    ('mutes', '20261009000000_velori_platform_core.sql'),
    ('profile_links', '20261009000000_velori_platform_core.sql'),
    ('reserved_usernames', '20261009000000_velori_platform_core.sql'),
    ('restrictions', '20261009000000_velori_platform_core.sql'),
    ('story_hides', '20261009000000_velori_platform_core.sql'),
    ('post_draft_media', '20261010000000_velori_post_lifecycle.sql'),
    ('post_drafts', '20261010000000_velori_post_lifecycle.sql'),
    ('post_media', '20261010000000_velori_post_lifecycle.sql'),
    ('admin_error_pages', '20261012000000_velori_admin_content_management.sql'),
    ('cms_page_versions', '20261012000000_velori_admin_content_management.sql'),
    ('cms_pages', '20261012000000_velori_admin_content_management.sql'),
    ('content_reports', '20261012000000_velori_admin_content_management.sql'),
    ('feature_flags', '20261012000000_velori_admin_content_management.sql'),
    ('navigation_items', '20261012000000_velori_admin_content_management.sql'),
    ('system_announcements', '20261012000000_velori_admin_content_management.sql'),
    ('admin_credential_migrations', '20261013000000_velori_admin_rbac.sql'),
    ('admin_permissions', '20261013000000_velori_admin_rbac.sql'),
    ('admin_role_permissions', '20261013000000_velori_admin_rbac.sql'),
    ('admin_roles', '20261013000000_velori_admin_rbac.sql'),
    ('admin_sessions', '20261013000000_velori_admin_rbac.sql'),
    ('advertisements', '20261014000000_velori_admin_console.sql'),
    ('animation_configs', '20261014000000_velori_admin_console.sql'),
    ('app_routes', '20261014000000_velori_admin_console.sql'),
    ('branding_asset_versions', '20261014000000_velori_admin_console.sql'),
    ('branding_assets', '20261014000000_velori_admin_console.sql'),
    ('email_template_configs', '20261014000000_velori_admin_console.sql'),
    ('email_template_versions', '20261014000000_velori_admin_console.sql'),
    ('platform_settings', '20261014000000_velori_admin_console.sql'),
    ('system_notification_receipts', '20261014000000_velori_admin_console.sql'),
    ('system_notifications', '20261014000000_velori_admin_console.sql'),
    ('theme_settings', '20261014000000_velori_admin_console.sql'),
    ('notification_preferences', '20261015000000_velori_social_product_infra.sql'),
    ('notifications', '20261015000000_velori_social_product_infra.sql'),
    ('reel_comments', '20261015000000_velori_social_product_infra.sql'),
    ('reel_drafts', '20261015000000_velori_social_product_infra.sql'),
    ('reel_likes', '20261015000000_velori_social_product_infra.sql'),
    ('reel_media', '20261015000000_velori_social_product_infra.sql'),
    ('reel_reports', '20261015000000_velori_social_product_infra.sql'),
    ('reel_saves', '20261015000000_velori_social_product_infra.sql'),
    ('reel_settings', '20261015000000_velori_social_product_infra.sql'),
    ('reels', '20261015000000_velori_social_product_infra.sql'),
    ('stories', '20261015000000_velori_social_product_infra.sql'),
    ('story_likes', '20261031002800_velori_social_content_interactions.sql'),
    ('story_media', '20261015000000_velori_social_product_infra.sql'),
    ('story_replies', '20261015000000_velori_social_product_infra.sql'),
    ('story_reports', '20261015000000_velori_social_product_infra.sql'),
    ('story_settings', '20261015000000_velori_social_product_infra.sql'),
    ('story_views', '20261015000000_velori_social_product_infra.sql'),
    ('comment_likes', '20261031002800_velori_social_content_interactions.sql'),
    ('motion_configuration', '20261018000000_velori_motion_experience_cms.sql'),
    ('motion_presets', '20261018000000_velori_motion_experience_cms.sql'),
    ('motion_versions', '20261018000000_velori_motion_experience_cms.sql'),
    ('conversation_participants', '20261019000000_velori_messaging_and_groups.sql'),
    ('conversations', '20261019000000_velori_messaging_and_groups.sql'),
    ('group_members', '20261019000000_velori_messaging_and_groups.sql'),
    ('group_settings', '20261019000000_velori_messaging_and_groups.sql'),
    ('groups', '20261019000000_velori_messaging_and_groups.sql'),
    ('message_attachments', '20261019000000_velori_messaging_and_groups.sql'),
    ('messages', '20261019000000_velori_messaging_and_groups.sql'),
    ('ad_events', '20261020000000_velori_ad_events_and_reel_story_moderation.sql'),
    ('admin_accounts', '20261025000000_veloryz_admin_accounts.sql'),
    ('motion_publication_events', '20261030000000_velori_page_experience_runtime.sql')
  ) as managed(name, migration);
$$;

comment on function public.admin_table_health() is
  'Reports whether every table the VELORI migration chain creates is installed, naming the migration file that creates it.';
revoke all on function public.admin_table_health() from public, anon, authenticated;
grant execute on function public.admin_table_health() to service_role;
create index if not exists messages_shared_content_idx
  on public.messages(shared_content_type, shared_content_id)
  where shared_content_type is not null;

create or replace function private.can_reply_to_story(p_story_id uuid, p_viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_viewer_id = (select auth.uid())
    and exists (
      select 1
        from public.stories s
        join public.account_settings settings on settings.profile_id = s.author_id
       where s.id = p_story_id
         and s.author_id <> p_viewer_id
         and s.status = 'active'
         and s.expires_at > now()
         and s.allow_replies
         and public.viewer_can_see(p_viewer_id, s.author_id)
         and (
           not exists (select 1 from public.profiles profile where profile.id = s.author_id and profile.is_private)
           or exists (
             select 1 from public.follows f
              where f.follower_id = p_viewer_id and f.following_id = s.author_id and f.status = 'accepted'
           )
         )
         and not exists (
           select 1 from public.story_hides sh
            where sh.owner_id = p_viewer_id and sh.hidden_profile_id = s.author_id
         )
         and (
           (s.audience = 'public')
           or (s.audience = 'followers' and exists (
             select 1 from public.follows f
              where f.follower_id = p_viewer_id and f.following_id = s.author_id and f.status = 'accepted'
           ))
           or (s.audience = 'close_friends' and public.viewer_is_close_friend(s.author_id, p_viewer_id))
         )
         and (
           settings.story_reply_permission = 'everyone'
           or (settings.story_reply_permission = 'followers' and exists (
             select 1 from public.follows f
              where f.follower_id = p_viewer_id and f.following_id = s.author_id and f.status = 'accepted'
           ))
           or (settings.story_reply_permission = 'close_friends' and public.viewer_is_close_friend(s.author_id, p_viewer_id))
         )
    );
$$;
revoke all on function private.can_reply_to_story(uuid, uuid) from public, anon, authenticated;
grant execute on function private.can_reply_to_story(uuid, uuid) to authenticated;

create or replace function public.send_story_reply(p_story_id uuid, p_body text)
returns table(conversation_id uuid, message_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  story_owner uuid;
  thread_id uuid;
  sent_message_id uuid;
begin
  if viewer is null then
    raise exception 'Sign in to reply to this story.' using errcode = '42501';
  end if;
  if p_body is null or char_length(trim(p_body)) not between 1 and 1000 then
    raise exception 'Write a reply of up to 1,000 characters.' using errcode = '22023';
  end if;
  if not private.can_reply_to_story(p_story_id, viewer) then
    raise exception 'You cannot reply to this story.' using errcode = '42501';
  end if;
  select s.author_id into story_owner from public.stories s where s.id = p_story_id;
  thread_id := public.open_direct_conversation(story_owner);
  if not private.can_send_conversation_message(thread_id, viewer, 'text') then
    raise exception 'You cannot message this person.' using errcode = '42501';
  end if;

  insert into public.story_replies(story_id, author_id, body)
  values (p_story_id, viewer, trim(p_body));
  insert into public.messages(
    conversation_id, sender_id, kind, body, client_nonce,
    shared_content_type, shared_content_id
  ) values (
    thread_id, viewer, 'text', trim(p_body), gen_random_uuid()::text,
    'story', p_story_id
  ) returning id into sent_message_id;

  return query select thread_id, sent_message_id;
end;
$$;
revoke all on function public.send_story_reply(uuid, text) from public, anon;
grant execute on function public.send_story_reply(uuid, text) to authenticated;

-- One message notification carries the story reference and opens the exact
-- conversation message; suppress a second notification from story_replies.
drop trigger if exists notify_story_reply on public.story_replies;

create or replace function public.notify_message_sent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient record;
begin
  if new.kind = 'system' or new.deleted_at is not null then return new; end if;
  for recipient in
    select p.user_id
      from public.conversation_participants p
     where p.conversation_id = new.conversation_id
       and p.user_id <> new.sender_id
       and coalesce(p.notifications_enabled, true)
       and (p.muted_until is null or p.muted_until < now())
       and not private.blocked_between(p.user_id, new.sender_id)
  loop
    if new.shared_content_type = 'story' then
      perform public.enqueue_social_notification(
        recipient.user_id, new.sender_id, 'story_reply', 'Story reply',
        left(coalesce(nullif(new.body, ''), 'Replied to your story'), 120),
        '/messages?conversation=' || new.conversation_id::text || '&message=' || new.id::text,
        'message', new.id
      );
    else
      perform public.enqueue_social_notification(
        recipient.user_id, new.sender_id, 'message', 'New message',
        left(coalesce(nullif(new.body, ''), 'Sent an attachment'), 120),
        '/messages?conversation=' || new.conversation_id::text || '&message=' || new.id::text,
        'message', new.id
      );
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.notify_message_sent() from public, anon, authenticated;

-- Bring existing social notifications onto the routes understood by the UI.
update public.notifications n
   set link = '/reels?reel=' || n.entity_id::text
 where n.entity_type = 'reel'
   and n.entity_id is not null
   and n.link like '/reels?id=%';
update public.notifications n
   set link = '/stories?story=' || n.entity_id::text
 where n.entity_type = 'story'
   and n.entity_id is not null
   and n.link like '/stories?id=%';
update public.notifications n
   set link = '/messages?conversation=' || m.conversation_id::text || '&message=' || m.id::text
  from public.messages m
 where n.entity_type = 'message'
   and n.entity_id = m.id
   and (n.link = '/messages' or n.link = '');

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'story_likes') then
      alter publication supabase_realtime add table public.story_likes;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'story_views') then
      alter publication supabase_realtime add table public.story_views;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'likes') then
      alter publication supabase_realtime add table public.likes;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reel_likes') then
      alter publication supabase_realtime add table public.reel_likes;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comment_likes') then
      alter publication supabase_realtime add table public.comment_likes;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments') then
      alter publication supabase_realtime add table public.comments;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reel_comments') then
      alter publication supabase_realtime add table public.reel_comments;
    end if;
  end if;
end;
$$;
