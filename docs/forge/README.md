# VELORI Forge AI / Artifacts Studio

Forge is integrated into the existing VELORI React/Vite application, existing Supabase authentication, global motion preferences, and public/product navigation. It is not a separate Next.js application. The uploaded 12-page PDF and both complete expanded blueprint texts informed the implementation.

## Available now

- `/forge` and `/artifacts`: prompt-led welcome, three explicitly hand-written starters, browser library, project import/export.
- `/studio/:projectId`: HTML/CSS/JavaScript editor, up to eight pages, explicit Run, isolated desktop/375px phone canvas, stop/resume/restart, local autosave with visible failure, reference-image preparation, conversation and reviewed revision workflow.
- `/forge/pricing`: honest service availability; real server price data and hosted Checkout only when configured.
- `/s/:secretToken` and `/preview/:secretToken`: server-backed expiring capability previews when enabled.
- Full/Gentle/Off use the existing site-wide controls. Decorative loops pause outside view and in hidden documents. No new dependencies.

Local drafts live in this browser and are separated by visitor/account scope. Export JSON for an editable backup. Download HTML bundles every page, CSS and JavaScript into one offline file; no Tailwind CDN is required. Generated source is untrusted and executes only in an opaque-origin iframe with restrictive CSP. Preview stop removes the frame. This is browser isolation, not a remote CPU/memory-limited container: malicious infinite loops can still freeze a browser process. Generated projects support static browser apps, not deployed private backend code or custom domains.

## Blueprint architecture map

| Module | Existing-site implementation |
| --- | --- |
| 1. Repository topology | `src/features/artifacts`, isolated `supabase/functions/velori-studio`, review-only SQL; existing social/admin routes retained |
| 2. Database | Six Studio-owned tables; no edits to existing profiles, social data or billing records |
| 3. Persistence connection | Existing Supabase HTTPS client and PostgREST RPCs; no extra Prisma connection pool |
| 4. Encryption | Server-only AES-256-GCM, fresh nonce, owner/project/request associated data, no fallback key |
| 5. AI generation | Configured Gemini REST models, optional image and revision history, JSON validation, optional fallback model |
| 6. Workspace | Existing CodeMirror packages instead of adding Monaco; responsive Build/Code/Preview layout |
| 7. Authentication and quotas | Verified Supabase `getUser` token, anonymous-account denial, atomic reservation/refund and retries |
| 8. Editor allowance | 50 meaningful account saves, not keystrokes; cloud lock preserves preview/export; local creation stays usable |
| 9. Multi-page apps | 1–8 validated pages including index, internal routing, all-page standalone export |
| 10. Public previews | 256-bit capability token stored only as SHA-256; seven-day expiry and owner revocation; no prompt history in response |
| 11. Plans | 10 lifetime free generations, 100-credit pack, lifetime Premium entitlement subject to provider/fair-use limits |
| 12. Payments | One-time Stripe Checkout, eligible dynamic methods, exact server price/amount/currency/owner checks, signed webhooks and replay protection |
| 13. Abuse controls | One active generation/account, 10 free or 60 Premium requests/hour, configurable global daily cap, bounded input/output and timeout |
| 14. Release | Feature flags default off; staged schema, function, credential and payment acceptance before enabling |

Premium is not a promise of unlimited provider capacity or permanently free inference. UPI appears only if Stripe/account/currency/customer eligibility supports it; a UPI handle or claimed transfer is never accepted as payment proof. Keys are configured as protected server secrets, never pasted into browser settings or included in a downloadable archive.

## Not activated

The six-table schema and isolated Edge Function are deployed. Transactional database acceptance and HTTP readiness passed. AI generation, cloud saves, public shares and paid entitlements await protected server configuration and end-to-end acceptance. The frontend checks deployed readiness; protected server flags keep unconfigured services disabled. See [schema review](SCHEMA_REVIEW.md), [deployment](DEPLOYMENT.md) and [verification audit](../audits/2026-10-25-forge-ai.md). A database proposal is not a migration that has been applied.
