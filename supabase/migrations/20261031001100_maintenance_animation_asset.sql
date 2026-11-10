-- dedicated maintenance artwork for the global maintenance screen.
alter table public.site_settings
  add column if not exists maintenance_animation_url text;
