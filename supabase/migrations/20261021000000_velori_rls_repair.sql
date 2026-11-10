-- VELORI RLS repair: reels viewer policy and stories audience enforcement.
--
-- The moderation migration 20261020000000 introduced two reader-policy regressions:
--
-- 1. The replacement "Viewers read visible reels" policy added `author_id = auth.uid()`,
--    which silently restricted every signed-in user to only their own reels. Public
--    and followers reels from other authors disappeared from /reels.
--
-- 2. The replacement stories policies dropped the `audience` check entirely, making
--    every active story visible to every anonymous and authenticated viewer regardless
--    of whether the author set it to followers-only.
--
-- This migration restores the original reader behaviour while keeping the new
-- moderation_state checks intact.

-- ---------------------------------------------------------------------------
-- Reels: restore public/followers visibility for authenticated viewers
-- ---------------------------------------------------------------------------

drop policy if exists "Viewers read visible reels" on public.reels;

create policy "Viewers read visible reels" on public.reels
  for select to authenticated
  using (
    moderation_state = 'clean'
    and status = 'published'
    and not is_deleted
    and (
      visibility = 'public'
      or author_id = auth.uid()
      or (
        visibility = 'followers'
        and exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid()
            and f.following_id = reels.author_id
            and f.status = 'accepted'
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Stories: restore audience-aware visibility for both anon and authenticated
-- ---------------------------------------------------------------------------

drop policy if exists "Viewers read visible stories" on public.stories;

create policy "Viewers read visible stories" on public.stories
  for select to authenticated
  using (
    moderation_state = 'clean'
    and status = 'published'
    and expires_at > now()
    and (
      author_id = auth.uid()
      or (
        audience = 'public'
        or (
          audience = 'followers'
          and exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid()
              and f.following_id = stories.author_id
              and f.status = 'accepted'
          )
        )
      )
    )
  );

drop policy if exists "Anonymous reads public stories" on public.stories;

create policy "Anonymous reads public stories" on public.stories
  for select to anon
  using (
    moderation_state = 'clean'
    and status = 'published'
    and expires_at > now()
    and (
      audience = 'public'
      or audience is null
    )
  );
