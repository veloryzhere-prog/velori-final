# Business & Growth implementation status

## Source implemented; production verification pending

### Offers & Promotions

- Admin list/create/edit/activate/deactivate/archive routes and responsive screen use the existing server session and `offers.view` / `offers.edit` permissions.
- Server-side field, date-window, activation, usage-limit, and archive-transition validation is implemented.
- `velori_offers` is service-role-only under RLS; mutations write admin audit entries.
- No redemption/checkout endpoint exists. Usage counts are not presented as measured redemptions.

### Referrals & Rewards

- Migration generates/backfills unique referral codes, stores one referral attribution per invitee, and logs lifecycle/reward events.
- Signup code preflight and server trigger validation are wired. Invalid link validation does not prevent normal account creation.
- Qualification requires trusted server-validated Android installation evidence, enabled/in-window rules, verified email when configured, and the configured number of successful FORGE generations. The migration defaults installation verification to `unsupported`; no verifier is present, so the qualification RPC keeps referrals pending and never grants rewards.
- Atomic, idempotent Forge-token grants and admin reversals update `velori_studio_accounts.tokens`; RLS and service-only table/function access protect writes.
- User and admin screens read persistent RPC/API data, support copy-code, copy-link, and native share, show explicit states, and allow authorized reversal with reason.
- The current user referral view and admin screens use separate mint/teal referral and amber offer styling. The art is original CSS decoration; server data remains authoritative.
- Referral click tracking, install rewards, payment/subscription integration, and non-Forge reward types are not implemented.
- The admin API rejects program activation until a trusted Android installation-verification integration exists; the admin screen explains this limitation.

### Design configuration boundaries

- The Offer and Referral visual directions are applied to existing surfaces only. There is no user-facing offer popup or redemption destination yet, so the admin interface does not imply that an offer is available to apply.
- Theme values, artwork, popup scheduling, audience targeting, priorities, and copy templates are not yet editable in admin or published as runtime configuration. The admin can currently edit only the offer/program fields defined by the database and API contracts below.
- The dedicated Membership Studio popup, growth-campaign scheduler, admin theme/message editors, campaign publication/rollback, verified Android installation flow, and referral-triggered notification workflow are not implemented. The generic announcements modal queue has a five-second gap and cross-tab guard, but it does not orchestrate three growth campaigns. The repository does have a separate existing subscription backend; it is not connected to a Membership Studio popup.
- Security-critical validation, admin permissions, qualification, and Forge token issuance remain server-controlled; theme/content configuration must not be used to change those rules.

## Migration and deployment

- Source migration: `supabase/migrations/20261107000000_velori_business_growth.sql`.
- **Applied status: applied** to linked Supabase project `gmgobchwnfkwfuekhpkr`, confirmed read-only in `supabase_migrations.schema_migrations` on 2026-10-29. All 111 local migration versions matched the remote ledger.
- Updated Edge Function: `supabase/functions/server/index.tsx` plus `admin-business.ts`.
- **Deployment status: active**, `server` version 62. Downloaded deployed `index.tsx` and `admin-business.ts` SHA-256 hashes exactly match this worktree.
- Read-only production checks confirmed Growth tables exist with RLS enabled, browser roles have no direct referral table SELECT privilege, and the referral program is disabled with zero inviter/invitee token rewards. Anonymous requests to admin referrals/offers endpoints returned 401.
- The repo contains no Android/APK project or source and no trusted install-referrer/attestation verification service. Do not enable the referral program or issue rewards until this integration exists and is tested.
- No production database writes or backup operations were performed during this audit.

## Verification

- `pnpm typecheck` — passed after the installation gate and messaging changes.
- `pnpm build` — passed; public Supabase configuration validation and Vite production build completed.
- `deno check --config supabase/functions/server/deno.json supabase/functions/server/index.tsx` — passed.
- `pnpm test` — 359 passed, 1 failed. The existing hosting-route test fails because `.openai/hosting.json` is absent; the unrelated fixture was not fabricated.
- Focused formatting checks passed for the changed referral admin screen and server handler. Broader changed application files still have existing formatting drift.
- `git diff --check` — passed.
- Signed-out `/forge/rewards` was browser-inspected at 1440x900, 390x844, and 320x740; no horizontal document overflow was measured. The updated copy explains the install-verification blocker. The authenticated rewards data state and admin screens were not visually verified.
- `supabase status` — linked project identified; the local Docker database health endpoint returns HTTP 500. Remote reads through `supabase db query --linked` succeeded.
- Remote ledger comparison — 111 local versions, 111 remote versions, zero missing or remote-only versions; Growth migration present.
- Production database inspection — install gate, `'unsupported'` default, and timestamp consistency constraint are present; all six Growth tables have RLS enabled; anon/authenticated referral SELECT privileges are false; current program is disabled and reward amounts are zero.
- Production API checks — invalid referral code RPC returned HTTP 200 with `{valid:false, reason:"invalid_code"}`; anonymous admin offers and referral-program GETs returned HTTP 401.
- Production Edge checks — function `server` is active at version 62; downloaded deployed `index.tsx` and `admin-business.ts` match local SHA-256.
- Live website `https://chat.veloryz.online` — `/` returned HTTP 200, but direct visits to `/home`, `/forge/rewards`, `/forge/pricing`, and `/admin` returned HTTP 404. Added a Netlify SPA fallback and replaced the stale hosting test. Focused information tests pass 3/3; production remains unpatched until deployment.
- Authenticated user/admin flows, persistence writes, concurrent qualification, and reversal acceptance remain unverified.

## Required manual deployment

1. Configure/link an authenticated Netlify CLI/site or authorized CI deploy path for the production branch `main`, verify the linked site maps to `https://chat.veloryz.online`, and publish the source change containing `public/_redirects`.
2. Verify the deployment identifier and commit, then repeat direct-route checks for `/home`, `/forge/rewards`, `/forge/pricing`, and `/admin`.
3. Implement and deploy trusted installation verification for the actual Android distribution channel before testing qualification. Then use test accounts for code validation, pending attribution, install evidence validation, qualification after all configured requirements, caps, repeat/concurrent processing, reversal, and denial for users without admin permissions.
4. Keep the referral program disabled. The deployed server blocks activation; do not remove that guard until installation evidence is validated server-side and the complete flow has passed.

## APK-only promotion boundary (2026-10-29)

- Added a shared eligibility gate that returns false until trusted native verification is available. Website/PWA visitors are not sent referral attribution from `?ref=`, cannot load the referral dashboard data, and no longer see FORGE rewards navigation or referral/install reward claims. Ordinary website signup remains available.
- This is a fail-closed exclusion, not Android verification. The repository still has no Android app source, package/signing identity, trusted install-attestation service, or verified APK release workflow. The gate must not be changed to infer APK status from a browser URL, user agent, or JavaScript setting.
- The server-side referral program remains disabled and rejects activation without trusted installation evidence. No database migration or deployment was made for this work.
- The dedicated APK Promotion Studio below uses the existing announcements table and audit/version history. General announcements and website PWA-update prompts remain separate.

## APK Promotion Studio admin draft controls (2026-10-29)

- Added `/admin/business-growth/app-rewards` as a dedicated Promotion Studio entry under Business & Growth. Administrators with `notifications.view` can read saved drafts; `notifications.edit` plus the existing recent-reauth flow is required to create, edit, or archive them.
- Campaign drafts persist through the existing `system_announcements` API/table. The admin can configure popup/banner presentation, copy, custom HTML/CSS, media, CTA, display frequency, delay, route, and schedule using the existing editor. The internal label is tagged `APK_ONLY:<kind>:`. Existing version snapshots and audit writes apply; no new schema or migration was needed.
- Server-side mutation policy prevents adding/removing/changing the APK marker through edits and rejects activation. The publish endpoint independently rejects tagged campaigns before calling the existing publish RPC. Restoring a prior version preserves the marker. The public website announcement runtime also filters tagged records, including records that are accidentally marked active.
- There is no publish, enable, or release action in this Studio. These are persistent creative drafts only; they are not delivered to an APK, and cannot be made live until Android source and trusted server-verifiable installation identity exist. This is not a replacement for the referral activation gate or a claim that APK installation has been verified.
- No migration was created or applied and no deployment was performed. Deploy the changed frontend and Edge Function to make these source controls available; keep campaigns unpublished. Trusted Android installation verification and an APK release/distribution workflow remain prerequisites for activation and delivery.
- Added unit coverage for marker parsing, immutability, and activation denial. Browser-authenticated admin CRUD, backend integration, and production deployment are not verified in this source-only continuation.
- Verification: `pnpm run test:apk-promotions` passed (8/8); `pnpm test` passed (363/363); `pnpm typecheck`, `deno check --config supabase/functions/server/deno.json supabase/functions/server/index.tsx`, `pnpm run build`, focused Oxfmt checks, and `git diff --check` passed. `pnpm exec playwright test e2e/apk-promotion-exclusion.spec.ts` passed (1/1). A local Vite route probe returned HTTP 200, but the integrated browser displayed Reconnect and no authenticated admin session was available; the admin workflow was not visually or transactionally verified.

## Announcement scheduler hardening (2026-10-29)

- Added a minimum 5,000ms delay after an announcement modal closes before the next modal may open. The next campaign must still be eligible and is selected using the existing server data, priority ordering, frequency, schedule, and route rules.
- Added a best-effort per-origin localStorage/BroadcastChannel lock to avoid overlapping modal dialogs across tabs. This is presentation coordination only, not a reward/security boundary; browser storage failure falls back to existing single-tab behavior.
- Promotional modal dialogs are suppressed on admin, login, signup, email-verification, pricing/checkout, and subscription-account routes. Existing banner behavior remains unchanged.
- Added deterministic unit tests for the five-second interval, other-tab lock expiry, malformed lock handling, and protected routes.
- This hardens the existing announcement queue; it does not implement the three independent growth popup components, campaign-aware user-facing offer actions, published theme/message admin, or Android referral verification.
- Verification: `pnpm run test:apk-promotions` passed (13/13); `pnpm test` passed (368/368); `pnpm typecheck` and the Edge Function check passed. `pnpm exec vite build` passed compilation (2,796 modules); the standard `pnpm run build` preflight could not run because `VITE_SUPABASE_URL` is not present in the current environment or public `.env.local`. The APK-exclusion Playwright test passed (1/1). No live admin, installation, or release workflow was tested.

Verification for the earlier exclusion continuation: `pnpm run test:apk-promotions` passed (1/1), `pnpm test` passed (363/363), `pnpm run build` passed, `pnpm typecheck` passed, focused Oxfmt checks passed, and `git diff --check` passed. The Playwright exclusion test passed (1/1) at 320px, 390px, and 1440px, confirming the unavailable state and no referral RPC requests. The integrated browser connection timed out, so Playwright supplied the browser verification.
