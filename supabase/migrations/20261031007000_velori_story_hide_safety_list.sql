create or replace function public.my_safety_lists()
returns table (list_name text, target_id uuid, username text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'blocks'::text, b.blocked_id, p.username
    from public.blocks b join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = (select auth.uid())
  union all
  select 'mutes'::text, m.muted_id, p.username
    from public.mutes m join public.profiles p on p.id = m.muted_id
   where m.muter_id = (select auth.uid())
  union all
  select 'restrictions'::text, r.restricted_id, p.username
    from public.restrictions r join public.profiles p on p.id = r.restricted_id
   where r.restrictor_id = (select auth.uid())
  union all
  select 'story_hides'::text, h.hidden_profile_id, p.username
    from public.story_hides h join public.profiles p on p.id = h.hidden_profile_id
   where h.owner_id = (select auth.uid());
$$;

revoke all on function public.my_safety_lists() from public, anon;
grant execute on function public.my_safety_lists() to authenticated;
