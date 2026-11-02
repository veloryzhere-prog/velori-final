# V32 media metadata — review before installation

**APPROVED AND APPLIED on 26 October 2026.** After presenting this exact scope, the user instructed completion and publication of the remaining work. Migration `20261026115830_v32_media_metadata.sql` added the four reviewed columns. All 17 existing policies on these tables were read before/after and are identical; no grants or buckets were changed.

The previous schema had no stored still-image duration. The candidate now saves the configured duration and uses it in the viewer, with a seven-second legacy fallback. A real private 15-second photo Story was published and read back; the viewer remained on it after 14.923 seconds at 0.973347 progress. Stories and Posts now serialize soundtrack/sticker metadata without signed URLs. Reels retain catalog identity, selected audio regions/volume/fades and canvas/project identity. Music remains encoded in the published video to prevent duplicate soundtrack playback.

Review SQL: [additive migration](../../supabase/proposals/20261026_v32_media_metadata.sql). Review checks: [staging constraints](../../supabase/tests/v32_media_metadata_staging.sql).

| Existing table | Addition | Compatibility |
| --- | --- | --- |
| `stories` | `visual_duration_seconds numeric(9,3)`, default 7, range 0.2–600 | Old rows retain their existing seven-second behavior; videos use actual decoded duration. |
| `story_media` | `composition_metadata jsonb`, default `{}` | Optional versioned soundtrack/sticker settings; old records remain readable. |
| `post_media` | Same metadata column | Optional catalog selection and excerpt settings for published media. |
| `reel_media` | Same metadata column | Optional composition settings; existing recorded `duration_seconds` remains authoritative. |

Nonempty metadata uses `schemaVersion: 1`, with a maximum JSON text size of 32KB. Application serializers must whitelist catalog track ID, start offset, permitted selected duration (at most 20 seconds), volume and optional sticker visibility/style/position/scale/rotation. Audio and visual sticker state remain separate. Store neither expiring media URLs nor credentials. Unknown or malformed metadata is not executable content and must be rejected/ignored safely. Existing catalog rights and availability must be rechecked before publishing or resolving audio; a JSON track ID never grants playback rights.

The applied migration creates no table, API, role, function or access policy. Existing table RLS, author checks and storage signing continue to apply. It does not activate billing, provider credentials or FORGE generation. Explicitly inspect table/column privileges before installation; retain the current grants rather than broadening them for these fields.

## Required installation and acceptance

1. Obtain schema approval under `AGENTS.md`: “Never modify database schema without asking”. Approval should cover these four additive columns, their checks/comments and the matching client publishing/viewer integration. It is not approval to change security policies or publish an incomplete release.
2. Validate the migration in an isolated nonproduction PostgreSQL/Supabase database. Run the staging constraint script and existing privacy permission tests. The constraint script copies table shapes into transaction-local fixtures and rolls back; it subsequently passed in isolated PostgreSQL 18.6 WASM (PGlite 0.5.11) using the current live table column shapes. Only a temporary QA tool outside the application was installed; no application dependency was added. This verifies the new constraints, not live RLS/storage.
3. Exercise owner, unrelated authenticated account and anonymous reads/writes/signing. Compare policies/grants before and after. Verify no change in access to private media. Test legacy rows, configured still durations, real video duration, excerpt persistence, short tracks and sticker removal without removing audio.
4. Confirm a database backup/recovery point, apply the exact tested migration through the existing Supabase workflow, and record the migration identifier. Do not use raw ad-hoc production DDL.
5. Update typed readers and publishing serializers together; test saved draft compatibility, actual private publication and viewer playback before the frontend is released.

## Rollback

Frontend rollback to saved version 29 is compatible with these additive defaults. Keep the extra columns during an application rollback so newer metadata is preserved. Do not automatically drop the columns: that would discard newly saved settings. Any later schema removal needs a metadata backup and a separate explicit destructive-operation confirmation.

The complete V32 release is still blocked by the other items in [RELEASE_AUDIT.md](RELEASE_AUDIT.md), including cross-device media acceptance and protected FORGE/admin operations.
