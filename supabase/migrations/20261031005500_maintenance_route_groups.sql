-- Extend the existing emergency maintenance target without creating a second
-- maintenance store. Site, exact route, route group, and legacy page scopes all
-- continue to use the existing site_settings row and authorization flow.
alter table public.site_settings
  drop constraint if exists site_settings_maintenance_scope_check;

alter table public.site_settings
  add constraint site_settings_maintenance_scope_check
  check (maintenance_scope in ('site', 'page', 'route', 'group'));
