-- Move administrator sessions off Supabase Auth bearer tokens. The opaque token
-- is returned once to the browser (and set as an HttpOnly cookie); only its
-- SHA-256 digest is stored here. Existing email-login sessions are invalidated.

alter table public.admin_sessions
  add column if not exists session_token_hash text
    check (session_token_hash is null or session_token_hash ~ '^[0-9a-f]{64}$');

create unique index if not exists admin_sessions_token_hash_idx
  on public.admin_sessions (session_token_hash)
  where session_token_hash is not null;

comment on column public.admin_sessions.session_token_hash is
  'SHA-256 digest of the opaque VELORI admin session token. The raw token is never stored in PostgreSQL.';

comment on table public.admin_sessions is
  'Separate VELORI administrator sessions. Browsers use an HttpOnly cookie when available and a short-lived per-tab fallback token otherwise; PostgreSQL stores only the SHA-256 token digest.';

update public.admin_sessions
   set revoked_at = coalesce(revoked_at, now()),
       revoke_reason = case
         when revoked_at is null then 'replaced_email_admin_auth'
         else revoke_reason
       end
 where session_token_hash is null
   and revoked_at is null;

