begin;
create function private.profile_mutual_connections(p_profile_id uuid,p_limit integer default 12,p_offset integer default 0)
returns table(id uuid,username text,display_name text,avatar_url text)
language sql stable security definer set search_path='' as $$
 with allowed as (
  select 1 from public.profiles owner left join public.account_settings prefs on prefs.profile_id=owner.id
  where owner.id=p_profile_id and auth.uid() is not null and private.viewer_not_blocked(owner.id)
   and (not owner.is_private or private.viewer_is_approved_follower(owner.id) or owner.id=auth.uid())
   and (owner.id=auth.uid() or coalesce(prefs.following_visibility,'followers')='everyone'
     or (coalesce(prefs.following_visibility,'followers')='followers' and private.viewer_is_approved_follower(owner.id)))
 )
 select person.id,person.username,person.display_name,
 case when coalesce(prefs.show_avatar,true) then person.avatar_url else null end
 from public.follows mine join public.follows theirs on theirs.following_id=mine.following_id
 join public.profiles person on person.id=mine.following_id
 left join public.account_settings prefs on prefs.profile_id=person.id
 where exists(select 1 from allowed)
  and mine.follower_id=auth.uid() and theirs.follower_id=p_profile_id
  and mine.status='accepted' and theirs.status='accepted'
  and private.viewer_not_blocked(person.id)
 order by person.display_name,person.id
 limit greatest(1,least(coalesce(p_limit,12),24)) offset greatest(coalesce(p_offset,0),0);
$$;
revoke all on function private.profile_mutual_connections(uuid,integer,integer) from public,anon;
grant execute on function private.profile_mutual_connections(uuid,integer,integer) to authenticated;
create function public.profile_mutual_connections(p_profile_id uuid,p_limit integer default 12,p_offset integer default 0)
returns table(id uuid,username text,display_name text,avatar_url text)
language sql stable security invoker set search_path='' as $$
 select * from private.profile_mutual_connections(p_profile_id,p_limit,p_offset);
$$;
revoke all on function public.profile_mutual_connections(uuid,integer,integer) from public,anon;
grant execute on function public.profile_mutual_connections(uuid,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;