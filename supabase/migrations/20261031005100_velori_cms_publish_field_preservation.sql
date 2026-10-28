-- Fix publish_cms_page to only update fields present in p_fields
-- This prevents clearing custom_html, custom_css, content_blocks, content_mode
-- when they are not included in the publish request.

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
  v_title text;
  v_slug text;
  v_route text;
  v_content text;
  v_seo_title text;
  v_seo_description text;
  v_og_title text;
  v_og_description text;
  v_og_image text;
  v_hero_image text;
  v_custom_html text;
  v_custom_css text;
  v_custom_js text;
  v_content_blocks jsonb;
  v_content_mode text;
  v_footer_enabled boolean;
  v_animation_enabled boolean;
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

  -- Extract fields from p_fields, falling back to current_page values for missing keys
  v_title := coalesce(nullif(p_fields->>'title', ''), current_page.title);
  v_slug := coalesce(nullif(p_fields->>'slug', ''), current_page.slug);
  v_route := coalesce(nullif(p_fields->>'route', ''), current_page.route);
  v_content := coalesce(p_fields->>'content', current_page.content);
  v_seo_title := coalesce(p_fields->>'seo_title', current_page.seo_title);
  v_seo_description := coalesce(p_fields->>'seo_description', current_page.seo_description);
  v_og_title := coalesce(p_fields->>'og_title', current_page.og_title);
  v_og_description := coalesce(p_fields->>'og_description', current_page.og_description);
  v_og_image := coalesce(p_fields->>'og_image', current_page.og_image);
  v_hero_image := coalesce(p_fields->>'hero_image', current_page.hero_image);
  v_custom_html := coalesce(p_fields->>'custom_html', current_page.custom_html);
  v_custom_css := coalesce(p_fields->>'custom_css', current_page.custom_css);
  v_custom_js := coalesce(p_fields->>'custom_js', current_page.custom_js);
  v_content_blocks := coalesce(p_fields->'content_blocks', current_page.content_blocks);
  v_content_mode := coalesce(nullif(p_fields->>'content_mode', ''), current_page.content_mode);
  v_footer_enabled := coalesce((p_fields->>'footer_enabled')::boolean, current_page.footer_enabled);
  v_animation_enabled := coalesce((p_fields->>'animation_enabled')::boolean, current_page.animation_enabled);

  insert into public.cms_page_versions (
    page_id, version_label, title, slug, route, content, seo_title,
    seo_description, og_title, og_description, og_image, hero_image,
    custom_html, custom_css, custom_js, content_blocks, content_mode,
    footer_enabled, animation_enabled, created_by, created_at
  ) values (
    p_page_id, 'v' || next_version,
    v_title, v_slug, v_route,
    v_content, v_seo_title, v_seo_description, v_og_title, v_og_description, v_og_image, v_hero_image,
    v_custom_html, v_custom_css, v_custom_js, v_content_blocks, v_content_mode,
    v_footer_enabled, v_animation_enabled, p_publisher_id, publish_time
  );

  update public.cms_pages set
    title = v_title,
    slug = v_slug,
    route = v_route,
    content = v_content,
    seo_title = v_seo_title,
    seo_description = v_seo_description,
    og_title = v_og_title,
    og_description = v_og_description,
    og_image = v_og_image,
    hero_image = v_hero_image,
    custom_html = v_custom_html,
    custom_css = v_custom_css,
    custom_js = v_custom_js,
    content_blocks = v_content_blocks,
    content_mode = v_content_mode,
    footer_enabled = v_footer_enabled,
    animation_enabled = v_animation_enabled,
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
  'Atomically records an immutable published version and switches the public CMS page snapshot. Call only after Edge Function authentication and cms.publish authorization. Only updates fields present in p_fields; missing fields retain their current values.';

notify pgrst, 'reload schema';