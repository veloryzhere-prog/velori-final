-- Private, versioned-by-record asset catalog shared by Story, Reel, and Post.
-- All mutations and signed URL creation go through the authenticated server.
create table if not exists public.studio_music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  artist_name text not null check (char_length(trim(artist_name)) between 1 and 120),
  search_aliases text[] not null default '{}',
  audio_path text not null unique,
  cover_path text,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 86400),
  genre text not null default '' check (char_length(genre) <= 80),
  mood text not null default '' check (char_length(mood) <= 80),
  language text not null default '' check (char_length(language) <= 80),
  tags text[] not null default '{}',
  search_document text not null default '',
  description text not null default '' check (char_length(description) <= 2000),
  status text not null default 'draft' check (status in ('draft','published','unpublished')),
  available_in text[] not null default '{}',
  license_reference text not null default '' check (char_length(license_reference) <= 500),
  excerpt_start_seconds integer not null default 0 check (excerpt_start_seconds >= 0),
  excerpt_end_seconds integer check (excerpt_end_seconds is null or excerpt_end_seconds > excerpt_start_seconds),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  check (available_in <@ array['story','reel','post']::text[]),
  check (status <> 'published' or (license_reference <> '' and cardinality(available_in) > 0)),
  check (duration_seconds is null or excerpt_start_seconds < duration_seconds),
  check (duration_seconds is null or excerpt_end_seconds is null or excerpt_end_seconds <= duration_seconds)
);

create table if not exists public.studio_sticker_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz
);

create table if not exists public.studio_stickers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  search_aliases text[] not null default '{}',
  category_id uuid references public.studio_sticker_categories(id) on delete restrict,
  asset_path text not null unique,
  thumbnail_path text,
  alt_text text not null default '' check (char_length(alt_text) <= 300),
  tags text[] not null default '{}',
  search_document text not null default '',
  attribution text not null default '' check (char_length(attribution) <= 300),
  animated boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published','unpublished')),
  available_in text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  check (available_in <@ array['story','reel','post']::text[]),
  check (status <> 'published' or (category_id is not null and cardinality(available_in) > 0))
);

-- Convert any previously generated search columns and populate existing records.
-- This also makes reapplying the migration safe for a local database that was
-- partially prepared before the generated-column expression was rejected.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.studio_music_tracks'::regclass
      AND attname = 'search_document'
      AND attgenerated <> ''
      AND NOT attisdropped
  ) THEN
    ALTER TABLE public.studio_music_tracks
      ALTER COLUMN search_document DROP EXPRESSION;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.studio_stickers'::regclass
      AND attname = 'search_document'
      AND attgenerated <> ''
      AND NOT attisdropped
  ) THEN
    ALTER TABLE public.studio_stickers
      ALTER COLUMN search_document DROP EXPRESSION;
  END IF;
END;
$migration$;

ALTER TABLE public.studio_music_tracks
  ALTER COLUMN search_document SET DEFAULT '';
ALTER TABLE public.studio_stickers
  ALTER COLUMN search_document SET DEFAULT '';

CREATE OR REPLACE FUNCTION public.refresh_studio_music_search_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  NEW.search_document := lower(
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.artist_name, '') || ' ' ||
    coalesce(array_to_string(NEW.search_aliases, ' '), '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS studio_music_search_document_refresh
ON public.studio_music_tracks;

CREATE TRIGGER studio_music_search_document_refresh
BEFORE INSERT OR UPDATE ON public.studio_music_tracks
FOR EACH ROW
EXECUTE FUNCTION public.refresh_studio_music_search_document();

CREATE OR REPLACE FUNCTION public.refresh_studio_sticker_search_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  NEW.search_document := lower(
    coalesce(NEW.name, '') || ' ' ||
    coalesce(array_to_string(NEW.search_aliases, ' '), '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS studio_sticker_search_document_refresh
ON public.studio_stickers;

CREATE TRIGGER studio_sticker_search_document_refresh
BEFORE INSERT OR UPDATE ON public.studio_stickers
FOR EACH ROW
EXECUTE FUNCTION public.refresh_studio_sticker_search_document();

UPDATE public.studio_music_tracks
SET search_document = lower(
  coalesce(title, '') || ' ' ||
  coalesce(artist_name, '') || ' ' ||
  coalesce(array_to_string(search_aliases, ' '), '') || ' ' ||
  coalesce(array_to_string(tags, ' '), '')
);

UPDATE public.studio_stickers
SET search_document = lower(
  coalesce(name, '') || ' ' ||
  coalesce(array_to_string(search_aliases, ' '), '') || ' ' ||
  coalesce(array_to_string(tags, ' '), '')
);

ALTER TABLE public.studio_music_tracks
  ALTER COLUMN search_document SET NOT NULL;
ALTER TABLE public.studio_stickers
  ALTER COLUMN search_document SET NOT NULL;

create index if not exists studio_music_public_idx on public.studio_music_tracks (title, artist_name)
  where status = 'published' and deleted_at is null;
create index if not exists studio_stickers_public_idx on public.studio_stickers (name, category_id)
  where status = 'published' and deleted_at is null;

alter table public.studio_music_tracks enable row level security;
alter table public.studio_sticker_categories enable row level security;
alter table public.studio_stickers enable row level security;
revoke all on public.studio_music_tracks, public.studio_sticker_categories, public.studio_stickers from anon, authenticated;
grant select on public.studio_music_tracks, public.studio_sticker_categories, public.studio_stickers to anon, authenticated;
grant all on public.studio_music_tracks, public.studio_sticker_categories, public.studio_stickers to service_role;

drop policy if exists "Published studio catalog is readable" on public.studio_music_tracks;
create policy "Published studio catalog is readable" on public.studio_music_tracks for select to anon, authenticated
  using (status = 'published' and deleted_at is null and cardinality(available_in) > 0);
drop policy if exists "Published sticker categories are readable" on public.studio_sticker_categories;
create policy "Published sticker categories are readable" on public.studio_sticker_categories for select to anon, authenticated
  using (exists (select 1 from public.studio_stickers s where s.category_id = studio_sticker_categories.id and s.status = 'published' and s.deleted_at is null));
drop policy if exists "Published studio stickers are readable" on public.studio_stickers;
create policy "Published studio stickers are readable" on public.studio_stickers for select to anon, authenticated
  using (status = 'published' and deleted_at is null and cardinality(available_in) > 0);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio-assets', 'studio-assets', false, 26214400,
  array['audio/mpeg','audio/mp4','audio/wav','audio/x-wav','audio/ogg','audio/webm','image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No direct browser read or write policy is granted. The server issues short-lived signed URLs
-- only after applying the requested studio availability filter.
