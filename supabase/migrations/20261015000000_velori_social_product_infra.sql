-- VELORI social product infrastructure.
-- This is the production-grade foundation for reels, stories, notifications and
-- persisted public placement metadata. It reuses the existing social tables where
-- practical and keeps all writes scoped to authenticated authors or service role.

create table if not exists public.reel_settings (
  author_id uuid primary key references public.profiles(id) on delete cascade,
  audience text not null default 'public' check (audience in ('public', 'followers', 'private')),
  allow_comments boolean not null default true,
  allow_likes boolean not null default true,
  allow_sharing boolean not null default true,
  allow_download boolean not null default false,
  allow_remix boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '' check (char_length(trim(title)) <= 140),
  caption text not null default '' check (char_length(caption) <= 2500),
  video_url text not null default '',
  thumbnail_url text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived', 'hidden')),
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  allow_comments boolean not null default true,
  allow_likes boolean not null default true,
  allow_sharing boolean not null default true,
  allow_download boolean not null default false,
  allow_remix boolean not null default false,
  is_reported boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  expires_at timestamptz
);

create table if not exists public.reel_media (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  media_type text not null default 'video' check (media_type in ('video', 'image')),
  object_path text not null default '',
  original_name text not null default '',
  mime_type text not null default '',
  byte_size bigint not null default 0 check (byte_size >= 0),
  width integer default null check (width is null or width > 0),
  height integer default null check (height is null or height > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.reel_drafts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '' check (char_length(trim(title)) <= 140),
  caption text not null default '' check (char_length(caption) <= 2500),
  video_url text not null default '',
  thumbnail_url text not null default '',
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  allow_comments boolean not null default true,
  allow_likes boolean not null default true,
  allow_sharing boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.reel_likes (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);

create table if not exists public.reel_saves (
  reel_id uuid not null references public.reels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reel_id, user_id)
);

create table if not exists public.reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.reel_comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reel_reports (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid not null references public.reels(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'other' check (category in ('spam', 'harassment', 'impersonation', 'hate', 'dangerous', 'copyright', 'privacy', 'scam', 'fake_account', 'other')),
  reason text not null default '' check (char_length(reason) <= 2000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'action_taken', 'no_violation', 'closed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_settings (
  author_id uuid primary key references public.profiles(id) on delete cascade,
  audience text not null default 'followers' check (audience in ('public', 'followers', 'private')),
  hide_from_self boolean not null default false,
  allow_replies boolean not null default true,
  allow_reactions boolean not null default true,
  auto_expire_minutes integer not null default 24 * 60 check (auto_expire_minutes between 1 and 10080),
  updated_at timestamptz not null default now()
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 2000),
  media_url text not null default '',
  media_type text not null default 'image' check (media_type in ('image', 'video', 'text')),
  audience text not null default 'followers' check (audience in ('public', 'followers', 'private')),
  status text not null default 'active' check (status in ('active', 'expired', 'archived', 'hidden', 'removed')),
  hide_from_self boolean not null default false,
  allow_replies boolean not null default true,
  allow_reactions boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  updated_at timestamptz not null default now()
);

create table if not exists public.story_media (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  media_url text not null default '',
  media_type text not null default 'image' check (media_type in ('image', 'video', 'text')),
  object_path text not null default '',
  mime_type text not null default '',
  byte_size bigint not null default 0 check (byte_size >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create table if not exists public.story_replies (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.story_reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'other' check (category in ('spam', 'harassment', 'hate', 'dangerous', 'privacy', 'impersonation', 'other')),
  reason text not null default '' check (char_length(reason) <= 2000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'action_taken', 'no_violation', 'closed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('like', 'comment', 'reply', 'follow', 'follow_request', 'mention', 'tag', 'story_reaction', 'story_reply', 'reel_interaction', 'message', 'group', 'security', 'system')),
  title text not null default '' check (char_length(trim(title)) <= 160),
  body text not null default '' check (char_length(body) <= 2000),
  link text not null default '' check (char_length(link) <= 300),
  entity_type text not null default 'post' check (entity_type in ('post', 'comment', 'reel', 'story', 'profile', 'message', 'group', 'system')),
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  likes boolean not null default true,
  comments boolean not null default true,
  replies boolean not null default true,
  follows boolean not null default true,
  mentions boolean not null default true,
  stories boolean not null default true,
  reels boolean not null default true,
  security boolean not null default true,
  system boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists reels_author_idx on public.reels (author_id, created_at desc);
create index if not exists reels_status_idx on public.reels (status, visibility, created_at desc);
create index if not exists reel_comments_reel_idx on public.reel_comments (reel_id, created_at desc);
create index if not exists reel_reports_status_idx on public.reel_reports (status, created_at desc);
create index if not exists stories_author_idx on public.stories (author_id, created_at desc);
create index if not exists stories_status_idx on public.stories (status, expires_at, created_at desc);
create index if not exists story_reports_status_idx on public.story_reports (status, created_at desc);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_read_idx on public.notifications (recipient_id, read_at, created_at desc);

alter table public.reels enable row level security;
alter table public.reel_media enable row level security;
alter table public.reel_drafts enable row level security;
alter table public.reel_likes enable row level security;
alter table public.reel_saves enable row level security;
alter table public.reel_comments enable row level security;
alter table public.reel_reports enable row level security;
alter table public.reel_settings enable row level security;
alter table public.stories enable row level security;
alter table public.story_media enable row level security;
alter table public.story_views enable row level security;
alter table public.story_replies enable row level security;
alter table public.story_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

revoke all on public.reels from public, anon, authenticated;
revoke all on public.reel_media from public, anon, authenticated;
revoke all on public.reel_drafts from public, anon, authenticated;
revoke all on public.reel_likes from public, anon, authenticated;
revoke all on public.reel_saves from public, anon, authenticated;
revoke all on public.reel_comments from public, anon, authenticated;
revoke all on public.reel_reports from public, anon, authenticated;
revoke all on public.reel_settings from public, anon, authenticated;
revoke all on public.stories from public, anon, authenticated;
revoke all on public.story_media from public, anon, authenticated;
revoke all on public.story_views from public, anon, authenticated;
revoke all on public.story_replies from public, anon, authenticated;
revoke all on public.story_reports from public, anon, authenticated;
revoke all on public.notifications from public, anon, authenticated;
revoke all on public.notification_preferences from public, anon, authenticated;

grant select on public.reels to anon, authenticated;
grant insert, update, delete on public.reels to authenticated;
grant select on public.reel_media to anon, authenticated;
grant insert, update, delete on public.reel_media to authenticated;
grant select, insert, update, delete on public.reel_drafts to authenticated;
grant select, insert, delete on public.reel_likes to authenticated;
grant select, insert, delete on public.reel_saves to authenticated;
grant select on public.reel_comments to anon, authenticated;
grant insert, update, delete on public.reel_comments to authenticated;
grant select on public.reel_reports to authenticated;
grant insert on public.reel_reports to authenticated;
grant select, insert, update on public.reel_settings to authenticated;
grant select on public.stories to anon, authenticated;
grant insert, update, delete on public.stories to authenticated;
grant select on public.story_media to anon, authenticated;
grant insert, update, delete on public.story_media to authenticated;
grant select, insert, delete on public.story_views to authenticated;
grant select on public.story_replies to anon, authenticated;
grant insert, delete on public.story_replies to authenticated;
grant select on public.story_reports to authenticated;
grant insert on public.story_reports to authenticated;
grant select, update (read_at) on public.notifications to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.reels to service_role;
grant all on public.reel_media to service_role;
grant all on public.reel_drafts to service_role;
grant all on public.reel_likes to service_role;
grant all on public.reel_saves to service_role;
grant all on public.reel_comments to service_role;
grant all on public.reel_reports to service_role;
grant all on public.reel_settings to service_role;
grant all on public.stories to service_role;
grant all on public.story_media to service_role;
grant all on public.story_views to service_role;
grant all on public.story_replies to service_role;
grant all on public.story_reports to service_role;
grant all on public.notifications to service_role;
grant all on public.notification_preferences to service_role;

-- Make policy creation repeatable after a partially executed SQL-editor run.
drop policy if exists "Public reads published reels" on public.reels;
drop policy if exists "Authors manage their reels" on public.reels;
drop policy if exists "Authors insert reels" on public.reels;
drop policy if exists "Authors delete reels" on public.reels;
drop policy if exists "Public reads reel media" on public.reel_media;
drop policy if exists "Authors manage reel media" on public.reel_media;
drop policy if exists "Authors manage reel drafts" on public.reel_drafts;
drop policy if exists "Readers see reel comments" on public.reel_comments;
drop policy if exists "Authors manage reel comments" on public.reel_comments;
drop policy if exists "Users like reels" on public.reel_likes;
drop policy if exists "Users save reels" on public.reel_saves;
drop policy if exists "Users report reels" on public.reel_reports;
drop policy if exists "Users manage own reel settings" on public.reel_settings;
drop policy if exists "Public reads active stories" on public.stories;
drop policy if exists "Authors manage their stories" on public.stories;
drop policy if exists "Readers see story media" on public.story_media;
drop policy if exists "Users record story views" on public.story_views;
drop policy if exists "Users read own or own-story views" on public.story_views;
drop policy if exists "Readers see story replies" on public.story_replies;
drop policy if exists "Authors manage story replies" on public.story_replies;
drop policy if exists "Users report stories" on public.story_reports;
drop policy if exists "Users read own notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "Users mark own notifications read" on public.notifications;
drop policy if exists "Users manage own notification prefs" on public.notification_preferences;
create policy "Public reads published reels" on public.reels
  for select to anon, authenticated
  using (
    status = 'published'
    and is_deleted = false
    and (
      visibility = 'public'
      or author_id = auth.uid()
      or (
        visibility = 'followers'
        and exists (
          select 1 from public.follows f
           where f.follower_id = auth.uid()
             and f.following_id = reels.author_id
             and f.status = 'accepted'
        )
      )
    )
  );

drop policy if exists "Authors manage their reels" on public.reels;
create policy "Authors manage their reels" on public.reels
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Authors insert reels" on public.reels
  for insert to authenticated
  with check (author_id = auth.uid());

create policy "Authors delete reels" on public.reels
  for delete to authenticated
  using (author_id = auth.uid());

create policy "Public reads reel media" on public.reel_media
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.reels r
       where r.id = reel_media.reel_id
    )
  );

create policy "Authors manage reel media" on public.reel_media
  for all to authenticated
  using (
    exists (
      select 1 from public.reels r
      where r.id = reel_media.reel_id and r.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.reels r
      where r.id = reel_media.reel_id and r.author_id = auth.uid()
    )
  );

create policy "Authors manage reel drafts" on public.reel_drafts
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Readers see reel comments" on public.reel_comments
  for select to anon, authenticated
  using (
    not is_hidden
    and exists (
      select 1 from public.reels r
       where r.id = reel_comments.reel_id
    )
  );

create policy "Authors manage reel comments" on public.reel_comments
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Users like reels" on public.reel_likes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users save reels" on public.reel_saves
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users report reels" on public.reel_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "Users manage own reel settings" on public.reel_settings
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Public reads active stories" on public.stories
  for select to anon, authenticated
  using (
    status = 'active'
    and expires_at > now()
    and (
      author_id = auth.uid()
      or (
        audience = 'public'
        or (audience = 'followers' and exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid()
            and f.following_id = stories.author_id
            and f.status = 'accepted'
        ))
      )
    )
  );

create policy "Authors manage their stories" on public.stories
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Readers see story media" on public.story_media
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.stories s
       where s.id = story_media.story_id
    )
  );

create policy "Users record story views" on public.story_views
  for insert to authenticated
  with check (viewer_id = auth.uid());

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

create policy "Readers see story replies" on public.story_replies
  for select to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.stories s
       where s.id = story_replies.story_id
    )
  );

create policy "Authors manage story replies" on public.story_replies
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "Users report stories" on public.story_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "Users read own notifications" on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

create policy "Users update own notifications" on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

revoke insert, delete, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Users manage own notification prefs" on public.notification_preferences
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Keep the new relations closed until migration 160 installs the final scoped
-- policies and grants. If an operator applies migrations one at a time, this
-- prevents the temporary permissive policies above from becoming reachable.
revoke all on public.reels from public, anon, authenticated;
revoke all on public.reel_media from public, anon, authenticated;
revoke all on public.reel_drafts from public, anon, authenticated;
revoke all on public.reel_likes from public, anon, authenticated;
revoke all on public.reel_saves from public, anon, authenticated;
revoke all on public.reel_comments from public, anon, authenticated;
revoke all on public.reel_reports from public, anon, authenticated;
revoke all on public.reel_settings from public, anon, authenticated;
revoke all on public.stories from public, anon, authenticated;
revoke all on public.story_media from public, anon, authenticated;
revoke all on public.story_views from public, anon, authenticated;
revoke all on public.story_replies from public, anon, authenticated;
revoke all on public.story_reports from public, anon, authenticated;
revoke all on public.story_settings from public, anon, authenticated;
revoke all on public.notifications from public, anon, authenticated;
revoke all on public.notification_preferences from public, anon, authenticated;
