# VELORI staging deployment manifest

This manifest documents the server-side configuration names required for the verified `velori-studio` service. No secret values are stored in this document.

## Required generation runtime variables

The deployed Edge Function reads these names before accepting generation requests. Supabase supplies `SUPABASE_URL`. Configure one supported credential name from each alternative group; values must be stored only in protected Edge Function settings.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEYS` (JSON dictionary with a `default` string)
- One of `VELORI_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, or `SUPABASE_ANON_KEY`; alternatively `SUPABASE_PUBLISHABLE_KEYS` (JSON dictionary with a `default` string)
- `VELORI_STUDIO_ENABLED`
- `VELORI_STUDIO_GENERATION_ENABLED`
- `VELORI_STUDIO_ORIGINS`
- `VELORI_STUDIO_ENCRYPTION_KEY`
- `GEMINI_API_KEY`
- `VELORI_GEMINI_MODEL`

Optional AI runtime settings:

- `VELORI_GEMINI_PREMIUM_MODEL`
- `VELORI_GEMINI_FALLBACK_MODEL`
- `VELORI_STUDIO_DAILY_PROVIDER_CAP` (defaults to the source-defined cap when unset)

Optional billing settings (not needed to prove AI generation):

- `VELORI_APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `VELORI_STRIPE_LIVE`
- `VELORI_STRIPE_PACK100_INR_PRICE`
- `VELORI_STRIPE_PACK100_USD_PRICE`
- `VELORI_STRIPE_PREMIUM_INR_PRICE`
- `VELORI_STRIPE_PREMIUM_USD_PRICE`
- `VELORI_STRIPE_PRO_MONTHLY_INR_PRICE`
- `VELORI_STRIPE_PRO_MONTHLY_USD_PRICE`

## Protected runtime rules

- `GEMINI_API_KEY` and `VELORI_STUDIO_ENCRYPTION_KEY` remain server-only and are never exposed to the browser build.
- `VELORI_STUDIO_ENABLED` and `VELORI_STUDIO_GENERATION_ENABLED` must both be set to `true` before generation requests are accepted.
- `VELORI_STUDIO_ORIGINS` must contain the exact approved site origins, including the production or staging site origin used by the app.
- `VELORI_APP_URL` must match the configured app origin without a path.
- `VELORI_GEMINI_MODEL` must be a valid configured Gemini model name before the runtime performs a provider call.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must be validated and tested separately through admin rotation flows before enabling commercial billing.

## Request security and migration dependencies

- The function accepts `POST` and CORS preflight `OPTIONS`; browser origins must exactly match `VELORI_STUDIO_ORIGINS`.
- Status readiness is public but reports capability booleans only. Protected actions require a real, non-anonymous Supabase user access token and are verified with `auth.getUser()`.
- Direct staging probes must use the project's public publishable/anon key as `apikey` and the test user's access token as `Authorization: Bearer ...`. Never use the service-role key from a client or test browser.
- Apply the base Studio schema migration and the local-only receipt migration documented below before deploying the matching Edge Function.

## Required operational checks before staging approval

1. Confirm the Supabase project is selected and the Edge runtime is the same project that owns the app.
2. Apply migrations through `20261024232208_velori_forge_studio.sql`, then apply `20261027000100_velori_forge_local_only_receipts.sql`. The latter installs the `velori_studio_finish_local` RPC called by the Edge Function. Do not deploy the function before this RPC exists.
3. Confirm the `velori-studio` function is deployed with protected secrets loaded by the host, not by Vite/browser environment files.
4. Set the exact staging site origin in `VELORI_STUDIO_ORIGINS`; do not rely on the source's production default origin.
5. Enable generation only after the protected provider key and configured model pass a real staging runtime test.
6. Configure Stripe billing separately, only after a tested webhook secret and valid prices are present.

## Secret handling policy

- Never commit the actual values to source control.
- Never place provider credentials in `.env.local`, browser bundles, or VITE_ variables.
- Use the host’s protected secret storage, Supabase project secrets, or approved deployment secret injection.
- Record only variable names and validation logic here; never values, tokens, or raw API keys.
