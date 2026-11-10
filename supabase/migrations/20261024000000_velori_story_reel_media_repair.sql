-- Restore the story reader contract and make story/reel uploads private,
-- owner-scoped Storage objects. This is additive and preserves existing rows.

-- The stories table uses `active` (not `published`) in its check constraint,
-- default, triggers, and frontend queries. Earlier reader repairs used the
-- impossible `published` value, which made every story invisible.
drop policy if exists "Viewers read visible stories" on public.stories;
drop policy if exists "Anonymous reads public stories" on public.stories;
drop policy if exists "Public reads active stories" on public.stories;
drop policy if exists "Readers see active stories" on public.stories;
drop policy if exists "Readers see visible stories" on public.stories;
create policy "Readers see active stories" on public.stories
  for select to anon
  using (
    moderation_state = 'clean'
    and status = 'active'
    and expires_at > now()
    and audience = 'public'
    and exists (
      select 1 from public.profiles p
       where p.id = stories.author_id and not p.is_private
    )
  );

create policy "Viewers read visible stories" on public.stories
  for select to authenticated
  using (
    moderation_state = 'clean'
    and status = 'active'
    and expires_at > now()
    and (
      author_id = (select auth.uid())
      or (
        public.viewer_can_see((select auth.uid()), stories.author_id)
        and not exists (
          select 1 from public.story_hides sh
           where sh.owner_id = (select auth.uid())
             and sh.hidden_profile_id = stories.author_id
        )
        and (
          (audience = 'public' and (
            not exists (select 1 from public.profiles p where p.id = stories.author_id and p.is_private)
            or exists (
              select 1 from public.follows f
               where f.follower_id = (select auth.uid())
                 and f.following_id = stories.author_id
                 and f.status = 'accepted'
            )
          ))
          or (audience = 'followers' and exists (
            select 1 from public.follows f
             where f.follower_id = (select auth.uid())
               and f.following_id = stories.author_id
               and f.status = 'accepted'
          ))
        )
      )
    )
  );

-- The former FOR ALL owner policy also bypassed status and moderation checks
-- during SELECT. Keep owner writes while making reads go through the two
-- audience-aware reader policies above.
drop policy if exists "Authors manage their stories" on public.stories;
drop policy if exists "Authors insert stories" on public.stories;
drop policy if exists "Authors update their stories" on public.stories;
drop policy if exists "Authors delete their stories" on public.stories;
create policy "Authors insert stories" on public.stories
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Authors update their stories" on public.stories
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "Authors delete their stories" on public.stories
  for delete to authenticated using (author_id = (select auth.uid()));

-- Keep the reel privacy and moderation checks aligned with the original
-- audience-aware policy while allowing anonymous access only to public reels
-- from public profiles.
drop policy if exists "Viewers read visible reels" on public.reels;
drop policy if exists "Public reads published reels" on public.reels;
drop policy if exists "Readers see visible reels" on public.reels;
drop policy if exists "Authors read own reels" on public.reels;
create policy "Readers see visible reels" on public.reels
  for select to anon
  using (
    moderation_state = 'clean'
    and status = 'published'
    and not is_deleted
    and (expires_at is null or expires_at > now())
    and visibility = 'public'
    and exists (
      select 1 from public.profiles p
       where p.id = reels.author_id and not p.is_private
    )
  );

create policy "Viewers read visible reels" on public.reels
  for select to authenticated
  using (
    moderation_state = 'clean'
    and status = 'published'
    and not is_deleted
    and (expires_at is null or expires_at > now())
    and (
      author_id = (select auth.uid())
      or (
        public.viewer_can_see((select auth.uid()), reels.author_id)
        and (
          (visibility = 'public' and (
            not exists (select 1 from public.profiles p where p.id = reels.author_id and p.is_private)
            or exists (
              select 1 from public.follows f
               where f.follower_id = (select auth.uid())
                 and f.following_id = reels.author_id
                 and f.status = 'accepted'
            )
          ))
          or (visibility = 'followers' and exists (
            select 1 from public.follows f
             where f.follower_id = (select auth.uid())
               and f.following_id = reels.author_id
               and f.status = 'accepted'
          ))
        )
      )
    )
  );

-- Media metadata follows the parent row's audience; story authors can also
-- create and remove their own metadata rows.
drop policy if exists "Public reads reel media" on public.reel_media;
drop policy if exists "Readers see media for visible reels" on public.reel_media;
create policy "Readers see media for visible reels" on public.reel_media
  for select to anon, authenticated
  using (exists (select 1 from public.reels r where r.id = reel_media.reel_id));

drop policy if exists "Readers see story media" on public.story_media;
drop policy if exists "Readers see media for visible stories" on public.story_media;
drop policy if exists "Authors manage story media" on public.story_media;
create policy "Readers see media for visible stories" on public.story_media
  for select to anon, authenticated
  using (exists (select 1 from public.stories s where s.id = story_media.story_id));
create policy "Authors manage story media" on public.story_media
  for all to authenticated
  using (exists (
    select 1 from public.stories s
     where s.id = story_media.story_id and s.author_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.stories s
     where s.id = story_media.story_id and s.author_id = (select auth.uid())
  ));

-- Only a viewer who can read an unexpired story can record that they viewed it.
drop policy if exists "Users record story views" on public.story_views;
create policy "Users record story views" on public.story_views
  for insert to authenticated
  with check (
    viewer_id = (select auth.uid())
    and exists (
      select 1 from public.stories s
       where s.id = story_views.story_id
         and s.status = 'active'
         and s.expires_at > now()
         and s.moderation_state = 'clean'
    )
  );

-- Private buckets. Signed URLs are minted only after Storage RLS confirms the
-- viewer can read the matching story or reel row.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('story-media', 'story-media', false, 104857600,
    array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('reel-media', 'reel-media', false, 104857600,
    array['video/mp4'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Readers download visible story media" on storage.objects;
create policy "Readers download visible story media" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'story-media'
    and exists (
      select 1 from public.story_media sm
      join public.stories s on s.id = sm.story_id
       where sm.object_path = storage.objects.name
    )
  );

drop policy if exists "Story authors upload own media" on storage.objects;
create policy "Story authors upload own media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'story-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
        from public.story_media sm
        join public.stories s on s.id = sm.story_id
       where sm.object_path = storage.objects.name
         and s.author_id = (select auth.uid())
    )
  );

drop policy if exists "Story authors delete own media" on storage.objects;
create policy "Story authors delete own media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'story-media'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Readers download visible reel media" on storage.objects;
create policy "Readers download visible reel media" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'reel-media'
    and exists (
      select 1 from public.reel_media rm
      join public.reels r on r.id = rm.reel_id
       where rm.object_path = storage.objects.name
    )
  );

drop policy if exists "Reel authors upload own media" on storage.objects;
create policy "Reel authors upload own media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reel-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1
        from public.reel_media rm
        join public.reels r on r.id = rm.reel_id
       where rm.object_path = storage.objects.name
         and r.author_id = (select auth.uid())
    )
  );

drop policy if exists "Reel authors delete own media" on storage.objects;
create policy "Reel authors delete own media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'reel-media'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

