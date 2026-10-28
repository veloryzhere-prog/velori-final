-- Theme values are public presentation configuration. The admin API remains the
-- only writer; public clients may read the row and subscribe to its updates.
alter table public.theme_settings enable row level security;

drop policy if exists "Public reads theme settings" on public.theme_settings;
create policy "Public reads theme settings" on public.theme_settings
  for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.theme_settings from public, anon, authenticated;
grant select on public.theme_settings to anon, authenticated;
grant all on public.theme_settings to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'theme_settings'
     ) then
    alter publication supabase_realtime add table public.theme_settings;
  end if;
end;
$$;
