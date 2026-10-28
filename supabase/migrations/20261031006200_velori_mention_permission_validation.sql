-- The existing composer supports @username text mentions but stores no separate
-- mention records. Validate that text against the mentioned account's saved
-- privacy rule before accepting a user post.

create or replace function private.validate_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  mentioned_username text;
  mentioned_profile uuid;
  mention_rule text;
begin
  if auth.uid() is null or new.author_id is distinct from auth.uid() then
    return new;
  end if;

  for mentioned_username in
    select distinct lower((match_parts.parts)[1])
      from regexp_matches(new.body, '@([a-zA-Z0-9_]{3,24})', 'g') as match_parts(parts)
  loop
    select p.id, coalesce(s.mention_permission, 'everyone')
      into mentioned_profile, mention_rule
      from public.profiles p
      left join public.account_settings s on s.profile_id = p.id
     where lower(p.username) = mentioned_username;
    if found and not private.viewer_meets_permission(mentioned_profile, mention_rule) then
      raise exception 'You cannot mention @% with their current privacy settings.', mentioned_username
        using errcode = '42501';
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function private.validate_post_mentions() from public, anon, authenticated;
drop trigger if exists enforce_post_mention_privacy on public.posts;
create trigger enforce_post_mention_privacy
  before insert or update of body on public.posts
  for each row execute function private.validate_post_mentions();

notify pgrst, 'reload schema';
