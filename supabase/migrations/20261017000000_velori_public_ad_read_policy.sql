-- Restore the narrow public read path used by the feed/search ad renderer.
-- Migration 140 intentionally made campaign management service-role-only, but
-- it also left the public app unable to read even active placements.
-- Campaign writes, targeting, and metrics remain protected.

alter table public.advertisements enable row level security;
revoke all on public.advertisements from public, anon, authenticated;

grant select (id, title, body, image_url, target_url, placement, status, priority)
  on public.advertisements to anon, authenticated;

drop policy if exists "Public reads active untargeted advertisements"
  on public.advertisements;
create policy "Public reads active untargeted advertisements"
  on public.advertisements for select to anon, authenticated
  using (
    status = 'active'
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and audience = '{}'::jsonb
    and (
      target_url = ''
      or target_url ~ '^https://'
      or (target_url ~ '^/' and target_url !~ '^//')
    )
    and exists (
      select 1 from public.feature_flags flags
       where flags.key = 'ads_enabled'
         and flags.enabled
    )
  );

do $$
begin
  if not has_column_privilege('anon', 'public.advertisements', 'title', 'select')
     or not has_column_privilege('authenticated', 'public.advertisements', 'priority', 'select') then
    raise exception 'Public advertisement display columns are not readable.';
  end if;
  if has_table_privilege('anon', 'public.advertisements', 'insert')
     or has_table_privilege('anon', 'public.advertisements', 'update')
     or has_table_privilege('authenticated', 'public.advertisements', 'insert')
     or has_table_privilege('authenticated', 'public.advertisements', 'delete') then
    raise exception 'Browser roles must not manage advertisement campaigns.';
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'advertisements'
       and policyname = 'Public reads active untargeted advertisements'
  ) then
    raise exception 'The public advertisement read policy is missing.';
  end if;
end;
$$;