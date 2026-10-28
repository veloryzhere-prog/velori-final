-- PostgreSQL RLS filters rows, not columns. Keep sensitive profile fields
-- behind the safe profile RPCs so a direct select or nested relationship query
-- cannot bypass the owner's field visibility controls.

create or replace function public.profile_self()
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  is_private boolean,
  website_url text,
  link_title text,
  account_type text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.bio, p.avatar_url,
         p.is_private, p.website_url, p.link_title, p.account_type::text
    from public.profiles p
   where p.id = auth.uid();
$$;

revoke all on function public.profile_self() from public, anon;
grant execute on function public.profile_self() to authenticated;

revoke select on public.profiles from anon, authenticated;
revoke select (bio, website_url, link_title, account_type) on public.profiles from anon, authenticated;
grant select (id, username, display_name, avatar_url, is_private, created_at)
  on public.profiles to anon, authenticated;

notify pgrst, 'reload schema';
