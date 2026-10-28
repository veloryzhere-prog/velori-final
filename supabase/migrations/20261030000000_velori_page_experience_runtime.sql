-- Route-specific public experience settings and live invalidation for the
-- existing versioned motion document. No page data or user preferences live here.

alter table public.animation_configs
  add column if not exists media_url text not null default '',
  add column if not exists media_mime_type text not null default '',
  add column if not exists media_byte_size bigint not null default 0;

alter table public.animation_configs
  drop constraint if exists animation_configs_media_byte_size_check;

alter table public.animation_configs
  add constraint animation_configs_media_byte_size_check
  check (media_byte_size between 0 and 10485760);

comment on column public.animation_configs.media_url is
  'Optional uploaded public MP4 used by the visual animation library; route assignments store this URL in the published motion document.';

create table if not exists public.motion_publication_events (
  id boolean primary key default true check (id),
  published_version integer not null check (published_version > 0),
  updated_at timestamptz not null default now()
);

insert into public.motion_publication_events (id, published_version)
select true, published_version
  from public.motion_configuration
 where id = true
on conflict (id) do update set
  published_version = excluded.published_version,
  updated_at = now();

alter table public.motion_publication_events enable row level security;
revoke all on public.motion_publication_events from public;
revoke all on public.motion_publication_events from anon, authenticated;
grant select on public.motion_publication_events to anon, authenticated;
grant all on public.motion_publication_events to service_role;

drop policy if exists "Public reads published motion version" on public.motion_publication_events;
create policy "Public reads published motion version"
  on public.motion_publication_events for select to anon, authenticated using (true);

create or replace function public.sync_motion_publication_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.published_version is distinct from old.published_version then
    insert into public.motion_publication_events (id, published_version, updated_at)
    values (true, new.published_version, now())
    on conflict (id) do update set
      published_version = excluded.published_version,
      updated_at = excluded.updated_at;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_motion_publication_event() from public, anon, authenticated;

drop trigger if exists motion_configuration_publish_event on public.motion_configuration;
create trigger motion_configuration_publish_event
  after update of published_version on public.motion_configuration
  for each row execute function public.sync_motion_publication_event();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'motion_publication_events'
     ) then
    alter publication supabase_realtime add table public.motion_publication_events;
  end if;
end;
$$;
