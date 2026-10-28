alter table public.cms_pages
  add column if not exists custom_html text not null default '',
  add column if not exists custom_css text not null default '';

alter table public.cms_pages
  drop constraint if exists cms_pages_custom_html_length_check,
  drop constraint if exists cms_pages_custom_css_length_check;

alter table public.cms_pages
  add column if not exists custom_js text not null default '',
  add constraint cms_pages_custom_html_length_check
    check (char_length(custom_html) <= 60000),
  add constraint cms_pages_custom_css_length_check
    check (char_length(custom_css) <= 50000),
  add constraint cms_pages_custom_js_length_check
    check (char_length(custom_js) <= 50000);

alter table public.cms_page_versions
  add column if not exists custom_html text not null default '',
  add column if not exists custom_css text not null default '',
  add column if not exists custom_js text not null default '';

alter table public.cms_page_versions
  drop constraint if exists cms_page_versions_custom_html_length_check,
  drop constraint if exists cms_page_versions_custom_css_length_check,
  drop constraint if exists cms_page_versions_custom_js_length_check;

alter table public.cms_page_versions
  add constraint cms_page_versions_custom_html_length_check
    check (char_length(custom_html) <= 60000),
  add constraint cms_page_versions_custom_css_length_check
    check (char_length(custom_css) <= 50000),
  add constraint cms_page_versions_custom_js_length_check
    check (char_length(custom_js) <= 50000);

comment on column public.cms_pages.custom_html is
  'Sanitized page HTML override. Render only in the script-disabled, CSP-restricted public page sandbox.';
comment on column public.cms_pages.custom_css is
  'Validated page CSS override. Render only inside the isolated public page sandbox.';
comment on column public.cms_pages.custom_js is
  'Sanitized page JavaScript override. Render only inside the isolated public page sandbox.';
