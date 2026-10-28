-- Copyright © 2026 VELORYZ. All rights reserved.
-- REVIEW ONLY. Do not apply before the approval and staging gates in
-- docs/v32/MEDIA_METADATA_REVIEW.md. Existing RLS/grants remain unchanged.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.stories
  add column visual_duration_seconds numeric(9,3) not null default 7,
  add constraint stories_visual_duration_seconds_check
    check (visual_duration_seconds >= 0.2 and visual_duration_seconds <= 600);

comment on column public.stories.visual_duration_seconds is
  'Configured still/text display duration in seconds. Legacy rows retain seven seconds. Video playback uses actual decoded media duration.';

alter table public.story_media
  add column composition_metadata jsonb not null default '{}'::jsonb,
  add constraint story_media_composition_metadata_check check (
    jsonb_typeof(composition_metadata) = 'object'
    and octet_length(composition_metadata::text) <= 32768
    and (composition_metadata = '{}'::jsonb or coalesce(composition_metadata -> 'schemaVersion' = '1'::jsonb, false))
  );

alter table public.post_media
  add column composition_metadata jsonb not null default '{}'::jsonb,
  add constraint post_media_composition_metadata_check check (
    jsonb_typeof(composition_metadata) = 'object'
    and octet_length(composition_metadata::text) <= 32768
    and (composition_metadata = '{}'::jsonb or coalesce(composition_metadata -> 'schemaVersion' = '1'::jsonb, false))
  );

alter table public.reel_media
  add column composition_metadata jsonb not null default '{}'::jsonb,
  add constraint reel_media_composition_metadata_check check (
    jsonb_typeof(composition_metadata) = 'object'
    and octet_length(composition_metadata::text) <= 32768
    and (composition_metadata = '{}'::jsonb or coalesce(composition_metadata -> 'schemaVersion' = '1'::jsonb, false))
  );

comment on column public.story_media.composition_metadata is
  'Versioned composition: catalog identifiers, selected excerpt offsets/volume and optional music-sticker transform. Never secrets or signed URLs. Metadata is untrusted input, not a rights grant.';
comment on column public.post_media.composition_metadata is
  'Versioned composition metadata; empty object for legacy media. Store catalog IDs and timing, never secrets or signed URLs. Existing post RLS applies.';
comment on column public.reel_media.composition_metadata is
  'Versioned composition metadata; empty object for legacy media. Actual duration_seconds remains authoritative for the recorded video. Existing Reel RLS applies.';
