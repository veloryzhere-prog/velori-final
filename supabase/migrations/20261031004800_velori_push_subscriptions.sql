-- Persistent device subscriptions and user-controlled push preferences.
-- Delivery is handled only by trusted server code; browser clients can manage
-- their own endpoints but cannot create or read delivery jobs.

alter table public.notification_preferences
  add column if not exists messages boolean not null default true,
  add column if not exists groups boolean not null default true,
  add column if not exists announcements boolean not null default true,
  add column if not exists push_enabled boolean not null default false,
  add column if not exists push_likes boolean not null default true,
  add column if not exists push_comments boolean not null default true,
  add column if not exists push_replies boolean not null default true,
  add column if not exists push_follows boolean not null default true,
  add column if not exists push_mentions boolean not null default true,
  add column if not exists push_stories boolean not null default true,
  add column if not exists push_reels boolean not null default true,
  add column if not exists push_messages boolean not null default true,
  add column if not exists push_groups boolean not null default true,
  add column if not exists push_announcements boolean not null default true,
  add column if not exists push_system boolean not null default true;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) <= 2048),
  p256dh text not null check (char_length(p256dh) <= 256),
  auth text not null check (char_length(auth) <= 256),
  user_agent text not null default '' check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (profile_id, endpoint)
);

create index if not exists push_subscriptions_profile_idx
  on public.push_subscriptions (profile_id, last_seen_at desc);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create table if not exists public.suggestion_dismissals (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  suggested_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, suggested_profile_id),
  check (profile_id <> suggested_profile_id)
);

create index if not exists suggestion_dismissals_created_idx
  on public.suggestion_dismissals (profile_id, created_at desc);

alter table public.suggestion_dismissals enable row level security;
revoke all on public.suggestion_dismissals from public, anon, authenticated;
grant select, insert, delete on public.suggestion_dismissals to authenticated;
grant all on public.suggestion_dismissals to service_role;

drop policy if exists "Users manage own suggestion dismissals" on public.suggestion_dismissals;
create policy "Users manage own suggestion dismissals" on public.suggestion_dismissals
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and suggested_profile_id <> (select auth.uid())
    and private.viewer_not_blocked(suggested_profile_id)
  );

-- The endpoint is unique per account to support multiple devices while making
-- repeated service-worker registrations idempotent.
comment on table public.push_subscriptions is
  'Browser Web Push endpoints owned by a single profile. Private key material is never stored here.';

-- Keep the original successful-action trigger pipeline, but make its category
-- gates cover the message and group preferences exposed in the UI.
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
    when 'mention' then coalesce(preferences.mentions, true)
    when 'tag' then coalesce(preferences.mentions, true)
    when 'story_reply' then coalesce(preferences.stories, true)
    when 'story_reaction' then coalesce(preferences.stories, true)
    when 'reel_interaction' then coalesce(preferences.reels, true)
    when 'message' then coalesce(preferences.messages, true)
    when 'group' then coalesce(preferences.groups, true)
    when 'security' then coalesce(preferences.security, true)
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
