-- Let administrators target maintenance mode at the entire site or one route.
alter table public.site_settings
  add column if not exists maintenance_scope text not null default 'site'
    check (maintenance_scope in ('site', 'page')),
  add column if not exists maintenance_route text;
