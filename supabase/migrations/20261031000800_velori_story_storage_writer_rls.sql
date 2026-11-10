-- Storage cannot see an archived story through reader-facing story_media RLS.
-- Resolve the registered media path through a viewer-bound helper so owners can
-- upload before the story becomes visible, without widening media read access.

create or replace function private.viewer_owns_story_media_path(p_object_path text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.story_media sm
      join public.stories s on s.id = sm.story_id
      where sm.object_path = p_object_path
        and s.author_id = (select auth.uid())
    );
$$;

revoke all on function private.viewer_owns_story_media_path(text) from public, anon, authenticated;
grant execute on function private.viewer_owns_story_media_path(text) to authenticated;

drop policy if exists "Story authors upload own media" on storage.objects;
create policy "Story authors upload own media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'story-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.viewer_owns_story_media_path(name)
  );
