-- Reassert the post count RPC required by feed and post-detail views. It was
-- listed in migration 028 but missing from the live catalog.
create or replace function public.get_post_engagement_counts(p_post_ids uuid[])
returns table(post_id uuid, like_count bigint, comment_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select p.id,
         case when not p.hide_like_count or p.author_id = (select auth.uid())
              then (select count(*) from public.likes l where l.post_id = p.id)
              else null::bigint end,
         (select count(*) from public.comments c where c.post_id = p.id)
    from public.posts p
   where p.id = any(coalesce(p_post_ids, array[]::uuid[]));
$$;

revoke all on function public.get_post_engagement_counts(uuid[]) from public;
grant execute on function public.get_post_engagement_counts(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
