-- Live invalidation for public site settings.
--
-- `site_settings` was already world-readable (grant select to anon, authenticated
-- plus the "Public reads site settings" policy), and the public shell already
-- fetches it on mount, but it had no invalidation channel at all. An administrator
-- saving maintenance mode, the homepage banner, branding or the startup/error
-- animation URLs therefore changed only the tab that performed the save: a second
-- browser tab kept rendering the stale configuration until a manual reload.
--
-- The published motion document already invalidates live through
-- `motion_publication_events`. This adds the same mechanism for the settings row
-- so both halves of the public runtime configuration layer converge without a
-- second fetch path and without any new table.

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

-- The client only ever needs the `new` record, so the default replica identity is
-- sufficient. Set explicitly so a future `REPLICA IDENTITY FULL` on another table
-- cannot make this subscription silently expensive.
alter table public.site_settings replica identity default;

-- Guard: an UPDATE with no `updated_at` change must still reach subscribers, so
-- the invalidation cannot depend on a trigger the admin paths do not always fire.
comment on table public.site_settings is
  'Single-row public site configuration. Published to supabase_realtime so every open tab converges on an administrator save without a reload.';