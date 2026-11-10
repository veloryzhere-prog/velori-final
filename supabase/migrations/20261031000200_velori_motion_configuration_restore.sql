-- Restore the public motion document singleton.
--
-- `public.motion_configuration` is a single-row table (`id boolean primary key
-- default true check (id)`) and `get_published_motion_config()` is
-- `select ... from public.motion_configuration where id = true`. With the row
-- absent the function returns SQL NULL rather than an error, so every visitor
-- silently received `null` and `src/lib/motion-provider.tsx` kept its built-in
-- defaults. Nothing failed visibly: the site rendered, the realtime channel
-- still fired, and `motion_publication_events` still reported a version.
--
-- The consequence was that the whole admin-to-site chain was inert. Saving a
-- startup animation, a loading animation or a per-route error override could
-- never reach the main site, and `publish_motion_config()` refuses with SQLSTATE
-- 55000 ("Motion configuration is not initialized") because it reads
-- `published_version` from the same missing row.
--
-- The published document is not lost: `motion_versions` holds the immutable
-- snapshot for every publication, so the newest snapshot is the exact document
-- that was live. This restores from it and only falls back to the compiled-in
-- defaults when no version has ever been published.
--
-- Idempotent: a healthy singleton is left untouched, so re-running is a no-op.

with restored as (
  select snapshot, version, published_at
    from public.motion_versions
   order by version desc
   limit 1
)
insert into public.motion_configuration (id, draft_config, published_config, published_version, published_at)
select true, restored.snapshot, restored.snapshot, restored.version, restored.published_at
  from restored
 where not exists (select 1 from public.motion_configuration where id = true)
on conflict (id) do nothing;

-- No version has ever been published on this project: seed the built-in default
-- document so the public RPC returns a real configuration rather than NULL. Draft
-- and published are the same document, matching what `publish_motion_config()`
-- writes.
with defaults as (
  select jsonb_build_object(
    'schemaVersion', 1,
    'global', jsonb_build_object(
      'enabled', true,
      'intensity', 'standard',
      'speed', 'normal',
      'transitionPreset', 'page-crossfade',
      'transitionDurationMs', 180,
      'ambientEnabled', false,
      'reducedMotion', 'respect'
    ),
    'theme', jsonb_build_object(
      'brandPink', '#ed9bb7',
      'brandBlue', '#aac2ed',
      'surface', '#ffffff',
      'background', '#fbfafb',
      'text', '#19243b',
      'darkSurface', '#1a2539',
      'darkBackground', '#101726',
      'darkText', '#f5f7fd'
    ),
    'pageRules', '[]'::jsonb,
    'pageExperiences', '[]'::jsonb,
    'errorRules', '[]'::jsonb,
    'errorPages', '{}'::jsonb,
    'componentRules', '[]'::jsonb
  ) as config
)
insert into public.motion_configuration (id, draft_config, published_config, published_version, published_at)
select true, defaults.config, defaults.config, 1, now()
  from defaults
 where not exists (select 1 from public.motion_configuration where id = true)
on conflict (id) do nothing;

-- The publication-event trigger fires on UPDATE of `published_version`, not on
-- INSERT, so an inserted singleton would leave the event table stale and open
-- tabs would keep their cached document. Sync it explicitly.
insert into public.motion_publication_events (id, published_version, updated_at)
select true, mc.published_version, now()
  from public.motion_configuration mc
 where mc.id = true
on conflict (id) do update set
  published_version = excluded.published_version,
  updated_at = now()
 where motion_publication_events.published_version is distinct from excluded.published_version;

comment on table public.motion_configuration is
  'Singleton validated draft and published public-safe motion document. Exactly one row with id = true must exist: get_published_motion_config() returns SQL NULL without it, which silently degrades every visitor to the compiled-in defaults instead of failing.';