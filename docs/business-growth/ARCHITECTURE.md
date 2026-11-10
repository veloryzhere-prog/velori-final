# Business & Growth architecture

## Integration boundary

The module extends the current admin shell and Supabase `server` Edge Function. It reuses:

- `src/app/admin-console/frame.tsx`, `navigation.tsx`, and `session.tsx`
- `src/lib/admin-api.ts`
- `supabase/functions/server/admin-core.ts`
- the existing `admin_audit_logs` system

The admin browser receives no service-role credential. Offers and referral tables are server-only under RLS. Admin actions use the existing session and server permission middleware; `offers.*` and `referrals.*` permissions are added by the versioned migration.

## Implemented source routes

- `/admin/business-growth/offers`: create, edit, activate, deactivate, archive, and list database-backed offers.
- `/admin/business-growth/referrals` and `/admin/business-growth/rewards`: one Referrals & Rewards console for program rules, referral history, reward transactions, reversals, and processing events.
- `/forge/rewards`: authenticated user code/link, copy/native share, persistent referral history, database-derived status and reward ledger.
- Signup URLs use the currently loaded browser origin and `?ref=...`; signup pre-validates a code, and the auth trigger independently validates attribution. Invalid-code preflight does not block account creation.

Pricing, subscriptions, analytics, usage, app-install rewards, and entitlements beyond existing Forge tokens remain reserved.

## Referral lifecycle and reward contract

1. The auth trigger creates one unique high-entropy referral code for non-admin accounts (and the migration backfills existing users).
2. A supplied valid code creates a unique pending attribution. Invalid/disabled/expired codes and inactive program windows have explicit validation reasons. Registration does not issue rewards; link clicks are not tracked.
3. Qualification is server-controlled. It requires verified Android installation evidence, an active/in-window program, configured verified email, and a configured count of completed Forge `generate` requests. Signup and generation events cannot qualify a referral by themselves.
4. A single database transaction updates referral status, writes an idempotent inviter and invitee transaction, and increments the existing `velori_studio_accounts.tokens`. Program row locking and unique constraints serialize concurrent checks and cap enforcement.
5. Admin reversals require the separate `referrals.reverse` permission, a reason, and a service-only RPC. The reward record and Forge balance are changed together; the reversal is audited.
6. Processing exceptions roll back the reward transaction, leave attribution pending, and write a deduplicated event for admin review.

The only currently integrated reward type is Forge tokens because that is the existing server-enforced spendable entitlement. No subscription, payment, install, or unrelated balance is synthesized.

## Offers boundary

Offers are persisted admin configuration with server validation, status transitions, RLS, and admin audit records. The project does not currently have an offer checkout/redemption endpoint. Therefore the interface does not claim applied offers, redemption counts, or conversion metrics; no promotion can be redeemed until a separate verified consumer integration exists.

## Presentation direction and configuration boundary

The existing offer admin surface uses an isolated warm amber/cream treatment; the user referral and admin referral surfaces use an isolated mint/teal invitation treatment. The referral artwork is decorative CSS; it does not represent a referral state or reward. Copy-code, copy-link, and native sharing operate on the real server-generated code and current app origin.

These are source-defined presentation defaults, not admin-editable themes. The existing announcement modal queue now enforces a five-second minimum between modal closures, uses a best-effort localStorage/BroadcastChannel lock to avoid simultaneous dialogs across tabs, and does not open promotional dialogs on login, signup, email-verification, subscription-account, or admin routes. This is general announcement behavior, not the three growth popup experiences in the product specification.

Published structured theme/message configuration, independent Offer/Membership/Referral popup components, campaign-aware user-facing offer redemption, referral qualification notifications, and Android installation evidence are not implemented. The existing membership pricing page has a server-backed plan list and verified checkout route, but no membership popup. The migration defaults each referral's installation verification state to `unsupported`; the qualification RPC refuses to issue a reward unless trusted server-validated evidence is recorded, and the admin API rejects enabling the program. No Android source or trustworthy installation signal is present in this repository. Do not present these as configured capabilities. Any future configurable content must use validated structured data and preserve server-side authorization, qualification, and entitlement boundaries.

## Deployment status

Read-only checks on 2026-10-29 confirmed that the migration is applied to linked project `gmgobchwnfkwfuekhpkr`, all 111 local migration versions match the remote migration ledger, and the active `server` Edge Function is version 62. Downloaded deployed `index.tsx` and `admin-business.ts` exactly match this worktree. The deployed database has RLS enabled on the six Growth tables; role checks showed `anon` and `authenticated` cannot select referral rows, while `service_role` can. The public code-validation RPC is executable anonymously, and the admin API rejects anonymous requests with HTTP 401.

The referral program singleton is currently disabled with both rewards set to zero. The production qualification function contains the installation-verification gate, defaults new attribution to `unsupported`, and requires a server-recorded verified status/timestamp before qualification. The production frontend is hosted at `https://chat.veloryz.online`; `/` returned HTTP 200, but direct visits to `/home`, `/forge/rewards`, `/forge/pricing`, and `/admin` returned Netlify HTTP 404. A `public/_redirects` SPA fallback has been added and tested in source/build, but has not been published because no authenticated Netlify CLI session or linked site is available. Authenticated production user/admin and referral end-to-end workflows remain unverified.
