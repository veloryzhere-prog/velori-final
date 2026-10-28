# VELORI story and reel media privacy audit

**Audit date:** 2026-10-05 (Asia/Calcutta)

## Finding

The deployed RLS policies for `story_media`, `reel_media`, and both private Storage buckets checked only that the media path had a parent row. They did not check that the current viewer was allowed to read that story or reel. A read-only query to the configured Supabase Management API confirmed those policy definitions are live.

This could expose media for private profiles, follower-only content, blocked/hidden creators, expired stories, or content hidden by moderation when a viewer can obtain a signed URL for a known metadata path. This audit did not attempt to retrieve any member's media.

## Local fix

Migration `20261031003500_velori_private_social_media_visibility.sql` adds viewer-bound security-definer helpers and replaces the metadata and Storage SELECT policies. The helpers check the parent status, moderation state, expiry, public/follower/close-friends audience rules, profile privacy, blocks/visibility, and story hides. Archived story media remains readable only by its author. The close-friends media check is present in the local migration but is not deployed.

## Verification boundary

- Live catalog read: **confirmed vulnerable source policies** on the configured Supabase project.
- Migration execution: **not performed**. The local migration is not deployed.
- Anonymous/follower/non-follower/blocked/admin storage RLS matrix: **not yet run**.
- No private media was downloaded or modified during this audit.

Migration `20261031003600_velori_expired_media_storage_cleanup.sql` separately queues expired story and permanently expired trash-post objects before their rows cascade away. The service-only worker removes those bytes through Supabase Storage. Its code and hourly GitHub workflow are in the local source; neither migration nor scheduled worker is deployed as of this audit.

Apply the migration through the project's reviewed deployment workflow, then verify signed URL creation for a public story/reel, accepted follower-only content, a non-follower, a blocked/hidden creator, expired/removed content, and the author. Do not claim the media leak is fixed in the live project until that post-migration matrix passes.
