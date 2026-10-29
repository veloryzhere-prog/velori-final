# VELORI production audit register

**Last checked:** 2026-10-29  
**Repository:** `veloryzhere-prog/velori-final`, branch `main`, baseline commit `a3efaf4043447c3dc5104e1f525d953a514793c8`  
**Production frontend:** `https://chat.veloryz.online`  
**Linked Supabase project:** `gmgobchwnfkwfuekhpkr`

This register records verified release defects and unfinished acceptance requirements. `VERIFIED FIXED` is reserved for issues tested against the repaired runtime, not merely edited source.

## Confirmed production baseline

- Production `/` responds HTTP 200 and serves the VELORI entry page.
- Direct production requests to `/home`, `/forge/rewards`, `/forge/pricing`, and `/admin` respond HTTP 404 from Netlify.
- The production site bundle entry is `/assets/index-i8yPX-mV.js`; the current local build has different entry asset names. The local frontend worktree is therefore not the currently served frontend build.
- Netlify CLI check: not authenticated; no `.netlify/state.json` site link exists in this checkout.
- The linked database ledger contains all 111 local migration versions, with zero missing or remote-only versions. `20261107000000_velori_business_growth` is applied.
- Supabase `server` Edge Function is active at version 62. Downloaded deployed `index.tsx` and `admin-business.ts` have SHA-256 hashes matching local files.
- The six Business & Growth tables have RLS enabled. Role privilege checks confirmed anonymous/authenticated roles cannot select referral rows; the service role can.
- Anonymous requests to the production admin offers and referral-program endpoints returned HTTP 401. The invalid referral-code RPC returned `{ "valid": false, "reason": "invalid_code" }`.
- The production referral program is disabled and both inviter/invitee rewards are zero. The production qualification function checks the installation state and unsupported status; the status default is `unsupported` and the verification timestamp constraint exists.
- The Android application source and a trusted installation-evidence validator are absent from this repository. No referral rewards can be safely enabled.
- No production database write or backup operation was performed during this audit.

## Open and blocked issues

### AUD-001 — Production SPA deep links return 404

- **Feature / severity:** Frontend hosting and client-side routes / High.
- **Reproduction:** Open `https://chat.veloryz.online/home`, `/forge/rewards`, `/forge/pricing`, or `/admin` directly.
- **Observed:** HTTP 404 from Netlify; `/` returns HTTP 200.
- **Expected:** Netlify serves the SPA entrypoint for client-owned paths so React Router can resolve them.
- **Root cause evidence:** No Netlify SPA fallback was present in `public/`; direct path responses are 404. The former hosting test referenced absent `.openai/hosting.json`, which is not the deployed Netlify configuration.
- **Change and proof:** Added `public/_redirects` with `/* /index.html 200`; replaced the stale hosting assertion with a test of that real Netlify rule. Focused information tests passed 3/3, and the production build passed.
- **Status:** `BLOCKED BY EXTERNAL DEPENDENCY` — source fix is ready, but production still returns 404 until published.
- **Owner / next action:** Agent; an authorized operator must link/authenticate the production Netlify site or provide the approved deployment workflow, publish this source, then repeat the four direct-route checks.

### AUD-002 — No trusted Android install verification

- **Feature / severity:** Referral eligibility and rewards / High (reward-fraud risk if the gate is bypassed).
- **Reproduction:** Inspect the repository for Android source, package/signing metadata, install-referrer/attestation code, and a server evidence validator; none is present. A newly attributed referral remains `unsupported`.
- **Observed:** Signup, download, and Forge generation cannot prove APK installation. No trustworthy evidence can currently be collected or validated.
- **Expected:** Server-validated install evidence precedes qualification, reward transactions, and qualification notifications.
- **Root cause evidence:** No Android project or install-verification integration exists; remote qualification requires `installation_verification_status = 'verified'`, the installed default is `unsupported`, and a consistent verified timestamp is required.
- **Change and proof:** The database qualification gate and deployed server admin guard are present; the production program is disabled with both rewards zero. Enabling through the admin API is rejected until verification exists.
- **Status:** `BLOCKED BY EXTERNAL DEPENDENCY`.
- **Owner / next action:** Agent; obtain the actual Android source, package/signing identity, release/distribution details, and a trusted evidence-provider design. Implement server verification and test on the real distribution channel before relaxing the guard.

### AUD-003 — Three-popup Growth Experience is incomplete

- **Feature / severity:** Offers, Membership, and Referral popup orchestration / Medium.
- **Reproduction:** Inspect the Growth routes and runtime components; there is no shared scheduler, three independent popup components, five-second post-close cooldown, persistent frequency controller, or published popup configuration.
- **Observed:** Only the existing Forge rewards surface and admin offer/referral management screens exist.
- **Expected:** Independent Offer, Membership, and Referral popup compositions coordinated by one eligibility-aware scheduler with a minimum 5,000ms gap.
- **Root cause evidence:** No scheduler/configuration implementation exists in source; the Business & Growth implementation status documents this boundary.
- **Required repair / test:** Implement scheduler and separate popup families, persist validated configuration, and add deterministic tests for priorities, dismissal, frequency, route changes, critical workflows, tabs, and cooldown.
- **Status:** `OPEN`.
- **Owner / next action:** Agent; implement after the safe hosting release and install-verification prerequisite are resolved.

### AUD-004 — Offers have no consumer redemption path

- **Feature / severity:** Offers & Promotions / Medium.
- **Reproduction:** Create or activate an offer in admin; no user checkout/apply endpoint consumes it.
- **Observed:** Offers are stored admin configuration only; there is no redemption or eligibility transaction for users.
- **Expected:** Server validates eligibility, schedule, usage caps, and idempotency before applying an offer; UI reports real outcomes only.
- **Root cause evidence:** The existing API contract and source contain management handlers but no consumer redemption route.
- **Required repair / test:** Define the supported offer benefit and integration destination; implement atomic server redemption and duplicate/cap/expired tests before presenting an apply action.
- **Status:** `OPEN`.
- **Owner / next action:** Agent; connect to a real checkout/benefit contract without inventing success or redemption metrics.

### AUD-005 — Membership Studio popup is not connected

- **Feature / severity:** Membership and subscriptions / Medium.
- **Reproduction:** Open the Growth surfaces; no Membership Studio popup is available.
- **Observed:** A separate subscription backend exists, but no popup loads its plans/status or launches its checkout flow.
- **Expected:** Popup displays current backend plan/price/eligibility and opens the actual subscription workflow; entitlements remain webhook/server-controlled.
- **Root cause evidence:** Existing subscriptions code is under `supabase/functions/velori-studio`; Business & Growth architecture documents no Membership Studio integration.
- **Required repair / test:** Connect a separate violet/pearl popup to real plan and checkout APIs and test active/free/past-due/pending/failure states with provider test mode.
- **Status:** `OPEN`.
- **Owner / next action:** Agent; integrate only with the existing verified subscription contract.

### AUD-006 — Qualified referral notifications are not implemented

- **Feature / severity:** Referral lifecycle / Medium.
- **Reproduction:** Inspect referral qualification RPC and notification handlers; qualification logs referral events and rewards but does not create an inviter notification.
- **Observed:** No notification is sent or recorded when a referral qualifies.
- **Expected:** Idempotent persistent in-app notification only after verified installation, qualification, and actual reward status are confirmed.
- **Root cause evidence:** The growth migration contains referral events and reward transactions but no referral notification insertion/trigger; the existing notifications table is separate.
- **Required repair / test:** Add an atomic idempotent notification contract and test recipient, duplicate processing, reward status, read state, and retry behavior after install verification is available.
- **Status:** `OPEN`.
- **Owner / next action:** Agent; implement after the Android verification gate is available.

### AUD-007 — Authenticated production acceptance is unavailable

- **Feature / severity:** Admin and user end-to-end workflows / Release gate.
- **Reproduction:** Current browser page is signed out; no authorized test-account session was used.
- **Observed:** Live anonymous-denial and invalid-code checks pass, but authenticated offer CRUD, referral attribution persistence, admin reversal, and concurrent qualification have not been tested end to end.
- **Expected:** Authorized test accounts prove persistence, permission separation, and reward idempotency without issuing real rewards.
- **Root cause evidence:** No authorized test session/test-account credentials were provided or accessed; direct DB password authentication also fails, while read-only Management API queries work.
- **Required repair / test:** Use isolated test accounts/test project and run authenticated admin/user acceptance, then verify records and balances without real reward issuance.
- **Status:** `BLOCKED BY EXTERNAL DEPENDENCY`.
- **Owner / next action:** Agent; obtain authorized non-production test accounts/project and a valid database-password workflow.

### AUD-008 — Full regression suite status

- **Feature / severity:** Test/release gate / Medium.
- **Reproduction:** Run `pnpm test`.
- **Observed:** Full `pnpm test` rerun passed: 360 passed, 0 failed. Playwright discovery now succeeds for all 62 tests in 12 files after removing user-specific absolute credential paths and making credential-dependent specs skip at test time when their required isolated QA credentials are absent. The credential-gated E2E batch collected and safely skipped 41 tests because no QA accounts are configured. Two safe, read-only browser checks against local Vite passed. The light-theme browser check exposed and then verified the fix for an inline startup default that incorrectly followed the operating-system dark preference.
- **Expected:** Full suite passes without removing legitimate tests or fabricating host configuration.
- **Root cause evidence:** The old test asserted a non-Netlify config path absent from this repository and unrelated to the actual Netlify deployment mechanism.
- **Required repair / test:** Publish the SPA fallback through an authorized Netlify deployment and verify live deep links. Run authenticated acceptance only against isolated QA accounts/project; those credentials are not configured here.
- **Status:** `LOCAL CHECKS VERIFIED — RELEASE GATES OPEN`.
- **Owner / next action:** Project owner; provide authorized Netlify access and isolated QA credentials/project, then complete live route and authenticated acceptance.

## Release status

**NOT COMPLETE.** The backend migration and Edge Function are verified on the linked project, but the live frontend has broken deep links and the source fix cannot be published without Netlify access. Android installation verification and authenticated end-to-end acceptance remain blocked; multiple requested Growth features are still open. No frontend release commit or deployment identifier is claimed.
