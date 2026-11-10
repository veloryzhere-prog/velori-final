-- Extend the single advertisements registry with campaign-level creative fields.
-- Existing rows remain valid and continue to use their current placement and media.

alter table public.advertisements
  add column if not exists campaign_name text not null default '',
  add column if not exists advertiser_name text not null default 'VELORI',
  add column if not exists cta_label text not null default 'Learn more',
  add column if not exists creative_type text not null default 'image',
  add column if not exists archived_at timestamptz;

alter table public.advertisements
  drop constraint if exists advertisements_campaign_name_length_check,
  add constraint advertisements_campaign_name_length_check
    check (char_length(campaign_name) <= 120),
  drop constraint if exists advertisements_advertiser_name_length_check,
  add constraint advertisements_advertiser_name_length_check
    check (char_length(advertiser_name) between 1 and 120),
  drop constraint if exists advertisements_cta_label_length_check,
  add constraint advertisements_cta_label_length_check
    check (char_length(cta_label) between 1 and 32),
  drop constraint if exists advertisements_creative_type_check,
  add constraint advertisements_creative_type_check
    check (creative_type in ('image', 'video', 'link'));

-- These are display-safe fields only. Campaign names, targeting, schedules,
-- counters and administrative metadata stay behind the service-role API.
grant select (advertiser_name, cta_label, creative_type)
  on public.advertisements to anon, authenticated;

create index if not exists advertisements_campaign_search_idx
  on public.advertisements (lower(campaign_name), lower(title));

