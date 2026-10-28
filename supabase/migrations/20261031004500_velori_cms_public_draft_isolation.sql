-- Table-level SELECT would expose draft_content on published page rows because
-- PostgreSQL RLS filters rows, not columns. Grant public clients only the columns
-- required by the public renderer; admin reads and writes remain Edge-only.
revoke select on public.cms_pages from public, anon, authenticated;
grant select (
  title, slug, route, status, content, seo_title, seo_description,
  og_title, og_description, hero_image, custom_html, custom_css,
  content_mode, content_blocks
) on public.cms_pages to anon, authenticated;

create table if not exists public.cms_page_publication_events (
  id uuid primary key default gen_random_uuid(),
  route text not null check (char_length(route) between 1 and 180),
  published_version integer not null check (published_version > 0),
  created_at timestamptz not null default now()
);

alter table public.cms_page_publication_events enable row level security;
revoke all on public.cms_page_publication_events from public, anon, authenticated;
grant select on public.cms_page_publication_events to anon, authenticated;
grant all on public.cms_page_publication_events to service_role;

drop policy if exists "Public reads CMS publication events" on public.cms_page_publication_events;
create policy "Public reads CMS publication events" on public.cms_page_publication_events
  for select to anon, authenticated using (true);

drop policy if exists "Service role manages CMS publication events" on public.cms_page_publication_events;
create policy "Service role manages CMS publication events" on public.cms_page_publication_events
  for all to service_role using (true) with check (true);

create or replace function public.record_cms_page_publication_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published'
     and new.published_version is distinct from old.published_version then
    insert into public.cms_page_publication_events (route, published_version)
    values (new.route, new.published_version);
  end if;
  return new;
end;
$$;

revoke all on function public.record_cms_page_publication_event() from public, anon, authenticated, service_role;
drop trigger if exists cms_page_publication_event_after_update on public.cms_pages;
create trigger cms_page_publication_event_after_update
  after update on public.cms_pages
  for each row execute function public.record_cms_page_publication_event();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'cms_pages'
    ) then
      alter publication supabase_realtime drop table public.cms_pages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'cms_page_publication_events'
    ) then
      alter publication supabase_realtime add table public.cms_page_publication_events;
    end if;
  end if;
end;
$$;

comment on table public.cms_page_publication_events is
  'Public-safe invalidation events. Page draft fields are never exposed through Realtime.';

notify pgrst, 'reload schema';
