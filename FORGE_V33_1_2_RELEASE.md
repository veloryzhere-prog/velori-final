<!-- Copyright © 2026 VELORYZ. All rights reserved. -->
# VELORI FORGE AI — V33.1.2 UI, Interactions, Device-first Source and Billing Candidate

**Status:** Release candidate. Do not deploy without staging and migration verification.
**Source lineage:** Original V33 Library archive → V33.1 RC1 → this RC2.

## Delivered in this source

- Redesigned, responsive chat-first FORGE workspace, source tabs, file manager and static preview.
- Genuine Build and Ask conversation modes; returned follow-up questions, real API-backed status/errors and revision approval inside chat. Status messages describe only actual provider/client events, never imaginary build commands.
- React/Vite/TypeScript and Python/FastAPI project starters, plus a validated editable multi-file source tree. The full editable worktree is included in Source ZIP exports.
- Device-first persistence via IndexedDB, with legacy localStorage fallback and migration. No new project/source cloud-save endpoint is available. Processing a prompt **still transmits it and the current source to the configured Gemini provider**.
- Back/route-change backup dialog with Save ZIP, Cancel, and Leave without backup; standard browser native confirmation for tab close or reload. Site code cannot customize native close dialogs.
- Optional user-confirmed deletion of historical encrypted cloud copies. **No automatic deletion**, and legacy data may remain in existing production deployments until explicitly handled.
- Connected verified payment data for Premium and credit packs. Dismissible plan offer (at most once every seven days) only when a verified plan is available.
- A separate, opt-in recurring monthly Stripe Checkout path with canonical subscription webhook verification, a customer billing portal, and time-bounded quota entitlements in a staged SQL proposal. Existing one-time Premium rights remain independent of monthly subscription status.
- Better post-music multi-slide preview, author-scoped mobile story progression and real static source ZIP exports were already present in the V33.1 RC1 source baseline and remain preserved here.

## Release order — required

1. Make a separate staging database and deploy preview. Keep current production V33 untouched.
2. Review all migrations against the actual deployed schema and functions. Do **not** assume the source-copy SQL matches production RPCs.
3. Apply staged `supabase/proposals/20261027_forge_local_only_receipts.sql` and source run-event migration **before** deploying the new Forge Edge Function.
4. For recurring billing, apply `supabase/proposals/20261027_forge_recurring_stripe_subscription.sql`, then configure a real Stripe monthly recurring Price ID as `VELORI_STRIPE_PRO_MONTHLY_INR_PRICE` or `VELORI_STRIPE_PRO_MONTHLY_USD_PRICE`. The merchant must configure a valid webhook that subscribes to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Verify Stripe account mode (test vs live) and never use synthetic purchase confirmation.
5. Deploy updated `velori-studio` Edge Function **after** the required database proposals pass review and staging checks.
6. Confirm quotas for FREE, one-time PREMIUM, recurring monthly active/expired, and account with both one-time and monthly. Verify duplicate Stripe events, out-of-order webhooks, cancellations, nonpayment and refunds.
7. Install correct platform dependencies with `pnpm install --frozen-lockfile`, then run `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm e2e`, staging SQL checks, and browser/device tests.
8. Test browser local save/restore, ZIP restore, user logout, storage eviction, subscription portals, viewport gestures, source backup on route leave and native tab-close protection.
9. Deploy frontend and Edge Function with a rollback target only after all release gates pass.

## Important limits — not represented as completed

- No browser-side React/TypeScript compilation, Python server execution, terminal, npm sandbox, isolated full-stack build worker, or hostable backend. React source can be edited and downloaded for offline building.
- Device-only projects have **no cloud recovery**, and local site-data clearing can permanently remove them. Source ZIP is the recommended portable backup.
- Cloud source sharing and account source syncing are disabled in the privacy-first mode. Local ZIP transfer is supported; a future shareable link would require informed opt-in to separately store a copy.
- Monthly subscription checkout remains disabled if Stripe recurring prices or the staged subscription schema are unavailable. Webhooks and portal must be tested in Stripe test mode before launch.
- Existing one-time Premium benefits continue independent of recurring billing.
- The current release includes prepared code, not a validated live deployment or certified copyright transfer. Read `COPYRIGHT.md` and all third-party notices; subscription access and source ownership are separate questions.

## Evidence

- TypeScript typecheck with restored compatible pure-JS dependencies: PASS (0 errors).
- Runnable Node suites excluding two native Vite-binding-dependent files: 326 passed / 1 skipped / 0 failed.
- Full test run: 2 environment failures loading Vite/Rolldown's native Linux binding from Windows-only dependency archive.
- Vite production build: BLOCKED by missing `@rolldown/binding-linux-x64-gnu`; no output uploaded as production-certified build.
- Studio CSS parsed with PostCSS (521 rules); no syntax errors.
- Browser end-to-end, device visual UX, Supabase staging migration, Stripe test checkout/webhook and live deployment: NOT VERIFIED.
