alter table public.site_settings
  add column if not exists pwa_install_enabled boolean not null default true,
  add column if not exists pwa_install_title text not null default 'Install VELORI',
  add column if not exists pwa_install_description text not null default 'Add VELORI to your home screen for a faster, app-like experience.',
  add column if not exists pwa_install_cta text not null default 'Install';

alter table public.site_settings
  drop constraint if exists site_settings_pwa_install_title_length,
  add constraint site_settings_pwa_install_title_length
    check (char_length(trim(pwa_install_title)) between 1 and 48),
  drop constraint if exists site_settings_pwa_install_description_length,
  add constraint site_settings_pwa_install_description_length
    check (char_length(trim(pwa_install_description)) between 1 and 140),
  drop constraint if exists site_settings_pwa_install_cta_length,
  add constraint site_settings_pwa_install_cta_length
    check (char_length(trim(pwa_install_cta)) between 1 and 20);
