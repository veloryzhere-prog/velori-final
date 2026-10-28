# VELORI Forge — complete blueprint review

The product remains inside the existing VELORI site: same React/Vite application, Supabase project, authentication, product navigation and admin. Reviewed the original PDF, all 1,032 lines of the 14-module specification, all 551 lines of the second specification and the latest commercial workflow in chat.

## All 14 original modules

| Module | Existing implementation |
|---|---|
| 1 Topology | /forge, /artifacts, /studio/:projectId, /forge/pricing and /s/:secretToken in the existing router |
| 2 Database | Six installed Studio tables, RLS and service-only helpers; existing profiles/social tables preserved |
| 3 Connection | Existing Supabase HTTPS client/RPCs; no duplicate Prisma/Accelerate connection pool |
| 4 Encryption | Server AES-256-GCM, random nonce and ownership/context binding; protected key pending |
| 5 AI | Configurable Gemini model/fallback, bounded image/context, validated structured multi-page results; provider setup pending |
| 6 Workspace | Existing CodeMirror HTML/CSS/JS, Run, desktop/phone canvas, pause/restart; no unapproved Monaco dependency |
| 7 Generation | Verified user token, atomic reserve/refund, idempotent request; deployed but configuration-gated |
| 8 Editor | Browser drafts, explicit account saves and conflict checks; no per-keystroke billing |
| 9 Pages | Eight validated paths, hash routing, reviewed revisions and all-page export |
| 10 Sharing | Hashed expiring/revocable capabilities, no public prompt history, opaque iframe |
| 11 Pricing | Current billing retained; /forge/commercial reviews the proposed model |
| 12 Payments | Signed idempotent v1 Stripe source deployed but unconfigured; subscription upgrade staged separately |
| 13 Abuse | Server account/hour/global limits and bounded provider input/output/time |
| 14 Delivery | Same repository, tests/build/audits and protected-secret examples |

## Latest commercial contract

The latest text conflicts between 1,000/day and 1,000/month. This phase follows its pricing matrix: Free 1,000 requests per UTC day; Pro 50,000 per actual paid billing period at INR 999/USD 12 monthly; a 5,000-request pack at INR 249/USD 3 once. Pro is not advertised as unlimited. Prices use integer minor units.

Base quota is used before top-ups. Unused top-ups survive period resets. Manual restrictions are independent and never cleared by a purchase. Failures refund once to the original bucket/period, without replenishing a later period. Existing v1 entitlements remain unchanged. Legacy credits/lifetime users need an explicit transition decision before v2 rollout.

## Source delivered in this phase

- commercial.ts: validated typed pricing and period/balance contract.
- CommercialPricing.tsx: existing-site responsive white/gold review page and currency selection. Payments are disabled and clearly labeled pending.
- QuotaDialog.tsx plus Assistant integration: server-supplied 90 percent/exhausted/restricted states. No fake balances, countdowns or applied-discount claims.
- Supabase commerce.ts: canonical recurring Stripe Checkout validation, exact raw-byte Razorpay HMAC, captured-order amount matching and escaped currency-aware receipt HTML.
- forge_commercial_v2.sql: five isolated proposed tables and atomic balance/reserve/finish/settle helpers with receipt outbox enqueue. NOT APPLIED or PostgreSQL-validated.

## Required before commercial activation

1. Approve the separate five-table proposal for staging validation. Test real RLS, concurrent requests, duplicates, boundary resets and rollback. No new schema is applied by this phase.
2. Wire v2 generation/compile reservation and settlement behind a rollout flag after database acceptance; retain current v1 behavior and legacy entitlements until transition is agreed.
3. Retrieve paid Stripe invoice/subscription records with protected merchant credentials. Validate customer/order ownership, SKU/price, amount/currency, mode and actual provider service period. Add cancellation, failure, refund/dispute and event-order fencing. Never add 30 local days as a subscription grant.
4. Razorpay top-ups require merchant-created orders and canonical captured-payment API lookup. PhonePe has a separate API contract. No typed UTR, deep link, screenshot or success redirect is payment proof. UPI/subscription eligibility depends on provider/account/mandate support.
5. Dispatch receipts from a protected outbox worker: claim safely, resolve the purchaser from auth.admin.getUserById, use the verified email and actual payment amounts, stable delivery ID and retry state. Never hardcode a recipient or invent tax/legal details.
6. Configure and test real provider prices/secrets/webhooks in sandbox before live payments. Promotion UI stays absent until a real authorized first-month offer is validated server-side.

These are prerequisites, not claims of operational subscription billing. No charge, subscription, email, new account or private key was created.

## Whisper.cpp / social editor additions

child_process, FFmpeg and Whisper.cpp cannot execute in Supabase Edge or a browser iframe. They need a separately deployed authenticated Node worker with fixed binaries/models, bounded uploads/duration/concurrency, execFile argument arrays (no shell interpolation), timeouts/output limits and cleanup in finally. An Edge handler may authenticate/proxy to it. No transcription or Docker service is claimed here. Existing social editor routes are preserved; Fabric.js is not added as a side effect of billing work.

## Corrections to pasted examples

Client IDs do not authenticate users. Client-callable SECURITY DEFINER token increments permit fraud. Trigger updates roll back when an exception is raised. Metadata alone does not prove payment ownership. Webhooks duplicate/reorder. Local previews cannot provide trustworthy server metering. These requirements are addressed in the review and acceptance plan.

Official Stripe references reviewed: https://docs.stripe.com/billing/invoices/subscription and https://docs.stripe.com/india-recurring-payments?integration=subscriptions .
