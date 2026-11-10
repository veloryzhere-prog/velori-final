# VELORI V33.1.2 — FORGE Design and Interaction Audit

**Product:** VELORI FORGE AI (VELORYZ parent brand)
**Source baseline:** V33 Library → V33.1 RC1 → V33.1.2 RC2
**Deployment:** NO; existing live V33 remains untouched.

## 1. Work completed in the RC2 source

### New experience
The Studio now presents a designed three-panel creation workspace with a full-height AI conversation, source file explorer, code editor, static preview, mobile switching between panels, responsive typography, a quiet premium discovery link and support for actual AI request/reply/revision activity. Status text is based on real client/server events; it never pretends a terminal or full-stack build ran.

### Two-way FORGE AI interaction
Build mode requests a revision and requires user acceptance before replacing a working local draft. Ask mode genuinely calls Gemini via the Edge Function, returns AI answers and follow-up suggestions, and has a capped context snapshot of pages and the first project files for meaningful debugging. The backend returns only validated JSON replies and enforces quota and provider errors. Changes to current code require Build mode; Ask never falsely claims a change.

### Source, local storage, leaving protection
The editor now supports React/Vite/TypeScript and Python/FastAPI starters as editable/downloadable source trees. Custom paths are validated against traversal and credential file names, with 60-file / 2MB source limits. The browser stores source in IndexedDB with commit-completion signaling; a legacy localStorage fallback supports older drafts. A user leaving by internal navigation sees an animated Save ZIP / Cancel / Leave without backup dialog. Closing a browser tab uses the browser's native (non-customizable) unsaved-work warning. ZIP/JSON backup contains project files; HTML-only preview no longer marks React projects as fully backed up.

The new backend disables cloud source `save`/`share`, returns AI results directly to the browser and uses a SQL accounting-only completion receipt. **The receipt proposal must be installed before the new Edge Function**. Old cloud-generated results and projects still exist until the user explicitly invokes safe, user-scoped legacy cleanup. Source still flows over HTTPS to the configured AI provider during generation/conversation; it is not end-to-end local AI inference.

### Real commerce, not admin marketing
The pricing UI fetches plans and amounts from the real authenticated provider. Existing one-time Premium and credit purchases are not rebranded as subscriptions. A new conditional `PRO_MONTHLY` checkout invokes Stripe subscription-mode Checkout only with a verified recurring monthly Price ID. The webhook re-fetches the canonical subscription to verify account, customer, plan and period; account entitlements derive from unexpired `active`/`trialing` subscriptions **or** separately existing one-time Premium purchases. The customer can open Stripe's hosted billing portal after provider verification. A gentle popup is opt-in/dismissible and will not show repeatedly within seven days. No fake plan is purchasable without a configured Stripe Price and staged entitlement table.

### Existing social media functionality
The RC1 source's author-scoped story navigation, music composition preview correction, downloadable static source ZIP and animation-setting bug fix were preserved. No new claims are made that every reel/story/post music playback/export defect was verified in mobile browsers.

## 2. Source paths changed/added

- `src/features/artifacts/Assistant.tsx` — chat activity, modes, real Ask model, source context, help and real quota states.
- `src/features/artifacts/StudioPage.tsx` — modern dashboard, IndexedDB/device-first projects, legacy cleanup.
- `src/features/artifacts/Workspace.tsx` — multi-file editing, React/Python starters, backup/exit dialog and responsive sections.
- `src/features/artifacts/studio.css` — comprehensive premium styling and mobile views.
- `src/features/artifacts/device-store.ts` / `.test.ts` — device storage and durability/fallback tests.
- `src/features/artifacts/multi-file.ts` / `.test.ts` — framework files/path validation, starter exports and tests.
- `src/features/artifacts/model.ts`, `document.ts` — editable file support and source ZIP output.
- `src/features/artifacts/PremiumOffer.tsx` — conditional real-plan Premium discovery.
- `src/features/artifacts/PublicPages.tsx` — Stripe-connected pricing, recurring plan, subscription status and billing portal.
- `supabase/functions/velori-studio/index.ts` — `converse`, local receipt, run events and recurring checkout/webhooks.
- `supabase/functions/velori-studio/policy.ts`, `payments.ts`, `subscriptions.ts` / `.test.ts` — model prompt, source context, Stripe validation.
- `supabase/proposals/20261027_forge_local_only_receipts.sql` and `20261027_forge_recurring_stripe_subscription.sql` — **staging proposals only, not deployed**.
- `package.json`, `SOURCE_VERSION.json`, generated legal source inventory, release documentation.

## 3. Verified results

- **TypeScript:** PASS; 0 errors using a restored compatible package/type cache.
- **Runnable tests:** PASS; 327 passed, 1 skipped, 0 failed across 63 supported suites.
- **Full test suite:** 327 passed, 1 skipped, 2 failed because Linux lacks Vite/Rolldown native packages in a Windows dependency archive.
- **CSS:** PASS; 521 rules parsed by PostCSS.
- **Copyright inventory:** PASS regenerated, then checked.
- **Full Vite build:** BLOCKED; no Linux Rolldown native binding.
- **Browser QA, payment/webhook QA, SQL staging migration, production deploy:** NOT RUN/INCOMPLETE.

## 4. Required release gates

1. Install dependencies on an appropriate compatible build host using the pinned lockfile; run production Vite build and all suites. Do not ship Windows node_modules to Linux.
2. Compare V33 source-proposal RPCs to current deployed Supabase migrations; run both proposals in staging and test RLS/role grants before rollout.
3. Configure Stripe subscription Price IDs for actual billing currency, test webhook endpoint events, retries, cancellation/expiry, duplicate checkout prevention, one-time + monthly co-entitlements, tax/disclosure and customer portal.
4. Verify device persistence and ZIP restore under Chrome, Android, iOS Safari, including browser refresh, storage quota failures, and the native vs in-app exit dialogs.
5. Test media/music from editor to published mobile feed and Story/Reel playback in real browsers.
6. Conduct security/licensing review for generated source ownership, third-party dependencies, hosted code permissions, origin/CORS, source privacy and consent. Never promise automatic ownership transfer or unremovable attribution in editable code.
7. Deploy and monitor on staging, then production only when all release gates pass. Keep a rollback point.

See `VELORI_FORGE_V33_1_2_BUILD_MATRIX.md` for precise PASS/COMPLETE/FAILED/BLOCKED/INCOMPLETE rows.
