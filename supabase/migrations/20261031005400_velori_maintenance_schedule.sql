alter table public.site_settings
  add column if not exists maintenance_starts_at timestamptz,
  add column if not exists maintenance_ends_at timestamptz;

alter table public.site_settings
  drop constraint if exists site_settings_maintenance_window_check;

alter table public.site_settings
  add constraint site_settings_maintenance_window_check
  check (
    maintenance_starts_at is null
    or maintenance_ends_at is null
    or maintenance_ends_at > maintenance_starts_at
  );

notify pgrst, 'reload schema';
