alter table public.cms_pages
  add column if not exists content_blocks jsonb not null default '[]'::jsonb,
  add column if not exists content_mode text not null default 'visual';

alter table public.cms_pages
  drop constraint if exists cms_pages_content_blocks_array_check,
  drop constraint if exists cms_pages_content_mode_check;

alter table public.cms_pages
  add constraint cms_pages_content_blocks_array_check
    check (jsonb_typeof(content_blocks) = 'array'),
  add constraint cms_pages_content_mode_check
    check (content_mode in ('visual', 'custom_html'));

alter table public.cms_page_versions
  add column if not exists content_blocks jsonb not null default '[]'::jsonb,
  add column if not exists content_mode text not null default 'visual';

alter table public.cms_page_versions
  drop constraint if exists cms_page_versions_content_blocks_array_check,
  drop constraint if exists cms_page_versions_content_mode_check;

alter table public.cms_page_versions
  add constraint cms_page_versions_content_blocks_array_check
    check (jsonb_typeof(content_blocks) = 'array'),
  add constraint cms_page_versions_content_mode_check
    check (content_mode in ('visual', 'custom_html'));

comment on column public.cms_pages.content_blocks is
  'Validated ordered visual/HTML page blocks. The Edge Function enforces block types, limits, IDs and URL safety.';
comment on column public.cms_pages.content_mode is
  'Selected public content source: visual blocks or the sanitized custom_html field.';
