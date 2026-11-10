-- A block invalidates both accepted follows and pending requests. Removing the
-- block never recreates the old relationship automatically.

create or replace function private.clear_follows_for_blocked_pair()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  first_profile uuid;
  second_profile uuid;
begin
  if tg_op = 'DELETE' then
    first_profile := old.blocker_id;
    second_profile := old.blocked_id;
  else
    first_profile := new.blocker_id;
    second_profile := new.blocked_id;
  end if;

  delete from public.follows f
   where (f.follower_id = first_profile and f.following_id = second_profile)
      or (f.follower_id = second_profile and f.following_id = first_profile);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.clear_follows_for_blocked_pair() from public, anon, authenticated;
drop trigger if exists clear_follows_for_blocked_pair on public.blocks;
create trigger clear_follows_for_blocked_pair
  after insert or delete on public.blocks
  for each row execute function private.clear_follows_for_blocked_pair();
