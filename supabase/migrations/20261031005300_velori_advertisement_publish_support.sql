-- Add publish support for advertisements: versioning, draft payload, version history, and publish RPC

-- 1. Add version and draft_payload columns to advertisements
alter table public.advertisements
  add column if not exists version integer not null default 1,
  add column if not exists draft_payload jsonb;

alter table public.advertisements
  add constraint advertisements_version_check check (version >= 1);

-- 2. Create advertisement_versions table for immutable history
create table if not exists public.advertisement_versions (
  id bigint generated always as identity primary key,
  advertisement_id uuid not null references public.advertisements(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (advertisement_id, version)
);

alter table public.advertisement_versions enable row level security;
revoke all on public.advertisement_versions from public, anon, authenticated;
grant all on public.advertisement_versions to service_role;

-- 3. Create publish_advertisement RPC function
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
  if item.creative_type <> 'link' and item.image_url = '' then raise exception 'Upload or provide the creative image/video.' using errcode = '22023'; end if;
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
    'starts_at', item.starts_at,
    'ends_at', item.ends_at
  ), p_admin_id);

  return item;
end;
$$;

revoke all on function public.publish_advertisement(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.publish_advertisement(uuid, uuid, integer) to service_role;

-- 4. Add advertisements to realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'advertisements'
     ) then
    alter publication supabase_realtime add table public.advertisements;
  end if;
end;
$$;

notify pgrst, 'reload schema';