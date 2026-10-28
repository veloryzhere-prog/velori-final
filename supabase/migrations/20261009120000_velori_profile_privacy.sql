-- Phase 1: profile fields, protected username changes, and profile image storage.
-- Existing profile rows and user IDs are preserved.

alter table public.profiles
  add column if not exists website_url text,
  add column if not exists link_title text,
  add column if not exists account_type text not null default 'personal';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_website_url_length_check'
  ) then
    alter table public.profiles add constraint profiles_website_url_length_check
      check (website_url is null or char_length(website_url) <= 2048);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_link_title_length_check'
  ) then
    alter table public.profiles add constraint profiles_link_title_length_check
      check (link_title is null or char_length(link_title) <= 80);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_account_type_check'
  ) then
    alter table public.profiles add constraint profiles_account_type_check
      check (account_type in ('personal', 'creator', 'business'));
  end if;
end;
$$;

create table if not exists public.reserved_usernames (
  username text primary key check (username ~ '^[a-z0-9_]{3,24}$'),
  reason text not null default 'reserved'
);

insert into public.reserved_usernames (username) values
  ('admin'), ('administrator'), ('api'), ('auth'), ('help'), ('login'),
  ('logout'), ('messages'), ('notifications'), ('profile'), ('settings'),
  ('signup'), ('support'), ('system'), ('velori'), ('veloryz')
on conflict (username) do nothing;

alter table public.reserved_usernames enable row level security;
revoke all on public.reserved_usernames from public, anon, authenticated;

create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when candidate !~ '^[a-z0-9_]{3,24}$' then false
    when exists (select 1 from public.reserved_usernames r where r.username = candidate) then false
    else not exists (
      select 1 from public.profiles p
      where p.username = candidate and p.id <> (select auth.uid())
    )
  end;
$$;

revoke all on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

create or replace function public.enforce_profile_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.username !~ '^[a-z0-9_]{3,24}$' then
    raise exception using errcode = '22023', message = 'Username must use 3–24 lowercase letters, numbers, or underscores.';
  end if;
  if exists (select 1 from public.reserved_usernames r where r.username = new.username) then
    raise exception using errcode = '23514', message = 'That username is reserved.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.enforce_profile_username() from public, anon, authenticated;
drop trigger if exists enforce_profile_username_before_write on public.profiles;
create trigger enforce_profile_username_before_write
  before insert or update of username on public.profiles
  for each row execute function public.enforce_profile_username();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads profile avatars" on storage.objects;
create policy "Public reads profile avatars" on storage.objects for select
  using (bucket_id = 'profile-avatars');

drop policy if exists "Users upload own profile avatars" on storage.objects;
create policy "Users upload own profile avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users replace own profile avatars" on storage.objects;
create policy "Users replace own profile avatars" on storage.objects for update to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own profile avatars" on storage.objects;
create policy "Users delete own profile avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

comment on column public.profiles.website_url is 'Optional validated profile link; may be visible to profile visitors.';
comment on column public.profiles.account_type is 'User-selected profile mode: personal, creator, or business.';
