-- Apply in the connected project's SQL editor before using social features.
-- All client data access below is guarded by RLS. Do not use the service role in the browser.
create extension if not exists pg_trgm;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 80),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_url text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag text not null check (tag ~ '^[a-z0-9_]{1,64}$'),
  primary key (post_id, tag)
);

create index if not exists post_tags_tag_idx on public.post_tags (tag, post_id);

-- Maintain the index server-side; clients cannot write tags independently.
create or replace function public.index_post_tags() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.post_tags where post_id = new.id;
  insert into public.post_tags (post_id, tag)
  select new.id, lower((m.parts)[1])
  from regexp_matches(new.body, '#([a-zA-Z0-9_]{1,64})', 'g') as m(parts)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists sync_post_tags on public.posts;
create trigger sync_post_tags after insert or update of body on public.posts
  for each row execute function public.index_post_tags();
revoke all on function public.index_post_tags() from public, anon, authenticated;

create index if not exists posts_feed_idx on public.posts (created_at desc, id desc);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);
create index if not exists posts_body_search_idx on public.posts using gin (body gin_trgm_ops);
create index if not exists profiles_name_search_idx on public.profiles using gin (username gin_trgm_ops);
create index if not exists likes_post_idx on public.likes (post_id);
create index if not exists saves_post_idx on public.saves (post_id);
create index if not exists comments_post_idx on public.comments (post_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.post_tags enable row level security;

drop policy if exists "Public profiles or self" on public.profiles;
create policy "Public profiles or self" on public.profiles for select
  using (not is_private or id = (select auth.uid()));
drop policy if exists "Create own profile" on public.profiles;
create policy "Create own profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists "Edit own profile" on public.profiles;
create policy "Edit own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "Visible posts" on public.posts;
create policy "Visible posts" on public.posts for select
  using (author_id = (select auth.uid()) or exists (
    select 1 from public.profiles p where p.id = author_id and not p.is_private
  ));
drop policy if exists "Publish own posts" on public.posts;
create policy "Publish own posts" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()));
drop policy if exists "Edit own posts" on public.posts;
create policy "Edit own posts" on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
drop policy if exists "Delete own posts" on public.posts;
create policy "Delete own posts" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "Visible likes" on public.likes;
create policy "Visible likes" on public.likes for select
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "Like visible posts" on public.likes;
create policy "Like visible posts" on public.likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "Unlike own likes" on public.likes;
create policy "Unlike own likes" on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Read own saves" on public.saves;
create policy "Read own saves" on public.saves for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "Save visible posts" on public.saves;
create policy "Save visible posts" on public.saves for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "Remove own saves" on public.saves;
create policy "Remove own saves" on public.saves for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Visible comments" on public.comments;
create policy "Visible comments" on public.comments for select
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "Comment on visible posts" on public.comments;
create policy "Comment on visible posts" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id)
    and (parent_id is null or exists (select 1 from public.comments c where c.id = parent_id and c.post_id = post_id)));
drop policy if exists "Remove own comments" on public.comments;
create policy "Remove own comments" on public.comments for delete to authenticated
  using (author_id = (select auth.uid()));

drop policy if exists "Visible indexed hashtags" on public.post_tags;
create policy "Visible indexed hashtags" on public.post_tags for select
  using (exists (select 1 from public.posts p where p.id = post_id));
