-- Published, database-driven visual and motion configuration.
-- Existing animation_configs remains the legacy surface catalog; this single
-- authoritative document adds drafts, route/error rules and immutable versions.

create table if not exists public.motion_presets (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,39}$'),
  label text not null check (char_length(trim(label)) between 1 and 80),
  category text not null check (category in ('entry', 'transition', 'interaction', 'loading', 'error', 'ambient')),
  description text not null default '' check (char_length(description) <= 240),
  parameters jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.motion_presets (id, label, category, description, parameters)
values
  ('none', 'Static', 'entry', 'No decorative movement.', '{"durationMs":0,"easing":"linear"}'),
  ('fade', 'Fade', 'entry', 'A short opacity reveal.', '{"durationMs":220,"easing":"ease-out"}'),
  ('fade-up', 'Fade up', 'entry', 'A small upward reveal with a soft fade.', '{"durationMs":280,"easing":"ease-out"}'),
  ('fade-down', 'Fade down', 'entry', 'A small downward reveal with a soft fade.', '{"durationMs":280,"easing":"ease-out"}'),
  ('fade-left', 'Fade left', 'entry', 'A short reveal from the left.', '{"durationMs":260,"easing":"ease-out"}'),
  ('fade-right', 'Fade right', 'entry', 'A short reveal from the right.', '{"durationMs":260,"easing":"ease-out"}'),
  ('scale-soft', 'Soft scale', 'entry', 'A restrained scale and opacity reveal.', '{"durationMs":240,"easing":"spring"}'),
  ('blur-in', 'Blur in', 'entry', 'A brief, low-blur reveal.', '{"durationMs":260,"easing":"ease-out"}'),
  ('page-crossfade', 'Page crossfade', 'transition', 'A subtle route transition.', '{"durationMs":180,"easing":"ease-in-out"}'),
  ('page-slide', 'Page slide', 'transition', 'A short horizontal route transition.', '{"durationMs":220,"easing":"ease-out"}'),
  ('modal-rise', 'Modal rise', 'interaction', 'A small upward modal entrance.', '{"durationMs":220,"easing":"spring"}'),
  ('toast-slide', 'Toast slide', 'interaction', 'A short notification entrance.', '{"durationMs":200,"easing":"ease-out"}'),
  ('pulse', 'Pulse', 'loading', 'A gentle, finite status pulse.', '{"durationMs":800,"easing":"ease-in-out"}'),
  ('shimmer', 'Shimmer', 'loading', 'A low-contrast loading shimmer.', '{"durationMs":1200,"easing":"linear"}'),
  ('float', 'Float', 'ambient', 'A slow decorative drift; disabled for reduced motion.', '{"durationMs":4000,"easing":"ease-in-out"}'),
  ('glow', 'Soft glow', 'error', 'A restrained highlight around an error illustration.', '{"durationMs":1800,"easing":"ease-in-out"}'),
  ('error-reveal', 'Error reveal', 'error', 'A brief reveal for error content.', '{"durationMs":300,"easing":"ease-out"}')
on conflict (id) do update set
  label = excluded.label,
  category = excluded.category,
  description = excluded.description,
  parameters = excluded.parameters,
  enabled = true,
  updated_at = now();

create table if not exists public.motion_configuration (
  id boolean primary key default true check (id),
  draft_config jsonb not null,
  published_config jsonb not null,
  published_version integer not null default 1 check (published_version > 0),
  published_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint motion_config_object_check check (
    jsonb_typeof(draft_config) = 'object' and jsonb_typeof(published_config) = 'object'
  )
);

insert into public.motion_configuration (id, draft_config, published_config)
values (
  true,
  '{
    "schemaVersion":1,
    "global":{"enabled":true,"intensity":"standard","speed":"normal","transitionPreset":"page-crossfade","transitionDurationMs":180,"ambientEnabled":false,"reducedMotion":"respect"},
    "theme":{"brandPink":"#ed9bb7","brandBlue":"#aac2ed","surface":"#ffffff","background":"#fbfafb","text":"#19243b","darkSurface":"#1a2539","darkBackground":"#101726","darkText":"#f5f7fd"},
    "pageRules":[],
    "errorRules":[],
    "errorPages":{},
    "componentRules":[{"componentId":"button-hover","preset":"scale-soft","enabled":true,"durationMs":160,"intensity":"subtle"},{"componentId":"card-hover","preset":"fade-up","enabled":true,"durationMs":220,"intensity":"subtle"},{"componentId":"loading","preset":"shimmer","enabled":true,"durationMs":1200,"intensity":"subtle"},{"componentId":"empty-state","preset":"fade-up","enabled":true,"durationMs":240,"intensity":"subtle"}]
  }'::jsonb,
  '{
    "schemaVersion":1,
    "global":{"enabled":true,"intensity":"standard","speed":"normal","transitionPreset":"page-crossfade","transitionDurationMs":180,"ambientEnabled":false,"reducedMotion":"respect"},
    "theme":{"brandPink":"#ed9bb7","brandBlue":"#aac2ed","surface":"#ffffff","background":"#fbfafb","text":"#19243b","darkSurface":"#1a2539","darkBackground":"#101726","darkText":"#f5f7fd"},
    "pageRules":[],
    "errorRules":[],
    "errorPages":{},
    "componentRules":[{"componentId":"button-hover","preset":"scale-soft","enabled":true,"durationMs":160,"intensity":"subtle"},{"componentId":"card-hover","preset":"fade-up","enabled":true,"durationMs":220,"intensity":"subtle"},{"componentId":"loading","preset":"shimmer","enabled":true,"durationMs":1200,"intensity":"subtle"},{"componentId":"empty-state","preset":"fade-up","enabled":true,"durationMs":240,"intensity":"subtle"}]
  }'::jsonb
) on conflict (id) do nothing;

create table if not exists public.motion_versions (
  id bigint generated always as identity primary key,
  version integer not null unique check (version > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  change_summary text not null default '' check (char_length(change_summary) <= 500),
  event text not null check (event in ('publish', 'rollback')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz not null default now()
);

create index if not exists motion_versions_created_idx
  on public.motion_versions (created_at desc, version desc);

-- Preserve existing error-page settings when this CMS is first introduced.
-- Keep them inside the same draft/published document used by the renderer.
with legacy_error_pages as (
  select coalesce(
    jsonb_object_agg(
      case code
        when '404' then 'NOT_FOUND'
        when '403' then 'FORBIDDEN'
        when '429' then 'RATE_LIMITED'
        when '500' then 'SERVER_ERROR'
        when 'maintenance' then 'MAINTENANCE'
        when 'network' then 'OFFLINE'
      end,
      jsonb_build_object(
        'title', title,
        'subtitle', description,
        'illustrationUrl', coalesce(image_url, ''),
        'logoUrl', coalesce(logo_url, ''),
        'primaryLabel', coalesce(button_label, ''),
        'primaryUrl', coalesce(button_url, ''),
        'backgroundColor', coalesce(background, ''),
        'enabled', enabled
      )
    ),
    '{}'::jsonb
  ) as config
  from public.admin_error_pages
  where code <> 'generic'
)
update public.motion_configuration mc
   set draft_config = jsonb_set(mc.draft_config, '{errorPages}', legacy_error_pages.config, true),
       published_config = jsonb_set(mc.published_config, '{errorPages}', legacy_error_pages.config, true)
  from legacy_error_pages
 where mc.id = true
   and not exists (select 1 from public.motion_versions);

insert into public.motion_versions (version, snapshot, change_summary, event)
select mc.published_version, mc.published_config, 'Initial published motion defaults', 'publish'
  from public.motion_configuration mc
 where mc.id = true
on conflict (version) do nothing;

alter table public.motion_presets enable row level security;
alter table public.motion_configuration enable row level security;
alter table public.motion_versions enable row level security;
revoke all on public.motion_presets, public.motion_configuration, public.motion_versions
  from public, anon, authenticated;
grant all on public.motion_presets, public.motion_configuration, public.motion_versions to service_role;
grant usage, select on sequence public.motion_versions_id_seq to service_role;

create or replace function public.get_published_motion_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'config', mc.published_config,
    'version', mc.published_version,
    'publishedAt', mc.published_at
  )
  from public.motion_configuration mc
  where mc.id = true;
$$;
revoke all on function public.get_published_motion_config() from public;
grant execute on function public.get_published_motion_config() to anon, authenticated;

create or replace function public.publish_motion_config(
  p_config jsonb,
  p_summary text,
  p_user_id uuid,
  p_event text default 'publish'
)
returns public.motion_versions
language plpgsql
set search_path = ''
as $$
declare
  current_version integer;
  next_version integer;
  result public.motion_versions;
begin
  if jsonb_typeof(p_config) <> 'object' or p_event not in ('publish', 'rollback') then
    raise exception 'Invalid motion publication.' using errcode = '22023';
  end if;
  select published_version into current_version
    from public.motion_configuration where id = true for update;
  if current_version is null then
    raise exception 'Motion configuration is not initialized.' using errcode = '55000';
  end if;
  next_version := current_version + 1;
  update public.motion_configuration
     set published_config = p_config,
         draft_config = p_config,
         published_version = next_version,
         published_at = now(),
         updated_by = p_user_id,
         updated_at = now()
   where id = true;
  insert into public.motion_versions (version, snapshot, change_summary, event, created_by)
  values (next_version, p_config, left(coalesce(p_summary, ''), 500), p_event, p_user_id)
  returning * into result;
  return result;
end;
$$;
revoke all on function public.publish_motion_config(jsonb, text, uuid, text) from public, anon, authenticated;
grant execute on function public.publish_motion_config(jsonb, text, uuid, text) to service_role;

-- Permission keys must satisfy admin_permissions_key_check, which is
-- `key ~ '^[a-z_]+\.[a-z_]+$'` - exactly one dot. The `design.motion.*` spelling
-- used here previously had two dots and was rejected by that check, aborting the
-- whole migration. `motion.*` matches the existing convention (`theme.view`,
-- `animations.edit`) and the constraint.
insert into public.admin_permissions (key, category, label, description, risk, sort_order)
values
  ('motion.read', 'Design', 'Read motion CMS', 'Read global motion, presets, route rules and published versions.', 'standard', 67),
  ('motion.write', 'Design', 'Edit motion drafts', 'Edit draft motion, visual and error configuration.', 'elevated', 68),
  ('motion.publish', 'Design', 'Publish motion changes', 'Publish or restore a version of the visual experience.', 'critical', 69)
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
 where (roles.key = 'super_admin' and permissions.key like 'motion.%')
    or (roles.key = 'admin' and permissions.key like 'motion.%')
    or (roles.key = 'content_manager' and permissions.key in ('motion.read', 'motion.write'))
on conflict do nothing;

comment on table public.motion_configuration is
  'Singleton validated draft and published public-safe motion document. Browser roles can only call the sanitized published RPC.';
comment on table public.motion_versions is
  'Immutable full snapshots of published motion configuration for rollback and audit.';
