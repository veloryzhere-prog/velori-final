-- Migration 160's combined-role story policy has a different name than the
-- reel policy. It directly queries public.follows, which anon cannot read;
-- PostgreSQL checks privileges for every policy branch and rejects otherwise
-- public story reads. The role-specific policies installed in migrations 200
-- and 210 already enforce the correct audience and moderation rules.
drop policy if exists "Readers see active stories" on public.stories;

