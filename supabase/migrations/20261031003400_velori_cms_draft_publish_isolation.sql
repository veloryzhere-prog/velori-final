-- Keep unpublished edits separate from the public page snapshot. Public readers
-- continue selecting the canonical columns and therefore never see a draft.
alter table public.cms_pages
  add column if not exists draft_content jsonb,
  add column if not exists draft_updated_at timestamptz;

alter table public.cms_pages
  drop constraint if exists cms_pages_draft_content_object_check;

alter table public.cms_pages
  add constraint cms_pages_draft_content_object_check
  check (draft_content is null or jsonb_typeof(draft_content) = 'object');

comment on column public.cms_pages.draft_content is
  'Validated unpublished page fields. Public routes must render canonical columns only.';

alter table public.cms_page_versions
  add column if not exists og_image text default '',
  add column if not exists footer_enabled boolean not null default true,
  add column if not exists animation_enabled boolean not null default true;
