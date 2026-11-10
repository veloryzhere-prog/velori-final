-- Remove legacy combined-role reader policies that directly query the private
-- follow graph. PostgreSQL plans every branch of these policies, so even an
-- anonymous public read failed with 42501 on public.follows.
--
-- The role-specific policies from 20261020000000 and 20261021000000 already
-- express the intended audience and moderation rules. Keep those and remove
-- only the obsolete combined-role policies.

drop policy if exists "Readers see visible reels" on public.reels;
drop policy if exists "Readers see visible stories" on public.stories;

