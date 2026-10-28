-- Remove browser write privileges on the single-row public site configuration.
--
-- `anon` and `authenticated` hold INSERT/UPDATE/DELETE/TRUNCATE on
-- `public.site_settings` at the table-privilege level. Nothing in the browser
-- bundle writes this table -- the only client access is the SELECT in
-- `src/lib/site-settings.tsx`, and every administrative write goes through the
-- Edge Function with the service role.
--
-- Today the table is saved purely by the absence of a write policy: RLS is on
-- and "Public reads site settings" is `for select`, so an anonymous PATCH and
-- DELETE both match zero rows (`content-range=*/0`) rather than erroring. That
-- is one policy away from handing every visitor control of the site name, logo,
-- contact details and maintenance mode. The privilege should not be the thing
-- protecting it.
--
-- Making `site_settings` realtime-published (migration
-- 20261031000000) makes this structural rather than cosmetic: a table whose rows
-- are broadcast to every subscriber should not also grant browsers write.

revoke insert, update, delete, truncate on public.site_settings from anon, authenticated;

grant select on public.site_settings to anon, authenticated;

comment on table public.site_settings is
  'Single-row public site configuration. Read-only for anon/authenticated, written only by the Edge Function service role, and published to supabase_realtime so every open tab converges on an administrator save without a reload.';