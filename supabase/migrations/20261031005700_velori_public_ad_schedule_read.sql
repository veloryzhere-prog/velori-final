-- Schedule columns are required by the public renderer's active-window filters.
-- RLS still limits visible rows to active, currently eligible campaigns.
grant select (starts_at, ends_at)
  on public.advertisements to anon, authenticated;

do $$
begin
  if not has_column_privilege('anon', 'public.advertisements', 'starts_at', 'select')
     or not has_column_privilege('anon', 'public.advertisements', 'ends_at', 'select')
     or not has_column_privilege('authenticated', 'public.advertisements', 'starts_at', 'select')
     or not has_column_privilege('authenticated', 'public.advertisements', 'ends_at', 'select') then
    raise exception 'Public advertisement schedule filters are not readable.';
  end if;
end;
$$;
