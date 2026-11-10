-- Keep the group avatar storage policy from querying group_members as the
-- anonymous role. Storage evaluates policies for every object in the bucket,
-- and group_members intentionally has no SELECT grant for anon.

create or replace function private.viewer_can_read_group_avatar(
  p_bucket_id text,
  p_object_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_bucket_id = 'group-media'
    and exists (
      select 1
        from public.groups g
       where g.avatar_url = p_object_path
         and (
           (g.privacy = 'public' and not g.is_locked)
           or exists (
             select 1
               from public.group_members m
              where m.group_id = g.id
                and m.user_id = (select auth.uid())
                and m.status = 'active'
           )
           or exists (
             select 1
               from public.group_members m
              where m.group_id = g.id
                and m.user_id = (select auth.uid())
                and m.status in ('requested', 'invited')
           )
         )
    );
$$;

revoke all on function private.viewer_can_read_group_avatar(text, text) from public;
grant execute on function private.viewer_can_read_group_avatar(text, text) to anon, authenticated;

drop policy if exists "Readers download visible group avatars" on storage.objects;
create policy "Readers download visible group avatars" on storage.objects
  for select to anon, authenticated
  using (
    private.viewer_can_read_group_avatar(bucket_id, name)
  );

comment on function private.viewer_can_read_group_avatar(text, text) is
  'Checks group avatar visibility without granting callers direct access to group_members.';
