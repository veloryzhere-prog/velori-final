-- Avoid recursively applying comments RLS while checking that a reply belongs
-- to the same post as its parent comment.
create or replace function private.comment_parent_matches_post(
  p_parent_comment_id uuid,
  p_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
      from public.comments parent
     where parent.id = p_parent_comment_id
       and parent.post_id = p_post_id
  );
$$;

revoke all on function private.comment_parent_matches_post(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.comment_parent_matches_post(uuid, uuid)
  to authenticated;

drop policy if exists "Comment on visible posts" on public.comments;
create policy "Comment on visible posts" on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
        from public.posts p
       where p.id = comments.post_id
         and p.allow_comments
    )
    and (
      comments.parent_id is null
      or private.comment_parent_matches_post(comments.parent_id, comments.post_id)
    )
  );

notify pgrst, 'reload schema';
