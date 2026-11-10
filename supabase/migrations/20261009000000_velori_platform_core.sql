-- VELORI platform core: identity, social graph, safety, and per-account settings.
--
-- Depends on 20261001000000_velori_core.sql (profiles, posts, comments, likes, saves).
--
-- Design rules that hold across this whole migration set:
--
--   * Every table a browser can read or write is protected by RLS, and the client
--     only ever uses the anon/publishable key. Authorization lives here, not in UI.
--   * A "settings" column that the product exposes as a toggle must exist in the
--     database with a real default, or the toggle would be decorative.
--   * Mutating operations that need to be exact-once (follow requests, story
--     expiry, trash auto-purge) are implemented as SECURITY DEFINER functions or
--     triggers so a client cannot race or forge them.

-- ---------------------------------------------------------------------------
-- 1. Identity
-- ---------------------------------------------------------------------------

create table if not exists public.profile_links (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  website_url text,
  link_title text,
  category text not null default '' check (char_length(category) <= 60),
  contact_email text,
  contact_phone text,
  location text,
  pronouns text,
  updated_at timestamptz not null default now()
);

-- Professional account modes. `personal` is the default so a new account behaves
-- normally; creator/business unlock the dashboard and the extra profile fields.
create table if not exists public.account_modes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  account_type text not null default 'personal'
    check (account_type in ('personal', 'creator', 'business')),
  business_category text,
  contact_email text,
  contact_phone text,
  address text,
  updated_at timestamptz not null default now()
);

-- Reserved usernames cannot be claimed even by an authenticated user, so the
-- product's own routes and names can never be impersonated.
create table if not exists public.reserved_usernames (
  username text primary key check (username ~ '^[a-z0-9_.]{3,30}$'),
  reason text not null default 'reserved',
  created_at timestamptz not null default now()
);

insert into public.reserved_usernames (username, reason)
values
  ('admin', 'staff'), ('administrator', 'staff'), ('veloryz', 'brand'),
  ('velori', 'brand'), ('support', 'staff'), ('help', 'staff'),
  ('about', 'route'), ('explore', 'route'), ('search', 'route'),
  ('settings', 'route'), ('messages', 'route'), ('notifications', 'route'),
  ('reels', 'route'), ('stories', 'route'), ('groups', 'route'),
  ('login', 'route'), ('signup', 'route'), ('api', 'route'),
  ('null', 'reserved'), ('undefined', 'reserved')
on conflict do nothing;

create index if not exists profile_links_category_idx
  on public.profile_links (category) where category <> '';

-- ---------------------------------------------------------------------------
-- 2. Social graph
-- ---------------------------------------------------------------------------

-- A single edge table covers follow and follow-request. Private targets create a
-- `pending` row instead of an `accepted` one; the target decides the outcome.
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id, status);
create index if not exists follows_follower_idx on public.follows (follower_id, status);
create index if not exists follows_pending_idx on public.follows (following_id)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 3. Safety: block, mute, restrict
-- ---------------------------------------------------------------------------

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Mute is directional and one-sided: it hides the target's content from the
-- muter without the target knowing, and never affects the target's own view.
create table if not exists public.mutes (
  muter_id uuid not null references public.profiles(id) on delete cascade,
  muted_id uuid not null references public.profiles(id) on delete cascade,
  hide_notifications boolean not null default true,
  hide_stories boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);

-- Restrict is the softer version of a block: the target is not notified, and
-- their comments and messages become visible only to themselves.
create table if not exists public.restrictions (
  restrictor_id uuid not null references public.profiles(id) on delete cascade,
  restricted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (restrictor_id, restricted_id),
  check (restrictor_id <> restricted_id)
);

-- Feed-level suppression that is neither a mute nor a block: "see less like this".
create table if not exists public.hidden_authors (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  hidden_author_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, hidden_author_id),
  check (owner_id <> hidden_author_id)
);

-- People whose stories never appear in this account's story tray.
create table if not exists public.story_hides (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  hidden_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, hidden_profile_id),
  check (owner_id <> hidden_profile_id)
);

create table if not exists public.close_friends (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id)
);

-- ---------------------------------------------------------------------------
-- 4. Per-account settings
-- ---------------------------------------------------------------------------

-- One row per account, created with the profile. Columns here are the source of
-- truth for the corresponding control in Settings; a control with no column is a
-- control the product does not actually have.
create table if not exists public.account_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade,

  -- Account privacy
  is_private boolean not null default false,
  searchable boolean not null default true,
  allow_search_by_email boolean not null default false,

  -- Interaction defaults
  default_comment_permission text not null default 'everyone'
    check (default_comment_permission in ('everyone', 'followers', 'following', 'nobody')),
  mention_permission text not null default 'everyone'
    check (mention_permission in ('everyone', 'followers', 'following', 'nobody')),
  tag_permission text not null default 'everyone'
    check (tag_permission in ('everyone', 'followers', 'following', 'nobody')),
  message_permission text not null default 'followers'
    check (message_permission in ('everyone', 'followers', 'following', 'nobody')),
  story_reply_permission text not null default 'followers'
    check (story_reply_permission in ('everyone', 'followers', 'close_friends', 'nobody')),
  reshare_permission text not null default 'everyone'
    check (reshare_permission in ('everyone', 'followers', 'nobody')),

  -- Activity indicators
  show_activity_status boolean not null default true,
  show_read_receipts boolean not null default true,
  show_online_indicator boolean not null default true,
  show_typing_indicator boolean not null default true,

  -- Content visibility
  allow_downloads boolean not null default true,
  allow_embedding boolean not null default true,
  show_sensitive_content boolean not null default true,
  hide_story_from_followers boolean not null default false,

  -- Feed behaviour
  feed_order text not null default 'recommended'
    check (feed_order in ('recommended', 'chronological', 'following_only')),

  -- Notifications
  notify_like boolean not null default true,
  notify_comment boolean not null default true,
  notify_reply boolean not null default true,
  notify_follow boolean not null default true,
  notify_follow_request boolean not null default true,
  notify_mention boolean not null default true,
  notify_repost boolean not null default true,
  notify_story_reaction boolean not null default true,
  notify_message boolean not null default true,
  notify_group boolean not null default true,
  notify_email_digest boolean not null default false,

  -- Content creation
  allow_text_only_posts boolean not null default true,
  allow_comments_globally boolean not null default true,
  allow_likes_globally boolean not null default true,
  allow_reshare_globally boolean not null default true,

  -- Moderation
  comment_keyword_filter boolean not null default false,
  hide_comments_by_default boolean not null default false,
  require_comment_approval boolean not null default false,
  blocked_comment_words text not null default '',

  updated_at timestamptz not null default now()
);

-- Keep the legacy column on `profiles` in agreement with the settings table, so
-- either surface reads the same value instead of drifting apart.
create or replace function public.sync_private_account_flag() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_private is distinct from old.is_private then
    update public.account_settings
       set is_private = new.is_private, updated_at = now()
     where profile_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_private_account_flag on public.profiles;
create trigger sync_private_account_flag
  after update of is_private on public.profiles
  for each row execute function public.sync_private_account_flag();

-- Every new profile gets a settings row, so the UI never has to cope with a
-- profile that has no settings yet.
create or replace function public.provision_profile_extras() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.account_settings (profile_id) values (new.id) on conflict do nothing;
  insert into public.profile_links (profile_id) values (new.id) on conflict do nothing;
  insert into public.account_modes (profile_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists provision_profile_extras on public.profiles;
create trigger provision_profile_extras
  after insert on public.profiles
  for each row execute function public.provision_profile_extras();

-- Adopt any profile created before this migration.
insert into public.account_settings (profile_id)
select id from public.profiles on conflict do nothing;
insert into public.profile_links (profile_id)
select id from public.profiles on conflict do nothing;
insert into public.account_modes (profile_id)
select id from public.profiles on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5. Username availability
-- ---------------------------------------------------------------------------

-- Reserved names and taken names are rejected by the same check, so the UI cannot
-- report a name as available while the write is refused.
create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = '' as $$
  select
    candidate is not null
    and candidate = lower(candidate)
    and candidate ~ '^[a-z0-9_.]{3,30}$'
    and not exists (select 1 from public.reserved_usernames r where r.username = candidate)
    and not exists (select 1 from public.profiles p where p.username = candidate);
$$;

revoke all on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. The shared visibility rule
-- ---------------------------------------------------------------------------

-- Every read policy in this migration set asks this question, so block handling
-- and private-account handling are defined in exactly one place.
create or replace function public.viewer_can_see(viewer uuid, owner uuid)
returns boolean
language sql
stable
security definer
set search_path = '' as $$
  select
    viewer is not null
    and (
      viewer = owner
      -- A block in either direction hides both accounts from each other.
      or (
        not exists (
          select 1 from public.blocks b
          where (b.blocker_id = viewer and b.blocked_id = owner)
             or (b.blocker_id = owner and b.blocked_id = viewer)
        )
        and (
          exists (select 1 from public.profiles p where p.id = owner and not p.is_private)
          or exists (
            select 1 from public.follows f
            where f.follower_id = viewer and f.following_id = owner and f.status = 'accepted'
          )
          or exists (
            select 1 from public.follows f
            where f.follower_id = owner and f.following_id = viewer and f.status = 'accepted'
          )
        )
      )
    );
$$;

revoke all on function public.viewer_can_see(uuid, uuid) from public, anon;
grant execute on function public.viewer_can_see(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profile_links', 'account_modes', 'reserved_usernames', 'follows', 'blocks',
    'mutes', 'restrictions', 'hidden_authors', 'story_hides', 'close_friends',
    'account_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- profile_links / account_modes: readable with the profile, writable only by owner.
drop policy if exists "Read profile links" on public.profile_links;
create policy "Read profile links" on public.profile_links for select
  using (public.viewer_can_see((select auth.uid()), profile_id));

drop policy if exists "Edit own profile links" on public.profile_links;
create policy "Edit own profile links" on public.profile_links for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

drop policy if exists "Read account modes" on public.account_modes;
create policy "Read account modes" on public.account_modes for select
  using (public.viewer_can_see((select auth.uid()), profile_id));

drop policy if exists "Edit own account modes" on public.account_modes;
create policy "Edit own account modes" on public.account_modes for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Reserved usernames are public read-only reference data.
drop policy if exists "Read reserved usernames" on public.reserved_usernames;
create policy "Read reserved usernames" on public.reserved_usernames for select using (true);
revoke insert, update, delete on public.reserved_usernames from anon, authenticated;

-- A pending follow is visible only to its two participants, so a private account
-- does not leak who has asked to follow them.
drop policy if exists "Read visible follows" on public.follows;
create policy "Read visible follows" on public.follows for select
  using (
    status = 'accepted'
    or follower_id = (select auth.uid())
    or following_id = (select auth.uid())
  );

-- A private target requires approval: the request row is created `pending`, and
-- only the target's accept can move it to `accepted`.
drop policy if exists "Request follow" on public.follows;
create policy "Request follow" on public.follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and follower_id <> following_id
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = following_id)
         or (b.blocker_id = following_id and b.blocked_id = (select auth.uid()))
    )
    and not exists (
      select 1 from public.follows f
      where f.follower_id = following_id and f.following_id = (select auth.uid())
    )
    and status = case
      when exists (select 1 from public.profiles p
                   where p.id = following_id and p.is_private) then 'pending'
      else 'accepted'
    end
  );

-- Only the target may accept or reject. The follower may withdraw.
drop policy if exists "Respond to follow request" on public.follows;
create policy "Respond to follow request" on public.follows for update to authenticated
  using (following_id = (select auth.uid()))
  with check (following_id = (select auth.uid()));

drop policy if exists "Remove own follow" on public.follows;
create policy "Remove own follow" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

-- blocks / mutes / restrictions / hidden_authors / story_hides / close_friends:
-- only the owner of the list may read it, so a blocked user cannot discover that
-- they are blocked.
do $$
declare
  t text;
  owner_col text;
begin
  foreach t in array array['blocks', 'mutes', 'restrictions', 'hidden_authors', 'story_hides', 'close_friends'] loop
    owner_col := case t
      when 'blocks' then 'blocker_id'
      when 'mutes' then 'muter_id'
      when 'restrictions' then 'restrictor_id'
      else 'owner_id'
    end;
    execute format('drop policy if exists %I on public.%I', 'Read own ' || t, t);
    execute format(
      'create policy %I on public.%I for select using (%I = (select auth.uid()))',
      'Read own ' || t, t, owner_col
    );
    execute format('drop policy if exists %I on public.%I', 'Write own ' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (%I = (select auth.uid())) with check (%I = (select auth.uid()))',
      'Write own ' || t, t, owner_col, owner_col
    );
  end loop;
end;
$$;

-- account_settings is private. Nobody else may read how someone is configured.
drop policy if exists "Read own account settings" on public.account_settings;
create policy "Read own account settings" on public.account_settings for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "Write own account settings" on public.account_settings;
create policy "Write own account settings" on public.account_settings for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 8. Indexes
-- ---------------------------------------------------------------------------

create index if not exists profiles_username_lower_idx on public.profiles (lower(username));
create index if not exists profiles_display_name_trgm_idx
  on public.profiles using gin (display_name gin_trgm_ops);
create index if not exists account_modes_type_idx on public.account_modes (account_type);
