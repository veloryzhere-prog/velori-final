-- RLS policies cannot see another user's restriction rows directly, so use a
-- narrow SECURITY DEFINER predicate when deciding which restricted comments
-- are visible. The helper reveals only a boolean to the caller.
create or replace function private.comment_is_restricted_by_owner(
  p_post_id uuid,
  p_comment_author uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.posts p
      join public.restrictions r on r.restrictor_id = p.author_id
     where p.id = p_post_id
       and r.restricted_id = p_comment_author
  );
$$;

revoke all on function private.comment_is_restricted_by_owner(uuid, uuid) from public;
grant execute on function private.comment_is_restricted_by_owner(uuid, uuid) to anon, authenticated;

drop policy if exists "Visible comments" on public.comments;
create policy "Visible comments" on public.comments for select
  using (
    exists (select 1 from public.posts p where p.id = comments.post_id)
    and (
      comments.author_id = (select auth.uid())
      or not private.comment_is_restricted_by_owner(comments.post_id, comments.author_id)
    )
  );
