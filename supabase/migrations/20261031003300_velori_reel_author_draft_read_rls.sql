-- Reel creation stages the parent as a draft before attaching private media.
-- The author must be able to read their own draft so reel_media and Storage
-- ownership policies can validate that parent row during upload.
drop policy if exists "Authors read own reels" on public.reels;
create policy "Authors read own reels" on public.reels
  for select to authenticated
  using (author_id = (select auth.uid()));

notify pgrst, 'reload schema';
