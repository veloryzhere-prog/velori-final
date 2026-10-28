-- Expand the authoritative system_announcements table into the admin managed
-- announcement runtime. Legacy rows remain live and keep their existing banner.

alter table public.system_announcements
  add column if not exists internal_name text not null default '',
  add column if not exists state text not null default 'draft',
  add column if not exists display_mode text not null default 'banner',
  add column if not exists media_type text not null default 'none',
  add column if not exists media_url text not null default '',
  add column if not exists media_alt text not null default '',
  add column if not exists poster_url text not null default '',
  add column if not exists cta_label text not null default '',
  add column if not exists action_type text not null default 'none',
  add column if not exists target_route text not null default '',
  add column if not exists target_routes text[] not null default '{}',
  add column if not exists frequency_mode text not null default 'once_per_session',
  add column if not exists max_show_count integer not null default 1,
  add column if not exists delay_seconds integer not null default 0,
  add column if not exists show_count integer not null default 0,
  add column if not exists dismissal_count integer not null default 0,
  add column if not exists cta_click_count integer not null default 0,
  add column if not exists acknowledgement_count integer not null default 0,
  add column if not exists version integer not null default 1,
  add column if not exists draft_payload jsonb,
  add column if not exists archived_at timestamptz;

update public.system_announcements
   set internal_name = title,
       state = case when active then 'live' else 'paused' end,
       display_mode = 'banner',
       version = 1
 where internal_name = '';

alter table public.system_announcements
  add constraint system_announcements_state_check
    check (state in ('draft', 'scheduled', 'live', 'paused', 'expired', 'archived')),
  add constraint system_announcements_display_mode_check
    check (display_mode in ('banner', 'modal')),
  add constraint system_announcements_media_type_check
    check (media_type in ('none', 'image', 'video')),
  add constraint system_announcements_action_type_check
    check (action_type in ('none', 'internal', 'external')),
  add constraint system_announcements_frequency_mode_check
    check (frequency_mode in ('every_refresh', 'once_per_session', 'once_per_day', 'once_total')),
  add constraint system_announcements_max_show_count_check
    check (max_show_count between 1 and 100),
  add constraint system_announcements_delay_seconds_check
    check (delay_seconds between 0 and 3600),
  add constraint system_announcements_version_check
    check (version >= 1);

insert into public.feature_flags (key, enabled, rollout, roles, description)
values ('announcements_enabled', true, 100, '{}', 'Show eligible public announcements site-wide')
on conflict (key) do nothing;

create index if not exists system_announcements_state_schedule_idx
  on public.system_announcements (state, starts_at, ends_at, priority);
create index if not exists system_announcements_internal_name_idx
  on public.system_announcements (lower(internal_name));

-- Published snapshots make edits and restores auditable without turning the
-- live announcement record into an opaque JSON document.
create table if not exists public.system_announcement_versions (
  id bigint generated always as identity primary key,
  announcement_id uuid not null references public.system_announcements(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (announcement_id, version)
);

create table if not exists public.system_announcement_events (
  id bigint generated always as identity primary key,
  announcement_id uuid not null references public.system_announcements(id) on delete cascade,
  viewer_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('view', 'dismissal', 'cta_click', 'acknowledgement')),
  created_at timestamptz not null default now()
);
create table if not exists public.system_announcement_user_state (
  announcement_id uuid not null references public.system_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  show_count integer not null default 0 check (show_count >= 0),
  dismissed_at timestamptz,
  acknowledged_at timestamptz,
  last_seen_at timestamptz,
  primary key (announcement_id, user_id)
);
create index if not exists system_announcement_events_analytics_idx
  on public.system_announcement_events (announcement_id, kind, created_at desc);
create unique index if not exists system_announcement_view_dedupe_idx
  on public.system_announcement_events (announcement_id, viewer_id, kind, date_trunc('day', created_at at time zone 'utc'))
  where viewer_id is not null and kind = 'view';

alter table public.system_announcement_versions enable row level security;
alter table public.system_announcement_events enable row level security;
alter table public.system_announcement_user_state enable row level security;
revoke all on public.system_announcement_versions, public.system_announcement_events, public.system_announcement_user_state from public, anon, authenticated;
grant all on public.system_announcement_versions, public.system_announcement_events to service_role;
grant all on public.system_announcement_user_state to service_role;
grant select, insert, update on public.system_announcement_user_state to authenticated;

drop policy if exists "Public reads live announcements" on public.system_announcements;
create policy "Public reads live announcements" on public.system_announcements
  for select to anon, authenticated
  using (
    active
    and state in ('live', 'scheduled')
    and audience = 'all'
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
    and exists (select 1 from public.feature_flags where key = 'announcements_enabled' and enabled)
  );

drop policy if exists "Users read their own announcement state" on public.system_announcement_user_state;
create policy "Users read their own announcement state" on public.system_announcement_user_state for select to authenticated using (user_id = auth.uid());
drop policy if exists "Users write their own announcement state" on public.system_announcement_user_state;
create policy "Users write their own announcement state" on public.system_announcement_user_state for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users update their own announcement state" on public.system_announcement_user_state;
create policy "Users update their own announcement state" on public.system_announcement_user_state for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.record_system_announcement_event(p_announcement_id uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  viewer uuid := auth.uid();
  inserted_count integer := 0;
  recorded boolean := false;
begin
  if viewer is null or p_kind not in ('view', 'dismissal', 'cta_click', 'acknowledgement') then return false; end if;
  if not exists (select 1 from public.system_announcements a where a.id = p_announcement_id and a.active and a.state in ('live','scheduled') and a.audience = 'all' and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())) then return false; end if;
  if not exists (select 1 from public.feature_flags where key = 'announcements_enabled' and enabled) then return false; end if;
  insert into public.system_announcement_events (announcement_id, viewer_id, kind)
  values (p_announcement_id, viewer, p_kind)
  on conflict do nothing;
  get diagnostics inserted_count = row_count;
  recorded := inserted_count > 0;
  if recorded then
    if p_kind = 'view' then update public.system_announcements set show_count = show_count + 1 where id = p_announcement_id;
    elsif p_kind = 'dismissal' then update public.system_announcements set dismissal_count = dismissal_count + 1 where id = p_announcement_id;
    elsif p_kind = 'cta_click' then update public.system_announcements set cta_click_count = cta_click_count + 1 where id = p_announcement_id;
    elsif p_kind = 'acknowledgement' then update public.system_announcements set acknowledgement_count = acknowledgement_count + 1 where id = p_announcement_id;
    end if;
  end if;
  return recorded;
end;
$$;

revoke all on function public.record_system_announcement_event(uuid, text) from public;
grant execute on function public.record_system_announcement_event(uuid, text) to authenticated;

create or replace function public.publish_system_announcement(p_announcement_id uuid, p_admin_id uuid, p_expected_version integer)
returns public.system_announcements
language plpgsql
security definer
set search_path to ''
as $$
declare
  item public.system_announcements;
begin
  select * into item from public.system_announcements where id = p_announcement_id for update;
  if not found then raise exception 'Announcement not found.' using errcode = 'P0002'; end if;
  if item.version <> p_expected_version then raise exception 'Announcement changed since it was opened.' using errcode = '40001'; end if;
  if char_length(trim(item.title)) = 0 or char_length(trim(item.message)) = 0 then raise exception 'Title and message are required.' using errcode = '22023'; end if;
  if item.media_type <> 'none' and item.media_url = '' then raise exception 'Upload or provide the selected announcement media.' using errcode = '22023'; end if;
  if item.media_type = 'image' and char_length(trim(item.media_alt)) = 0 then raise exception 'Image alt text is required.' using errcode = '22023'; end if;
  if item.action_type <> 'none' and (char_length(trim(item.cta_label)) = 0 or char_length(trim(item.link)) = 0) then raise exception 'A button label and destination are required.' using errcode = '22023'; end if;
  if item.link <> '' and item.link !~* '^https://' and (item.link !~ '^/' or item.link ~ '^//') then raise exception 'Announcement URL is not safe.' using errcode = '22023'; end if;
  if item.action_type = 'internal' and (item.link !~ '^/' or item.link ~ '^//') then raise exception 'Internal action must use a site route.' using errcode = '22023'; end if;
  if item.action_type = 'external' and item.link !~* '^https://' then raise exception 'External action must use HTTPS.' using errcode = '22023'; end if;
  if item.ends_at is not null and item.ends_at <= item.starts_at then raise exception 'End time must follow start time.' using errcode = '22023'; end if;
  if item.ends_at is not null and item.ends_at <= now() then raise exception 'An announcement cannot be published after its end time.' using errcode = '22023'; end if;
  if item.draft_payload is not null then
    update public.system_announcements set
      title = coalesce(item.draft_payload->>'title', item.title),
      message = coalesce(item.draft_payload->>'message', item.message),
      internal_name = coalesce(item.draft_payload->>'internal_name', item.internal_name),
      priority = coalesce(item.draft_payload->>'priority', item.priority),
      audience = coalesce(item.draft_payload->>'audience', item.audience),
      icon = coalesce(item.draft_payload->>'icon', item.icon),
      link = coalesce(item.draft_payload->>'link', item.link),
      dismissible = coalesce((item.draft_payload->>'dismissible')::boolean, item.dismissible),
      starts_at = coalesce((item.draft_payload->>'starts_at')::timestamptz, item.starts_at),
      ends_at = (item.draft_payload->>'ends_at')::timestamptz,
      display_mode = coalesce(item.draft_payload->>'display_mode', item.display_mode),
      media_type = coalesce(item.draft_payload->>'media_type', item.media_type),
      media_url = coalesce(item.draft_payload->>'media_url', item.media_url),
      media_alt = coalesce(item.draft_payload->>'media_alt', item.media_alt),
      poster_url = coalesce(item.draft_payload->>'poster_url', item.poster_url),
      cta_label = coalesce(item.draft_payload->>'cta_label', item.cta_label),
      action_type = coalesce(item.draft_payload->>'action_type', item.action_type),
      target_route = coalesce(item.draft_payload->>'target_route', item.target_route),
      target_routes = case when item.draft_payload ? 'target_routes' then array(select jsonb_array_elements_text(item.draft_payload->'target_routes')) else item.target_routes end,
      frequency_mode = coalesce(item.draft_payload->>'frequency_mode', item.frequency_mode),
      max_show_count = coalesce((item.draft_payload->>'max_show_count')::integer, item.max_show_count),
      delay_seconds = coalesce((item.draft_payload->>'delay_seconds')::integer, item.delay_seconds),
      draft_payload = null
    where id = item.id returning * into item;
  end if;
  item.version := item.version + 1;
  item.active := true;
  item.state := case when item.starts_at > now() then 'scheduled' else 'live' end;
  item.updated_at := now();
  update public.system_announcements set version = item.version, active = true, state = item.state, updated_at = now() where id = item.id returning * into item;
  delete from public.system_announcement_user_state where announcement_id = item.id;
  insert into public.system_announcement_versions (announcement_id, version, snapshot, created_by)
  values (item.id, item.version, jsonb_build_object(
    'title', item.title, 'message', item.message, 'internal_name', item.internal_name,
    'priority', item.priority, 'display_mode', item.display_mode, 'media_type', item.media_type,
    'media_url', item.media_url, 'media_alt', item.media_alt, 'poster_url', item.poster_url,
    'cta_label', item.cta_label, 'action_type', item.action_type, 'link', item.link,
    'target_route', item.target_route, 'target_routes', item.target_routes,
    'starts_at', item.starts_at, 'ends_at', item.ends_at, 'frequency_mode', item.frequency_mode,
    'max_show_count', item.max_show_count, 'delay_seconds', item.delay_seconds,
    'dismissible', item.dismissible
  ), p_admin_id);
  return item;
end;
$$;
revoke all on function public.publish_system_announcement(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.publish_system_announcement(uuid, uuid, integer) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'system_announcements') then
    alter publication supabase_realtime add table public.system_announcements;
  end if;
end;
$$;

-- Replace the older table-wide grant with only fields required to render live
-- notices. Audience, creator IDs, counters and draft payload stay server-side.
revoke select on public.system_announcements from public, anon, authenticated;
grant select (
  id, title, message, icon, link, priority, starts_at, ends_at, dismissible,
  active, state, display_mode, media_type, media_url, media_alt, poster_url,
  cta_label, action_type, target_route, target_routes,
  frequency_mode, max_show_count, delay_seconds, version
) on public.system_announcements to anon, authenticated;

comment on table public.system_announcement_events is
  'Server managed aggregate source for real public announcement views, dismissals, acknowledgements and CTA clicks.';
