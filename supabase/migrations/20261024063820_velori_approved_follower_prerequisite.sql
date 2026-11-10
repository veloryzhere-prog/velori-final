alter table public.account_settings
  add column if not exists followers_visibility text not null default 'followers'
    check (followers_visibility in ('everyone', 'followers', 'only_me')),
  add column if not exists following_visibility text not null default 'followers'
    check (following_visibility in ('everyone', 'followers', 'only_me')),
  add column if not exists show_follower_count boolean not null default true,
  add column if not exists show_following_count boolean not null default true,
  add column if not exists show_bio boolean not null default true,
  add column if not exists show_avatar boolean not null default true,
  add column if not exists show_website boolean not null default false,
  add column if not exists show_account_type boolean not null default true;

create or replace function private.viewer_is_approved_follower(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and auth.uid() <> owner
    and private.viewer_not_blocked(owner)
    and exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = owner
        and f.status = 'accepted'
    );
$$;

revoke all on function private.viewer_is_approved_follower(uuid) from public;
grant execute on function private.viewer_is_approved_follower(uuid) to anon, authenticated;
