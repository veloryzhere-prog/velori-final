-- Writers need to attach media while their story is still archived for upload.
-- The normal story reader policy intentionally hides archived rows, so a direct
-- RLS subquery against stories cannot authorize that write. Check ownership
-- through a narrow SECURITY DEFINER helper instead, while keeping media reads
-- governed by the existing audience-aware story policies.

create or replace function private.viewer_owns_story(p_story_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.stories s
      where s.id = p_story_id
        and s.author_id = (select auth.uid())
    );
$$;

revoke all on function private.viewer_owns_story(uuid) from public, anon, authenticated;
grant execute on function private.viewer_owns_story(uuid) to authenticated;

drop policy if exists "Authors manage story media" on public.story_media;
drop policy if exists "Authors insert story media" on public.story_media;
drop policy if exists "Authors update story media" on public.story_media;
drop policy if exists "Authors delete story media" on public.story_media;

create policy "Authors insert story media" on public.story_media
  for insert to authenticated
  with check (private.viewer_owns_story(story_id));

create policy "Authors update story media" on public.story_media
  for update to authenticated
  using (private.viewer_owns_story(story_id))
  with check (private.viewer_owns_story(story_id));

create policy "Authors delete story media" on public.story_media
  for delete to authenticated
  using (private.viewer_owns_story(story_id));
