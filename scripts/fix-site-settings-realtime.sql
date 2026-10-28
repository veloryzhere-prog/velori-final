-- Run this in Supabase Dashboard → SQL Editor to add site_settings to realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'site_settings'
     ) then
    alter publication supabase_realtime add table public.site_settings;
  end if;
end;
$$;

alter table public.site_settings replica identity default;