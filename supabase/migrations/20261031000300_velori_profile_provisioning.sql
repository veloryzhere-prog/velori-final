-- Create a public profile for every real signup.
--
-- `public.profiles` is the root of the whole content graph: `posts.author_id`,
-- `comments.author_id`, `follows.follower_id`, `messages.sender_id`,
-- `reels.author_id`, `stories.author_id`, groups, notifications and every other
-- relation all reference `profiles(id)`, which in turn references `auth.users(id)`.
--
-- Nothing in this repository ever created that row. There was no trigger on
-- `auth.users`, no insert in the browser bundle, and no Edge Function path that
-- provisions one. The three rows that existed had been created by hand. A user
-- who signed up could therefore sign in, load the shell, and then fail every
-- write with SQLSTATE 23503 "Key is not present in table profiles" - no post, no
-- comment, no follow, no message, no reel, no story. The product was unusable for
-- anyone who had not been created manually.
--
-- This adds the missing provisioning step and backfills the identities that were
-- stranded by it. Administrator identities are deliberately excluded: their
-- `auth.users` rows exist only to hold an administrator credential and must not
-- appear as public members.

create or replace function public.generate_profile_username(p_email text, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  attempt integer := 0;
begin
  -- The local part of the address, reduced to the character class the username
  -- constraint allows: `^[a-z0-9_]{3,24}$`.
  base := regexp_replace(lower(split_part(coalesce(p_email, ''), '@', 1)), '[^a-z0-9_]+', '_', 'g');
  base := trim(both '_' from base);
  -- Addresses such as `a@b` or `+1@x` collapse to nothing usable, so fall back to
  -- a stable fragment of the user id rather than failing the signup.
  if length(base) < 3 then
    base := 'velori_' || substr(replace(p_user_id::text, '-', ''), 1, 8);
  end if;
  -- Leave room for the numeric disambiguator appended below.
  base := left(base, 20);

  candidate := base;
  while attempt < 1000 and exists (
    select 1 from public.profiles p where p.username = candidate
    union all
    select 1 from public.reserved_usernames r where r.username = candidate
  ) loop
    attempt := attempt + 1;
    candidate := left(base, 24 - length(attempt::text)) || attempt::text;
  end loop;
  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text;
begin
  -- An administrator identity is not a member of the social product.
  if coalesce(new.raw_user_meta_data ->> 'administrator_identity', '') = 'true' then
    return new;
  end if;

  requested := left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1)), 80);

  insert into public.profiles (id, username, display_name)
  values (new.id, public.generate_profile_username(new.email, new.id), requested)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.generate_profile_username(text, uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill the identities that were stranded before this trigger existed. The
-- administrator rows are skipped, matching the trigger.
insert into public.profiles (id, username, display_name)
select
  stranded.id,
  public.generate_profile_username(stranded.email, stranded.id),
  left(split_part(coalesce(stranded.email, ''), '@', 1), 80)
  from auth.users stranded
 where not exists (select 1 from public.profiles p where p.id = stranded.id)
   and coalesce(stranded.raw_user_meta_data ->> 'administrator_identity', '') <> 'true'
on conflict (id) do nothing;

comment on function public.handle_new_user() is
  'Provisions public.profiles for a real signup. Administrator identities are skipped so a console credential never becomes a public member.';