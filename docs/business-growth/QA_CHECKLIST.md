# Business & Growth QA checklist

## Source checks

- [x] `pnpm typecheck`
- [ ] `pnpm test` — 359 passed, 1 failed. The existing hosting-route test fails because `.openai/hosting.json` is absent.
- [x] `pnpm build`
- [x] `deno check --config supabase/functions/server/deno.json supabase/functions/server/index.tsx`
- [x] Focused formatting checks for the new admin screens and `admin-business.ts`. Broader changed-file format checks still flag the existing large app files.

The linked Supabase project is reachable through the Supabase Management API read-only query path; the local Docker database health endpoint returns HTTP 500, and `supabase migration list --linked` cannot authenticate with the locally configured DB password. A read-only query confirmed the Growth migration is applied and all 111 local migration versions match the remote ledger. Selected remote schema/privilege checks and anonymous API denial checks ran; authenticated user/admin workflows and database writes remain unverified.

The checked installation gates below describe implemented source safeguards only; they are not database-runtime or integration-test results.

## Offers after deployment

- [ ] Admin with `offers.view` can list saved offers; unprivileged user cannot call the admin API.
- [ ] Admin with `offers.edit` can create draft, edit, activate, deactivate, and archive.
- [ ] Invalid date windows, future activation, expiration, and exhausted limits are rejected.
- [ ] Rows persist after reload. No usage/conversion metric is claimed until a redemption path exists.

## Referral and reward integration after deployment

- [ ] Referral codes are unique, have adequate entropy, and are persistent for existing and new accounts.
- [ ] Valid, invalid, disabled, expired, inactive-program, self-referral, and already-attributed code cases return the expected safe status.
- [ ] Signup attribution persists once; duplicate invitees cannot create additional attribution.
- [ ] Registration remains pending and issues no reward.
- [x] Referral qualification is gated on `installation_verification_status = 'verified'` and a non-null server-recorded verification timestamp.
- [x] The current migration defaults installation verification to `unsupported`; the qualification RPC returns pending without issuing a reward.
- [x] Admin API activation is blocked until trusted Android installation verification is deployed.
- [ ] Verified-email and successful-generation requirements are enforced by the database after installation verification.
- [ ] Android installation evidence is validated against the actual distribution and signing identity; no Android source or verifier is present in this repository.
- [ ] Program enable/date boundaries, inviter cap, lifetime user cap, and global cap are enforced.
- [ ] Repeated/concurrent qualification produces exactly two transaction rows and exactly one account increment per recipient.
- [ ] Unauthorized browser writes and admin requests are denied.
- [ ] Reward reversal requires admin permission/reason, is idempotent, and updates the same Forge balance.
- [ ] Persistence survives app reload; no real rewards are issued during test setup.
- [ ] Admin event history displays recorded failure events.

## Design and runtime configuration

- [x] Offer and referral administration use isolated amber and mint/teal visual tokens; referral art is decorative and reduced-motion aware.
- [x] User referral experience supports copying the verified code and link; native share includes the real code and attribution URL when available.
- [x] Signed-out referral landing visually inspected at 1440x900, 390x844, and 320x740; no horizontal document overflow at those widths. Device reduced-motion preference disables the invitation reveal.
- [ ] Authenticated referral data states and admin screens were not browser-inspected; they require a working backend and authorized test session.
- [x] Public referral copy explicitly explains that signup, APK download, and generation do not prove installation; rewards are unavailable until a trusted verifier exists.
- [ ] Admin-editable presentation configuration, popup publication/scheduling, and preview are not implemented; do not imply their controls exist.
- [ ] Membership promotions remain deferred until referral database deployment and acceptance are complete.

## Manual deployment status

The migration is applied and the `server` Edge Function is active at version 62; deployed `index.tsx` and `admin-business.ts` match local source. The production referral program remains disabled with zero rewards. The frontend at `https://chat.veloryz.online` has broken deep links (HTTP 404). A source/build SPA fallback exists but requires authorized Netlify publishing and live post-deploy verification.
