-- A publication and its immutable history row are one database transaction.
-- Only the authenticated, permission-checked Edge Function may call the RPC.
alter table public.cms_pages
  add column if not exists published_by uuid references auth.users(id) on delete set null,
  add column if not exists published_version integer not null default 0;

create unique index if not exists cms_page_versions_page_version_label_uidx
  on public.cms_page_versions (page_id, version_label);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'cms_pages'
     ) then
    alter publication supabase_realtime add table public.cms_pages;
  end if;
end;
$$;

create or replace function public.publish_cms_page(
  p_page_id uuid,
  p_fields jsonb,
  p_publisher_id uuid,
  p_expected_draft_updated_at timestamptz default null
)
returns public.cms_pages
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_page public.cms_pages%rowtype;
  published_page public.cms_pages%rowtype;
  next_version integer;
  publish_time timestamptz := clock_timestamp();
begin
  if p_publisher_id is null or p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    raise exception using errcode = '22023', message = 'Invalid CMS publish request.';
  end if;

  select * into current_page
    from public.cms_pages
    where id = p_page_id
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CMS page not found.';
  end if;

  if current_page.draft_updated_at is distinct from p_expected_draft_updated_at then
    raise exception using errcode = '40001', message = 'CMS draft changed since it was loaded.';
  end if;

  next_version := coalesce((
    select max(substring(version_label from '^v([0-9]+)$')::integer)
      from public.cms_page_versions
      where page_id = p_page_id
        and version_label ~ '^v[0-9]+$'
  ), 0) + 1;

  insert into public.cms_page_versions (
    page_id, version_label, title, slug, route, content, seo_title,
    seo_description, og_title, og_description, og_image, hero_image,
    custom_html, custom_css, content_blocks, content_mode,
    footer_enabled, animation_enabled, created_by, created_at
  ) values (
    p_page_id, 'v' || next_version,
    p_fields->>'title', p_fields->>'slug', p_fields->>'route',
    coalesce(p_fields->>'content', ''), coalesce(p_fields->>'seo_title', ''),
    coalesce(p_fields->>'seo_description', ''), coalesce(p_fields->>'og_title', ''),
    coalesce(p_fields->>'og_description', ''), coalesce(p_fields->>'og_image', ''),
    coalesce(p_fields->>'hero_image', ''), coalesce(p_fields->>'custom_html', ''),
    coalesce(p_fields->>'custom_css', ''), coalesce(p_fields->'content_blocks', '[]'::jsonb),
    coalesce(p_fields->>'content_mode', 'visual'),
    coalesce((p_fields->>'footer_enabled')::boolean, true),
    coalesce((p_fields->>'animation_enabled')::boolean, true),
    p_publisher_id, publish_time
  );

  update public.cms_pages set
    title = p_fields->>'title',
    slug = p_fields->>'slug',
    route = p_fields->>'route',
    content = coalesce(p_fields->>'content', ''),
    seo_title = coalesce(p_fields->>'seo_title', ''),
    seo_description = coalesce(p_fields->>'seo_description', ''),
    og_title = coalesce(p_fields->>'og_title', ''),
    og_description = coalesce(p_fields->>'og_description', ''),
    og_image = coalesce(p_fields->>'og_image', ''),
    hero_image = coalesce(p_fields->>'hero_image', ''),
    custom_html = coalesce(p_fields->>'custom_html', ''),
    custom_css = coalesce(p_fields->>'custom_css', ''),
    content_blocks = coalesce(p_fields->'content_blocks', '[]'::jsonb),
    content_mode = coalesce(p_fields->>'content_mode', 'visual'),
    footer_enabled = coalesce((p_fields->>'footer_enabled')::boolean, true),
    animation_enabled = coalesce((p_fields->>'animation_enabled')::boolean, true),
    status = 'published',
    published_at = publish_time,
    published_by = p_publisher_id,
    published_version = next_version,
    draft_content = null,
    draft_updated_at = null,
    updated_by = p_publisher_id,
    updated_at = publish_time
  where id = p_page_id
  returning * into published_page;

  return published_page;
end;
$$;

revoke all on function public.publish_cms_page(uuid, jsonb, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.publish_cms_page(uuid, jsonb, uuid, timestamptz) to service_role;

comment on function public.publish_cms_page(uuid, jsonb, uuid, timestamptz) is
  'Atomically records an immutable published version and switches the public CMS page snapshot. Call only after Edge Function authentication and cms.publish authorization.';

notify pgrst, 'reload schema';
