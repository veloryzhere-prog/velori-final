# VELORI environment administration — V33

The isolated `velori-environment` backend is ACTIVE at version 5. See `docs/v33/RELEASE.md` for actual verification, owner prerequisites and rollback. No provider credential has been invented, extracted or installed during development.

The endpoint retains existing administrator session validation, `security.edit`, super-admin-only access, origin checks and a strict five-minute recent password confirmation for mutations. Secret values are never returned. An audit request must succeed before any mutation.

GET `/functions/v1/velori-environment/admin/environment` returns redacted configured status after Management API verification, or `setupRequired:true` when the server lacks its management credential. Authenticated POST with operation `setup` can install only that missing root management token after exact-name confirmation, remote project read verification and successful audit. It cannot replace an already configured management root. Use the Supabase dashboard for controlled root recovery/rotation.

The browser setup form accepts the owner-issued token only in transient component state, sends it by HTTPS to the protected endpoint, then clears the input. The backend writes it using Supabase's official project secrets API; it never stores it in a table or browser storage. Prefer a token scoped to this project with Edge Functions Secrets read/write permission. Supabase may need time to refresh function environments; refresh status before setting provider keys.

Existing `/admin/forge/rotation` credential testing, activation and previous-key rollback handlers are preserved. The page now uses them for Gemini and Stripe credentials. Configure a Gemini model before testing its candidate key. Webhook tests check format only; actual signed delivery remains mandatory. Other supported values use exact-name set/delete. Root Supabase and encryption keys are not exposed by this allowlist.

Existing Forge configuration, plan verification and project administration handlers are retained. Unsupported subscriptions and coupons are not activated. Frontend VITE_ values still require a rebuild. Runtime SMTP variables do not configure Supabase Auth's external SMTP service or a new relay by themselves.

Automated tests and an anonymous HTTP-401 probe passed. Valid management bootstrap/provider writes remain unverified because the owner credential is not available through the connected plugin. See the focused release report for the exact limits.


## V33.1.4 management status diagnostics

The environment status endpoint verifies the stored management credential against the project's secret-list endpoint instead of treating token length as proof that the credential works. It returns safe, actionable diagnostics for HTTP 401 (invalid/expired/revoked token), 403 (scope or project-role permissions), 404 (project reference or endpoint), 429 (rate limiting), 5xx (provider outage), and network/timeout failures. Provider response bodies and credential values are never returned. The admin console displays the diagnostic and the recovery hint.

For scoped PATs, choose the exact project and the **Edge Function Secrets** permission with both Read and Read-write access. The token is still limited by the account's own project role. If the stored root credential is invalid, rotate it directly in Supabase Dashboard → Edge Functions → Secrets; the protected setup endpoint intentionally cannot overwrite an already-installed root credential.
