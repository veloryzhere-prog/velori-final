# VELORI Supabase deployment

## Configure the new project

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` to the new project's Project URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to its public publishable key. Find both in Supabase Dashboard → Project Settings → API.
3. Set `VELORI_ALLOWED_ORIGINS` to comma-separated exact HTTPS origins for the deployed site (no path or wildcard). Local development origins are included by the Edge Function.
4. Restart Vite after changing environment values. Do not place a service-role key, database password, SMTP credential, or deployment token in a `VITE_` variable or `.env.local`.

The frontend uses these values directly and has no embedded project/key fallback. Missing or malformed frontend configuration stops startup with a clear error.

## Creator Studio source saves and Netlify

Local Creator Studio saves are written to the checkout and appear in the local Vite site through hot reload. After the scoped GitHub push is confirmed, the source workbench can request a Netlify build for that same branch. A successful hook response means the build was queued; it does not confirm that the site has finished building or publishing.

To enable hosted deployments from local Creator Studio:

1. In Netlify, connect the site to the same GitHub repository and configure its production branch.
2. Create a Netlify Build Hook for that exact production branch.
3. Provide `VELORI_NETLIFY_BUILD_HOOK_URL` and `VELORI_NETLIFY_DEPLOY_BRANCH` to the local Vite server process through the OS secret manager or another protected environment mechanism, then restart Vite. Do not use a `VITE_` variable, `.env` file, or commit the hook URL; it authorizes deploy requests.
4. Confirm Creator Studio reports the Netlify hook as configured. The source workbench refuses to request a hosted deploy if the pushed GitHub branch does not match the configured deploy branch. If Netlify rejects or cannot receive the request, the GitHub push remains intact and Creator Studio offers a deploy retry.

In the hosted admin experience, source changes create a review pull request rather than writing to the server or bypassing review. Merge the approved pull request into Netlify's production branch to publish it. Netlify's Git integration must be configured for that repository and branch; the local build hook is never exposed to the hosted browser or Edge Function.

## Deploy database and Edge Function

Configure these protected GitHub Actions values for the repository:

- Variables: `SUPABASE_PROJECT_REF`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VELORI_SUPABASE_SECRET_KEY`, `VELORI_ALLOWED_ORIGINS`, and `VELORI_MEDIA_CLEANUP_TOKEN` (generate a random value with at least 32 characters and set the same value in Supabase Function secrets). Do not reuse the exposed legacy service-role key.
- Optional secret: `VELORI_ADMIN_SETUP_CODE` for one-time first administrator setup; remove it after the initial admin rotates the stored code.

Push backend changes to `main` or dispatch **Verify and deploy Supabase backend** from `main`. The workflow validates the Deno function, applies all migrations to a clean local Supabase stack, pushes pending migrations to the project ref, deploys the `server` function, and runs live schema, storage, endpoint, and CORS checks. Never run `supabase db reset --linked` against production.

The same migrations can be applied manually after installing the Supabase CLI, logging in, and setting the database password:

```powershell
$env:SUPABASE_PROJECT_REF = "<new-project-ref>"
supabase link --project-ref $env:SUPABASE_PROJECT_REF
supabase migration list --linked
supabase db push --linked --include-all --yes
node scripts/publish-supabase-secrets.mjs
supabase functions deploy server --project-ref $env:SUPABASE_PROJECT_REF
node scripts/verify-supabase.mjs
```

The hourly **Clean up expired VELORI media** workflow calls the service-token-protected `/_internal/storage-cleanup` Edge route. Keep the same `VELORI_MEDIA_CLEANUP_TOKEN` in GitHub Actions and Supabase Function secrets. It is separate from the Supabase API key, is compared in constant time, and must never be added to frontend configuration. Expired story and permanently expired trash-post rows enqueue paths before deletion; the worker uses the Storage API to remove bytes and retains failed paths for retry.

Set Edge Function secrets through protected Supabase project secret management. Supabase injects `SUPABASE_URL`; VELORI requires `VELORI_SUPABASE_PUBLISHABLE_KEY`, `VELORI_SUPABASE_SECRET_KEY`, `VELORI_MEDIA_CLEANUP_TOKEN`, and `ALLOWED_ORIGINS`. The optional temporary bootstrap secret is `ADMIN_SETUP_CODE`. Never commit their values.

For local secret publication with `node scripts/publish-supabase-secrets.mjs`, keep privileged values in the ignored `.env.secrets.local` file or process environment, never `.env.local`. The script accepts `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `ALLOWED_ORIGINS` as local aliases and publishes the keys using the Edge Function's supported names (`VELORI_SUPABASE_PUBLISHABLE_KEY`, `VELORI_SUPABASE_SECRET_KEY`, and `ALLOWED_ORIGINS`). Supabase injects `SUPABASE_URL` at runtime. The publisher does not send reserved `SUPABASE_*` names. `SUPABASE_JWKS_URL` is not required: the server validates access tokens through Supabase Auth using `auth.getUser()`.

## Auth and email

In Authentication → URL Configuration, set the production Site URL and exact redirect URLs for `/auth/confirm`, `/reset-password`, and `/settings/account`. Configure a verified SMTP sender and install the templates in `supabase/email-templates/`. Verify signup delivery, confirmation, password recovery, and email change with a non-production account.

## Acceptance checks

- Run `pnpm supabase:verify` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VELORI_SUPABASE_SECRET_KEY`, and `VELORI_ALLOWED_ORIGINS` set. The script reports actual live API results.
- Confirm all core REST tables and `site_settings` animation columns are present; `PGRST205` and `42703` must be gone.
- Confirm public-read `site-assets` exists while anonymous writes remain denied.
- Confirm `/functions/v1/server/health` is configured and CORS permits only the configured origins.
- Confirm the live migration ledger includes `20261031003400`–`20261031003700`, the server health response reports `mediaCleanupConfigured: true`, and the cleanup workflow is enabled. In a non-production project, send an all-account and account-type campaign, verify recipient timeline rows and preference filtering, mark a campaign item read and verify its receipt, then withdraw the campaign and verify the timeline entry is removed. Also enqueue one expired story and one permanently expired trash post, run the cleanup workflow, and verify both Storage objects are gone while unrelated media remains.
- Complete real signup/email/session flows and authenticated RLS/admin tests before production sign-off.

The old project's database and hosted resources are not deleted by changing application configuration. Retire that project separately only after confirming that its data is no longer needed and you have a recoverable backup.
