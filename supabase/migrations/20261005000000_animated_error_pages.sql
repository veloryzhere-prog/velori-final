-- Admin-controlled animated 404 artwork for missing routes and route errors.
alter table public.site_settings
  add column if not exists error_404_enabled boolean not null default true;
