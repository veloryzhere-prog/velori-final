-- PostgREST applies SELECT visibility when an UPDATE returns a representation.
-- Let the owner read a clean archived story while its media is staged so the
-- owner can publish it, without exposing archived stories to other viewers.

drop policy if exists "Authors read own archived stories" on public.stories;
create policy "Authors read own archived stories" on public.stories
  for select to authenticated
  using (
    author_id = (select auth.uid())
    and status = 'archived'
    and moderation_state = 'clean'
  );
