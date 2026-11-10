# VELORI FORGE AI — V33.1.2 Build & Acceptance Matrix

**Snapshot:** 2026-10-27. **Version:** V33.1.2 release candidate 2. **Production deployed:** NO.
**Legend:** PASS = verified check. COMPLETE = code implemented but runtime not yet verified. FAILED = attempted but did not pass. INCOMPLETE = not implemented. BLOCKED = cannot verify in this environment.

| ID | Workstream/check | Result | Evidence/next action |
|---|---|---|---|
| 01 | Source lineage against V33.1 RC1 | PASS | Used the verified V33.1 RC1 full source from V33 Library; no V31 substitutions. |
| 02 | Modern three-column FORGE interface | COMPLETE | React workspace + responsive CSS updated; real browser visual QA pending. |
| 03 | Mobile Chat / Code / Preview navigation | COMPLETE | Responsive segmented view and CSS present; real-device QA pending. |
| 04 | Persistent conversational FORGE chat | COMPLETE | Local transcript, Build/Ask, follow-up questions, real statuses and errors; provider end-to-end testing pending. |
| 05 | Ask mode project-aware Q&A | PASS | API response and bounded source-context tests passing. |
| 06 | Build mode revision approval/undo | COMPLETE | Source integrated; staging generation check pending. |
| 07 | React/Vite/TypeScript starter source | PASS | File tests + package manifest assertions passing. |
| 08 | Python/FastAPI starter source | PASS | Starter files/tests/requirements verified in Node unit suite. |
| 09 | Multi-file editor and full source ZIP | PASS | Source ZIP integrity and paths tested. |
| 10 | Device-first local persistence | COMPLETE | IndexedDB transaction commit verified in code and localStorage fallback unit-tested; cross-browser IDB QA pending. |
| 11 | Save/cancel/leave warning animation | COMPLETE | React Router dialog implemented, standard browser unload confirmation; browser QA pending. |
| 12 | No new cloud source storage | COMPLETE | Cloud source save/share endpoints disabled; local-only generation receipt staged. Live Edge deployment pending. |
| 13 | Legacy cloud data review/opt-in cleanup | COMPLETE | Explicit typed user confirmation; staging API/security tests pending; no automatic deletion. |
| 14 | Contextual dismissible Premium discovery | COMPLETE | Real plan availability used; frequency bounded once/7 days. Browser QA pending. |
| 15 | One-time verified Premium and credit packs | COMPLETE | Original verified Stripe checkout preserved. Live billing not retested. |
| 16 | Monthly Stripe subscription checkout & status | COMPLETE | Recurring price verification, checkout ownership, portal, webhooks in source; staging SQL/Stripe test mode not run. |
| 17 | Subscription effective Premium entitlement | BLOCKED | SQL RPC migration prepared but intentionally NOT applied to live Supabase. |
| 18 | Stripe event tampering/invalid price tests | PASS | Pure-validation tests for price, mode, ownership fields and expired periods. |
| 19 | TypeScript project typecheck | PASS | `tsc --noEmit`: 0 errors with restored dependency type definitions. |
| 20 | Runnable Node regression suite | PASS | 328 tests: 327 passed, 1 skipped, 0 failed. |
| 21 | Complete Node regression suite | FAILED | 330 tests: 327 passed, 1 skipped, **2 native-binding environment failures** in `scripts/env.test.mjs` and `scripts/verify-public-config.test.mjs`. |
| 22 | Vite production build | BLOCKED | Bundle includes Windows-only native packages, Linux lacks `@rolldown/binding-linux-x64-gnu`. Build attempt failed. |
| 23 | CSS parsing | PASS | PostCSS parsed 521 FORGE stylesheet rules without syntax errors. |
| 24 | Copyright/source hash inventory | PASS | Generated inventory and copyright check passed. Ownership still subject to rights review. |
| 25 | Browser/device end-to-end testing | INCOMPLETE | Cannot run app build in current Linux environment; run staging Playwright and physical mobile QA. |
| 26 | Supabase staging migration and RLS QA | BLOCKED | Proposals supplied but **not applied** to production or staging. |
| 27 | Real Stripe test checkout, renewal, cancellation | BLOCKED | Requires test merchant recurring Price IDs and installed webhook; no purchase initiated. |
| 28 | Untrusted React/Python full-stack execution runtime | INCOMPLETE | Source editable and exportable; browser/npm/Python runtime not available. |
| 29 | Public cloud shareable preview links | INCOMPLETE | New cloud code uploads intentionally disabled to honor device-only user preference. Opt-in future service needed. |
| 30 | Actual production deployment | BLOCKED | Live website and Supabase production untouched; must pass release gates first. |

## Commands and recorded verification

- `tsc --noEmit --pretty false`: PASS, 0 errors.
- `NODE_OPTIONS=--experimental-strip-types node --test [63 supported suites]`: PASS, 327/328 passing, 1 skipped.
- `NODE_OPTIONS=--experimental-strip-types npm test`: FAIL in two Vite-binding-dependent files, not code assertions.
- `npm run build`: BLOCKED, `Cannot find module '@rolldown/binding-linux-x64-gnu'`.
- `npm run copyright:inventory && npm run copyright:check`: PASS.
- PostCSS parse of `src/features/artifacts/studio.css`: PASS (521 rules).

**Production decision: DO NOT DEPLOY AS COMPLETE.** Source is a release candidate awaiting staging database, verified Stripe setup, native builds, browser QA, and security review.
