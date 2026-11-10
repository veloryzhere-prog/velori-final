# VELORI Main Site UX Audit

**Date:** 2026-10-04  
**Scope:** Signed-out entry page, authenticated feed surface, Explore page, shared navigation behavior, and responsive public entry.

## Findings before changes

| ID    | Severity | Area                | Finding                                                                                                                                                    |
| ----- | -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-01 | HIGH     | Signed-out homepage | The decorative feed mockup showed invented names, engagement counts, and a fabricated “87% happy” metric. It could be mistaken for real platform activity. |
| UX-02 | MEDIUM   | Feed                | “Latest” looked like a tab but was a static label. The feed also had a promotional headline and “Refresh” control that distracted from actual posts.       |
| UX-03 | MEDIUM   | Explore             | A marketing banner, repeated discovery tiles, and a tutorial rail added multiple layers around the same three destinations.                                |
| UX-04 | MEDIUM   | Test environment    | The configured live site is in Maintenance mode, masking signed-out routes during visual verification.                                                     |
| UX-05 | LOW      | Admin source check  | TypeScript identified a disabled maintenance media field with no required `onChange` handler while verifying the main site changes.                        |

## Changes made

- Replaced the sample activity cards with a lightweight abstract VELORI graphic and removed unsupported social proof and metrics.
- Simplified homepage copy and reduced the benefits row to two clear actions.
- Replaced the static feed tab and marketing heading with “Your feed,” a short explanation, and a labeled refresh action. Empty feed messaging is concise and factual.
- Reduced Explore to one search entry and direct People, Posts, and Hashtags links. Existing route destinations and search behavior remain in use.
- Added focused responsive styling for the simplified landing art and Explore search row.
- Kept existing authenticated routes, account gates, live data requests, and platform maintenance behavior intact.
- Fixed the missing handler on the disabled admin maintenance media field found by TypeScript.

## Verification

- `pnpm format:check` equivalent via installed oxfmt — PASS.
- `tsc --noEmit` — PASS.
- Unit tests — 48 passed.
- Production build — PASS; Vite still warns that the main JavaScript chunk is above 500 kB.
- `e2e/smoke.spec.ts` — 7 passed.
- The public smoke tests inject compiled default site settings in the browser context to bypass the live maintenance banner for those assertions. They do not update the actual database setting.
- At 375×812, the signed-out entry page fits without horizontal overflow.

## Remaining audit scope

This pass focused on interface clarity and public entry/feed/Explore flows. It did not audit every authenticated screen, run accessibility tooling or regression tests for social writes, measure performance, or change the live maintenance setting. The main site UI changes are implemented; the whole platform is not certified production-ready by this UX pass.
