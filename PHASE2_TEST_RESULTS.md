# FORGE AI Phase 2 Test Results

## Automated checks

| Check | Result | Notes |
|---|---|---|
| `pnpm run typecheck` | PASS | TypeScript check completed |
| Focused FORGE/commercial/regression tests | PASS — 36/36 | Includes billing response parsing and display tests |
| `pnpm build` | PASS | Production build completed |
| `pnpm test` | FAIL — unrelated existing test | `src/features/information/information.test.mjs` expects reduced-motion selector behavior absent from `src/features/artifacts/forge-landing.css`. Neither file was changed for this task. |

The full suite is not reported as passing. The isolated reduced-motion failure remains open; earlier repository test history had that test passing, but that does not change the current failure.

## Browser checks

- Local Vite preview opened `/forge/pricing` and the guest state of `/forge/account/subscription`.
- Pricing FAQ expansion succeeded in the local preview.
- Responsive viewport checks were made at 320, 360, 390, 430, and 768 CSS pixels; no horizontal overflow was observed in those checks.
- Pricing and guest billing screenshots are in [PHASE2_SCREENSHOTS/](./PHASE2_SCREENSHOTS/). They are local visual captures with an unavailable backend; price states remain loading/unavailable rather than fabricated.
- A loopback-only dummy backend produced expected connection-refused requests. A pre-existing shared preview on port 5174 also showed a Supabase CORS preflight failure.

## Blocked acceptance cases

Authenticated billing, checkout, Stripe webhook lifecycle, subscription portal, real offers, account-specific balances, usage exhaustion, exhausted-state recovery, and user-specific billing history require authorized staging configuration and an authenticated test account. These were not simulated.

See [PHASE2_TEST_MATRIX.csv](./PHASE2_TEST_MATRIX.csv) for per-case status.
