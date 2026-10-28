# VELORI V33 — protected API configuration

V33 prioritizes the existing administrator configuration workflow. It is not a claim that the full V32 reconstruction or every provider integration is complete.

## Implemented

- `/admin/environment` now identifies V33, provides an actual protected management bootstrap form when the server reports setup is missing, and preserves exact-name/password confirmation.
- Bootstrap validates a supplied Supabase management token against this project's Edge secret read API, records a redacted audit request, installs only `VELORI_ENVIRONMENT_MANAGEMENT_TOKEN` through the official Management API, and reports runtime refresh/final audit uncertainty accurately. Existing management credentials cannot be overwritten through bootstrap.
- Existing deployed credential test/activate/rollback routes are preserved and connected to the page for Gemini, Stripe API and Stripe webhook secrets. Candidate activation retains its existing verification, same-merchant/mode protection and previous-key behavior. A webhook format check is explicitly distinguished from real delivery verification.
- Other supported runtime values retain set/replace/remove operations. Multiline GitHub private keys have a textarea. Root Supabase/encryption credentials remain protected. Errors from the redacted backend remain visible instead of being replaced by a generic success/failure claim.
- Recovered the actual deployed management/configuration/rotation modules into the source checkout. No schema, permissions, storage policy or dependency was changed for V33.
- Existing V32 candidate work is retained. Additional profile text-mention Tagged results use real RLS-protected posts. Music Saved/Recent are account-separated device preferences containing catalog IDs only; collections resolve actual catalog metadata and are explicitly not presented as cloud-synced preferences or invented popularity.

## Verification before publication

- Full verify: 317 cases, 316 passed, one existing platform skip, zero failures; formatting, frontend TypeScript, copyright inventory consistency and production dependency audit passed. Production build completed in 1.21 seconds with existing >500kB chunk warnings.
- Five bootstrap regression cases cover exact confirmation/bounds, project-bound API requests, audit-before-write, permission failures, redaction and pending final audit. Four device music preference tests passed.
- Isolated backend deployment: `velori-environment` version 5 ACTIVE, preserving handler-level administrator authentication and `verify_jwt:false` from the existing function. Source entrypoint and import map bundled successfully.
- Actual anonymous GET of the deployed environment endpoint returned HTTP 401 with `Sign in to continue.` No secret write was attempted with an invented or extracted credential.
- Published the V33 frontend to the original public Site; native deployment `appgdep_6adf536434f08191857fafaa14a8dc26` succeeded at 13:19:55 UTC. The published super-admin page rendered VELORI V33 / SYSTEM, Connect protected API management, token/name inputs, real settings search and protected disabled states. Desktop width and scrollWidth were both 1348px. Browser evidence: `live-admin.jpg`. No valid-token save is claimed.
- A concurrent backend deployment (version 4) restored the old handler while adding the published Site to default allowed origins. Compared its source against version 2: all management modules were identical, and the core change replaced one localhost origin with the published Site origin. Merged that exact origin change with V33 setup and redeployed as version 5; refreshed published status then exposed the actual setup form. No concurrent functional change was discarded.
- The real Tagged query resolved to existing public post `8b8c97e3-aa10-479d-b62b-b0458a5d287a` mentioning @aryan, through the actual RLS-protected client query.

## Required owner configuration / remaining acceptance

The Supabase connector is connected but has no operation to issue or set Edge secret credentials. A project owner must enter a real management token in the protected V33 setup form; prefer this-project scope and Edge Functions Secrets read/write permission. Never send tokens through chat. Until supplied, runtime secret writes remain deliberately unavailable. A successful form submission must be followed by refreshed ready status after Supabase propagates its environment.

No live valid-token bootstrap, actual provider credential replacement/rollback, AI generation, payment, SMTP delivery or webhook delivery is claimed tested. Provider keys/models, the Studio encryption key and server activation remain unconfigured in the observed production readiness state. Adding a runtime variable does not implement unsupported billing, SMTP/Auth configuration, calls or external workers. Root credential recovery/rotation remains in the Supabase dashboard.

The full V32 release audit remains applicable for unfinished shared editor architecture, media/device acceptance and account-to-account flows. Physical Safari/Android tests remain unavailable.

## Rollback

Frontend rollback: previously verified live version 29 (`appgprj_6ad9f8a7371481918bde729c8934a24d~appgver_ffe4d479ae7c8191a1bc15c79d3e4a64`), commit `f22070b826ed864a766c47ab2199b1a8e292d9d9`.

Backend rollback: redeploy the exact entrypoint/import map/files in `rollback/velori-environment-v2.json`, with its existing `verify_jwt:false`. The snapshot contains source only, not runtime credentials. This restores the previously ACTIVE version-2 behavior; no database rollback is needed for V33.
