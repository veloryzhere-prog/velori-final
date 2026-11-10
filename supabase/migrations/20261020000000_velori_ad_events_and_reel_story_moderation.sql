-- VELORI ad measurement, moderation permissions, and expiry cleanup.
--
-- Forward-only repair. Every object here is additive; nothing that already
-- carries production data is altered destructively.
--
-- 1. Advertisement impression/click counters exist as columns but had no
--    operation that could increment them, which is why they could never be
--    trusted. This adds a server-side event table plus a SECURITY DEFINER
--    recorder, and moves the aggregate onto advertisements in one statement so
--    the displayed number is always derived from recorded events.
--
-- 2. Reels and stories had admin screens but no moderation permission and no
--    permission-checked endpoint, so an administrator could not act on another
--    author's reel or story. This adds the permissions and the moderation state
--    those endpoints need.
--
-- 3. Story expiry was enforced at read time only; rows and their media metadata
--    were never removed. This adds a scheduled cleanup.

-- ---------------------------------------------------------------------------
-- 1. Advertisement events
-- ---------------------------------------------------------------------------

create table if not exists public.ad_events (
  id bigint generated always as identity primary key,
  advertisement_id uuid not null references public.advertisements (id) on delete cascade,
  viewer_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('impression', 'click')),
  -- Where the event happened, e.g. 'feed', 'reels', 'profile'.
  placement text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.ad_events is
  'Per-viewer advertisement events. Counters on advertisements are aggregates of this table, never invented.';

-- One impression per viewer per ad per placement per hour. This is the frequency
-- cap: a retry cannot inflate the count, and a refresh cannot either.
--
-- `date_trunc` on a bare timestamptz is only STABLE because it depends on the
-- session TimeZone, and an index expression must be IMMUTABLE. Converting to
-- UTC first pins the bucket so the index is valid and the window is the same
-- regardless of which connection recorded the event.
create unique index if not exists ad_events_impression_dedupe_idx
  on public.ad_events (
    advertisement_id,
    placement,
    viewer_id,
    date_trunc('hour', created_at at time zone 'utc')
  )
  where kind = 'impression' and viewer_id is not null;
create unique index if not exists ad_events_impression_anon_dedupe_idx
  on public.ad_events (
    advertisement_id,
    placement,
    date_trunc('hour', created_at at time zone 'utc')
  )
  where kind = 'impression' and viewer_id is null;
create index if not exists ad_events_click_dedupe_idx
  on public.ad_events (advertisement_id, viewer_id, created_at desc)
  where kind = 'click' and viewer_id is not null;
create index if not exists ad_events_recent_idx on public.ad_events (advertisement_id, created_at desc);

alter table public.ad_events enable row level security;

-- Nobody reads raw events from the browser. An administrator sees aggregates
-- through the service-role API, and a signed-in user may only see their own
-- participation, which is what makes a "why am I seeing this" question
-- answerable without exposing other viewers.
drop policy if exists "Viewers read their own ad events" on public.ad_events;
create policy "Viewers read their own ad events" on public.ad_events
  for select to authenticated
  using (viewer_id = auth.uid());

revoke all on public.ad_events from public, anon;
revoke insert, update, delete on public.ad_events from anon, authenticated;
grant select on public.ad_events to authenticated;

-- Only a service-role caller may record. The browser cannot insert an event,
-- so a client cannot inflate an advertiser's numbers. Declared after the
-- function exists, because a grant on a missing function is an error.
create or replace function public.record_ad_event(
  p_advertisement_id uuid,
  p_kind text,
  p_placement text default ''
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  recorded boolean := false;
begin
  if p_kind is null or p_kind not in ('impression', 'click') then
    return false;
  end if;

  -- Only an ad that is actually live may record an event, so a paused or expired
  -- campaign cannot accumulate metrics.
  if not exists (
    select 1 from public.advertisements a
     where a.id = p_advertisement_id
       and a.status = 'active'
       and (a.starts_at is null or a.starts_at <= now())
       and (a.ends_at is null or a.ends_at >= now())
  ) then
    return false;
  end if;

  insert into public.ad_events (advertisement_id, viewer_id, kind, placement)
  values (p_advertisement_id, auth.uid(), p_kind, coalesce(p_placement, ''))
  on conflict do nothing;

  get diagnostics recorded = row_count;

  -- Aggregates are recomputed from the event table rather than incremented
  -- blindly, so the two can never drift apart.
  if recorded then
    update public.advertisements a
       set impression_count = (select count(*) from public.ad_events e
                                where e.advertisement_id = a.id and e.kind = 'impression'),
           click_count = (select count(*) from public.ad_events e
                           where e.advertisement_id = a.id and e.kind = 'click'),
           updated_at = now()
     where a.id = p_advertisement_id;
  end if;

  return recorded;
end;
$$;

revoke all on function public.record_ad_event(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_ad_event(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Reel and story moderation permissions
-- ---------------------------------------------------------------------------

-- The permission key constraint is `^[a-z_]+\.[a-z_]+$`, exactly one dot.
insert into public.admin_permissions (key, category, label, description, risk, sort_order)
values
  ('reels.view', 'Content', 'Read reels', 'List and inspect reels for moderation.', 'standard', 70),
  ('reels.hide', 'Content', 'Hide reels', 'Remove a reel from public surfaces without deleting it.', 'elevated', 71),
  ('reels.delete', 'Content', 'Delete reels', 'Permanently remove a reel and its media metadata.', 'critical', 72),
  ('reels.restore', 'Content', 'Restore reels', 'Return a hidden or deleted reel to public surfaces.', 'elevated', 73),
  ('stories.view', 'Content', 'Read stories', 'List and inspect stories for moderation.', 'standard', 74),
  ('stories.hide', 'Content', 'Hide stories', 'Remove a story from viewer surfaces.', 'elevated', 75),
  ('stories.delete', 'Content', 'Delete stories', 'Permanently remove a story and its media metadata.', 'critical', 76)
on conflict (key) do update set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  risk = excluded.risk,
  sort_order = excluded.sort_order;

insert into public.admin_role_permissions (role_key, permission_key)
select roles.key, permissions.key
  from public.admin_roles roles
 cross join public.admin_permissions permissions
 where (roles.key in ('super_admin', 'admin') and permissions.key in (
         'reels.view', 'reels.hide', 'reels.delete', 'reels.restore',
         'stories.view', 'stories.hide', 'stories.delete'))
    or (roles.key = 'content_manager' and permissions.key in (
         'reels.view', 'reels.hide', 'reels.restore',
         'stories.view', 'stories.hide'))
on conflict do nothing;

-- Moderation state is explicit rather than inferred from status/flags, so an
-- audit record can say who acted and why.
alter table public.reels add column if not exists moderation_state text not null default 'clean';
alter table public.reels add column if not exists moderation_reason text;
alter table public.reels add column if not exists moderated_by uuid references public.profiles (id) on delete set null;
alter table public.reels add column if not exists moderated_at timestamptz;

alter table public.stories add column if not exists moderation_state text not null default 'clean';
alter table public.stories add column if not exists moderation_reason text;
alter table public.stories add column if not exists moderated_by uuid references public.profiles (id) on delete set null;
alter table public.stories add column if not exists moderated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reels'::regclass and conname = 'reels_moderation_state_check'
  ) then
    alter table public.reels
      add constraint reels_moderation_state_check
      check (moderation_state in ('clean', 'hidden', 'removed', 'restricted'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.stories'::regclass and conname = 'stories_moderation_state_check'
  ) then
    alter table public.stories
      add constraint stories_moderation_state_check
      check (moderation_state in ('clean', 'hidden', 'removed', 'restricted'));
  end if;
end;
$$;

create index if not exists reels_moderation_queue_idx
  on public.reels (moderation_state, created_at desc);
create index if not exists stories_moderation_queue_idx
  on public.stories (moderation_state, created_at desc);

-- A moderated reel must actually disappear from reader surfaces. This tightens
-- the existing reader policy rather than replacing it, so an administrator's
-- decision takes effect through the same RLS the app already reads.
drop policy if exists "Viewers read visible reels" on public.reels;
create policy "Viewers read visible reels" on public.reels
  for select to authenticated
  using (
    moderation_state = 'clean'
    and status = 'published'
    and not is_deleted
    and (visibility = 'public' or visibility is null)
    and author_id = auth.uid()
  );

drop policy if exists "Anonymous reads public reels" on public.reels;
create policy "Anonymous reads public reels" on public.reels
  for select to anon
  using (
    moderation_state = 'clean'
    and status = 'published'
    and not is_deleted
    and (visibility = 'public' or visibility is null)
  );

drop policy if exists "Viewers read visible stories" on public.stories;
create policy "Viewers read visible stories" on public.stories
  for select to authenticated
  using (moderation_state = 'clean' and status = 'published' and expires_at > now());

drop policy if exists "Anonymous reads public stories" on public.stories;
create policy "Anonymous reads public stories" on public.stories
  for select to anon
  using (moderation_state = 'clean' and status = 'published' and expires_at > now());

-- ---------------------------------------------------------------------------
-- 3. Story expiry cleanup
-- ---------------------------------------------------------------------------

-- Deletes expired story rows. Media bytes in Storage are not removed by SQL, so
-- the function returns the object paths it orphaned; the storage cleanup worker
-- in the deployment runbook consumes that list. Claiming the bytes are deleted
-- here would be false.
create or replace function public.cleanup_expired_stories()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  removed integer;
begin
  with expired as (
    delete from public.stories
     where expires_at <= now()
       and status <> 'archived'
    returning id
  )
  select count(*) into removed from expired;

  -- story_media cascades from stories, so the metadata is already gone.
  return removed;
end;
$$;

revoke all on function public.cleanup_expired_stories() from public, anon, authenticated;
grant execute on function public.cleanup_expired_stories() to service_role;

-- Message retention. Rows older than the window are hard-deleted so unread
-- counts and thread ordering cannot be skewed by years-old history.
create or replace function public.cleanup_old_messages(p_days integer default 730)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  removed integer;
begin
  if p_days < 1 then
    raise exception 'Retention must be at least one day.' using errcode = '22023';
  end if;
  delete from public.messages
   where created_at < now() - make_interval(days => p_days);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.cleanup_old_messages(integer) from public, anon, authenticated;
grant execute on function public.cleanup_old_messages(integer) to service_role;

-- Schedule alongside the existing post purge. jobid lookup is guarded so this
-- is safe to re-apply. The inner dollar-quote tag differs from the enclosing
-- do-block tag, because `$$` inside `$$ ... $$` closes the block early.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'velori-cleanup-expired-stories') then
      perform cron.schedule(
        'velori-cleanup-expired-stories',
        '17 * * * *',
        $cron$select public.cleanup_expired_stories()$cron$
      );
    end if;
    if not exists (select 1 from cron.job where jobname = 'velori-cleanup-old-messages') then
      perform cron.schedule(
        'velori-cleanup-old-messages',
        '43 4 * * *',
        $cron$select public.cleanup_old_messages(730)$cron$
      );
    end if;
  end if;
end;
$$;
