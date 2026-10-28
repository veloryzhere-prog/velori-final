-- Change an administrator password and revoke every active session atomically.
-- This prevents a committed password change from leaving old sessions usable.

create or replace function public.admin_change_password_and_revoke_sessions(
  p_user_id uuid,
  p_password_hash text,
  p_changed_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_account_id uuid;
  revoked_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  if p_password_hash !~ '^pbkdf2\$[0-9]+\$[A-Za-z0-9+/]+={0,2}\$[A-Za-z0-9+/]+={0,2}$' then
    raise exception using errcode = '22023', message = 'invalid administrator password hash';
  end if;

  update public.admin_accounts
     set password_hash = p_password_hash,
         must_change_password = false,
         failed_attempts = 0,
         locked_until = null,
         password_changed_at = p_changed_at
   where user_id = p_user_id
     and enabled
  returning id into changed_account_id;

  if changed_account_id is null then
    raise exception using errcode = 'P0002', message = 'enabled administrator credential not found';
  end if;

  update public.admin_profiles
     set must_change_password = false,
         password_changed_at = p_changed_at,
         updated_at = p_changed_at
   where user_id = p_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'administrator profile not found';
  end if;

  update public.admin_sessions
     set revoked_at = p_changed_at,
         revoked_by = p_user_id,
         revoke_reason = 'password_changed'
   where admin_user_id = p_user_id
     and revoked_at is null;

  get diagnostics revoked_count = row_count;
  return revoked_count;
end;
$$;

revoke all on function public.admin_change_password_and_revoke_sessions(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.admin_change_password_and_revoke_sessions(uuid, text, timestamptz)
  to service_role;
