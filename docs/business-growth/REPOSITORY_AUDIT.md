# Business & Growth repository audit

## Repository and editable source

- Working source repository: `veloryzhere-prog/velori-final`, branch `main`.
- Baseline commit inspected: `a3efaf4` (`Initial commit`).
- The workspace contains editable React 19/Vite/TypeScript source, `pnpm` manifests, Supabase Edge Functions, and 111 SQL migrations. This is the complete source repository selected by the user; the separate `velori-netlify` repository is not used.
- The working tree was already staged/modified before this continuation. Pre-existing Part 1 Business & Growth docs, navigation, routes, admin API declarations and route imports were preserved and integrated.

## Existing source and backend

- Frontend routes: `src/app/routes.tsx`.
- Admin console: `src/app/admin-console/`; session and UI permission checks are shared.
- Admin API client: `src/lib/admin-api.ts`.
- Supabase Edge Function: `supabase/functions/server/index.tsx`, with `admin-core.ts` for identity, authorization, service-role client, and audit helpers.
- SQL conventions and schema: timestamped additive migrations under `supabase/migrations/`.
- Existing Forge token entitlement: `velori_studio_accounts.tokens` and server-side request lifecycle in `20261024232208_velori_forge_studio.sql`.
- Auth signup creates `public.profiles` through the existing `auth.users` trigger in `20261031000300_velori_profile_provisioning.sql`.

## Part 1 and Part 2 audit

Part 1 had created the Business & Growth navigation/placeholder screen and partial offer API declarations. The route imports for offer handlers existed, but `admin-content.ts` did not export them; no offers migration or table existed. Part 2 therefore was not complete. Existing referral/reward helper code generated rewards in `localStorage`, generated codes in the client, and used a hard-coded default domain; it was not safe for persistent production rewards. No referral schema or server authorization existed.

The current source change adds `admin-business.ts`, `20261107000000_velori_business_growth.sql`, database-backed screens/RPC calls and API contracts. The previous browser-local reward helper and its test were removed. Offers are admin configuration only because no checkout/redemption flow exists.

## Environment and deployment

- `.env.local` identifies Supabase host `gmgobchwnfkwfuekhpkr.supabase.co`; Supabase CLI identifies linked project `gmgobchwnfkwfuekhpkr` as `velori complete`.
- Read-only migration-ledger query found 111 remote versions matching all 111 local files. The Growth migration is applied. Local Docker database health is HTTP 500 and direct `supabase migration list --linked` fails DB password authentication; the Management API query path succeeds.
- Production `server` Edge Function is active at version 62. Downloaded `index.tsx` and `admin-business.ts` match local source by SHA-256. Anonymous admin offers/referral GETs return HTTP 401.
- The production referral program is disabled and both reward values are zero. RLS is enabled on Growth tables and anon/authenticated lack direct referral-table SELECT privileges.
- Public referral links use `window.location.origin`, the configured site origin the user is currently visiting; no unverified production domain is embedded.
- Production frontend is `https://chat.veloryz.online` (present in the configured allowed-origin list and served VELORI content). `/` returns HTTP 200; `/home`, `/forge/rewards`, `/forge/pricing`, and `/admin` return HTTP 404. No Netlify site link or authenticated CLI session is available. A tested source `_redirects` fallback awaits authorized deployment.
