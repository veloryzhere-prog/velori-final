-- Keep custom creatives in the existing ad and announcement records. Markup is
-- sanitized by the authenticated Edge Function before it reaches these columns.

alter table public.advertisements
  add column if not exists custom_html text not null default '',
  add column if not exists custom_css text not null default '';

alter table public.advertisements
  drop constraint if exists advertisements_creative_type_check,
  add constraint advertisements_creative_type_check
    check (creative_type in ('image', 'video', 'link', 'html'));

grant select (custom_html, custom_css)
  on public.advertisements to anon, authenticated;

alter table public.system_announcements
  add column if not exists custom_html text not null default '',
  add column if not exists custom_css text not null default '';

grant select (custom_html, custom_css)
  on public.system_announcements to anon, authenticated;

create or replace function public.publish_advertisement(
  p_advertisement_id uuid,
  p_admin_id uuid,
  p_expected_version integer
)
returns public.advertisements
language plpgsql
security definer
set search_path to ''
as $$
declare
  item public.advertisements;
begin
  select * into item from public.advertisements where id = p_advertisement_id for update;
  if not found then raise exception 'Advertisement not found.' using errcode = 'P0002'; end if;
  if item.version <> p_expected_version then raise exception 'Advertisement changed since it was opened.' using errcode = '40001'; end if;
  if char_length(trim(item.title)) = 0 then raise exception 'Title is required.' using errcode = '22023'; end if;
  if char_length(trim(item.advertiser_name)) = 0 then raise exception 'Advertiser name is required.' using errcode = '22023'; end if;
  if char_length(trim(item.cta_label)) = 0 then raise exception 'Call to action label is required.' using errcode = '22023'; end if;
  if item.creative_type = 'html' and char_length(trim(item.custom_html)) = 0 then raise exception 'Custom HTML is required.' using errcode = '22023'; end if;
  if item.creative_type in ('image', 'video') and item.image_url = '' then raise exception 'Upload or provide the creative image/video.' using errcode = '22023'; end if;
  if item.target_url <> '' and item.target_url !~* '^https://' and (item.target_url !~ '^/' or item.target_url ~ '^//') then raise exception 'Destination URL is not safe.' using errcode = '22023'; end if;
  if item.placement not in ('feed', 'search') then raise exception 'Placement must be feed or search for public display.' using errcode = '22023'; end if;
  if item.ends_at is not null and item.starts_at is not null and item.ends_at <= item.starts_at then raise exception 'End time must follow start time.' using errcode = '22023'; end if;
  if item.ends_at is not null and item.ends_at <= now() then raise exception 'An advertisement cannot be published after its end time.' using errcode = '22023'; end if;

  if item.draft_payload is not null then
    update public.advertisements set
      title = coalesce(item.draft_payload->>'title', item.title),
      campaign_name = coalesce(item.draft_payload->>'campaign_name', item.campaign_name),
      advertiser_name = coalesce(item.draft_payload->>'advertiser_name', item.advertiser_name),
      body = coalesce(item.draft_payload->>'body', item.body),
      image_url = coalesce(item.draft_payload->>'image_url', item.image_url),
      target_url = coalesce(item.draft_payload->>'target_url', item.target_url),
      placement = coalesce(item.draft_payload->>'placement', item.placement),
      priority = coalesce((item.draft_payload->>'priority')::integer, item.priority),
      cta_label = coalesce(item.draft_payload->>'cta_label', item.cta_label),
      creative_type = coalesce(item.draft_payload->>'creative_type', item.creative_type),
      custom_html = coalesce(item.draft_payload->>'custom_html', item.custom_html),
      custom_css = coalesce(item.draft_payload->>'custom_css', item.custom_css),
      starts_at = coalesce((item.draft_payload->>'starts_at')::timestamptz, item.starts_at),
      ends_at = (item.draft_payload->>'ends_at')::timestamptz,
      draft_payload = null
    where id = item.id returning * into item;
  end if;

  item.version := item.version + 1;
  item.status := case when item.starts_at > now() then 'scheduled' else 'active' end;
  item.updated_at := now();
  update public.advertisements set version = item.version, status = item.status, updated_at = now() where id = item.id returning * into item;

  insert into public.advertisement_versions (advertisement_id, version, snapshot, created_by)
  values (item.id, item.version, jsonb_build_object(
    'title', item.title,
    'campaign_name', item.campaign_name,
    'advertiser_name', item.advertiser_name,
    'body', item.body,
    'image_url', item.image_url,
    'target_url', item.target_url,
    'placement', item.placement,
    'priority', item.priority,
    'cta_label', item.cta_label,
    'creative_type', item.creative_type,
    'custom_html', item.custom_html,
    'custom_css', item.custom_css,
    'starts_at', item.starts_at,
    'ends_at', item.ends_at
  ), p_admin_id);

  return item;
end;
$$;

revoke all on function public.publish_advertisement(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.publish_advertisement(uuid, uuid, integer) to service_role;

create or replace function public.publish_system_announcement(p_announcement_id uuid, p_admin_id uuid, p_expected_version integer)
returns public.system_announcements
language plpgsql
security definer
set search_path to ''
as $$
declare
  item public.system_announcements;
begin
  select * into item from public.system_announcements where id = p_announcement_id for update;
  if not found then raise exception 'Announcement not found.' using errcode = 'P0002'; end if;
  if item.version <> p_expected_version then raise exception 'Announcement changed since it was opened.' using errcode = '40001'; end if;
  if char_length(trim(item.title)) = 0 or (char_length(trim(item.message)) = 0 and char_length(trim(item.custom_html)) = 0) then raise exception 'Title and either message or custom HTML are required.' using errcode = '22023'; end if;
  if item.media_type <> 'none' and item.media_url = '' then raise exception 'Upload or provide the selected announcement media.' using errcode = '22023'; end if;
  if item.media_type = 'image' and char_length(trim(item.media_alt)) = 0 then raise exception 'Image alt text is required.' using errcode = '22023'; end if;
  if item.action_type <> 'none' and (char_length(trim(item.cta_label)) = 0 or char_length(trim(item.link)) = 0) then raise exception 'A button label and destination are required.' using errcode = '22023'; end if;
  if item.link <> '' and item.link !~* '^https://' and (item.link !~ '^/' or item.link ~ '^//') then raise exception 'Announcement URL is not safe.' using errcode = '22023'; end if;
  if item.action_type = 'internal' and (item.link !~ '^/' or item.link ~ '^//') then raise exception 'Internal action must use a site route.' using errcode = '22023'; end if;
  if item.action_type = 'external' and item.link !~* '^https://' then raise exception 'External action must use HTTPS.' using errcode = '22023'; end if;
  if item.ends_at is not null and item.ends_at <= item.starts_at then raise exception 'End time must follow start time.' using errcode = '22023'; end if;
  if item.ends_at is not null and item.ends_at <= now() then raise exception 'An announcement cannot be published after its end time.' using errcode = '22023'; end if;
  if item.draft_payload is not null then
    update public.system_announcements set
      title = coalesce(item.draft_payload->>'title', item.title),
      message = coalesce(item.draft_payload->>'message', item.message),
      custom_html = coalesce(item.draft_payload->>'custom_html', item.custom_html),
      custom_css = coalesce(item.draft_payload->>'custom_css', item.custom_css),
      internal_name = coalesce(item.draft_payload->>'internal_name', item.internal_name),
      priority = coalesce(item.draft_payload->>'priority', item.priority),
      audience = coalesce(item.draft_payload->>'audience', item.audience),
      icon = coalesce(item.draft_payload->>'icon', item.icon),
      link = coalesce(item.draft_payload->>'link', item.link),
      dismissible = coalesce((item.draft_payload->>'dismissible')::boolean, item.dismissible),
      starts_at = coalesce((item.draft_payload->>'starts_at')::timestamptz, item.starts_at),
      ends_at = (item.draft_payload->>'ends_at')::timestamptz,
      display_mode = coalesce(item.draft_payload->>'display_mode', item.display_mode),
      media_type = coalesce(item.draft_payload->>'media_type', item.media_type),
      media_url = coalesce(item.draft_payload->>'media_url', item.media_url),
      media_alt = coalesce(item.draft_payload->>'media_alt', item.media_alt),
      poster_url = coalesce(item.draft_payload->>'poster_url', item.poster_url),
      cta_label = coalesce(item.draft_payload->>'cta_label', item.cta_label),
      action_type = coalesce(item.draft_payload->>'action_type', item.action_type),
      target_route = coalesce(item.draft_payload->>'target_route', item.target_route),
      target_routes = case when item.draft_payload ? 'target_routes' then array(select jsonb_array_elements_text(item.draft_payload->'target_routes')) else item.target_routes end,
      frequency_mode = coalesce(item.draft_payload->>'frequency_mode', item.frequency_mode),
      max_show_count = coalesce((item.draft_payload->>'max_show_count')::integer, item.max_show_count),
      delay_seconds = coalesce((item.draft_payload->>'delay_seconds')::integer, item.delay_seconds),
      draft_payload = null
    where id = item.id returning * into item;
  end if;
  item.version := item.version + 1;
  item.active := true;
  item.state := case when item.starts_at > now() then 'scheduled' else 'live' end;
  item.updated_at := now();
  update public.system_announcements set version = item.version, active = true, state = item.state, updated_at = now() where id = item.id returning * into item;
  delete from public.system_announcement_user_state where announcement_id = item.id;
  insert into public.system_announcement_versions (announcement_id, version, snapshot, created_by)
  values (item.id, item.version, jsonb_build_object(
    'title', item.title, 'message', item.message, 'custom_html', item.custom_html,
    'custom_css', item.custom_css, 'internal_name', item.internal_name,
    'priority', item.priority, 'display_mode', item.display_mode, 'media_type', item.media_type,
    'media_url', item.media_url, 'media_alt', item.media_alt, 'poster_url', item.poster_url,
    'cta_label', item.cta_label, 'action_type', item.action_type, 'link', item.link,
    'target_route', item.target_route, 'target_routes', item.target_routes,
    'starts_at', item.starts_at, 'ends_at', item.ends_at, 'frequency_mode', item.frequency_mode,
    'max_show_count', item.max_show_count, 'delay_seconds', item.delay_seconds,
    'dismissible', item.dismissible
  ), p_admin_id);
  return item;
end;
$$;

revoke all on function public.publish_system_announcement(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.publish_system_announcement(uuid, uuid, integer) to service_role;

notify pgrst, 'reload schema';
