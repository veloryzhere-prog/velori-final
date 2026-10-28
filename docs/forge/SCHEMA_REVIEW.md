# Approval request: Studio schema and backend deployment

**APPROVED AND APPLIED on 25 October 2026 (India time).** The canonical `AGENTS.md` boundary says: “Never modify database schema without asking”. Approving this document authorizes only this Studio proposal, not the earlier, broader ecosystem proposal.

Review SQL: `supabase/proposals/20261025_artifacts_studio.sql`.

| Table | Purpose and access |
| --- | --- |
| velori_studio_projects | Encrypted source/history; authenticated owner read, server-only writes |
| velori_studio_shares | Hashed, revocable, expiring tokens; server-only access |
| velori_studio_accounts | Studio quota and entitlement ledger; owner read, server-only mutation |
| velori_studio_requests | Atomic save/generation idempotence and reservation reconciliation; server-only |
| velori_studio_orders | Validated one-time Checkout orders; owner read, server-only mutation |
| velori_studio_billing_events | Webhook deduplication; server-only |

All six tables enable RLS, revoke default public access, and scope owner read policies. Nine helper functions use SECURITY INVOKER with empty search_path and explicitly service-only execution. Foreign keys reference existing auth.users without modifying that table. New accounts are created lazily. No profiles ALTER, extension, cron job, auth policy change or social-table update is proposed.

Generation reserves before network I/O and refunds failure. Reservations older than two minutes reconcile during account access. Save requests check cloud version timestamps. Account row locks protect quotas; daily reservation counts use a transaction-scoped advisory lock. Refund/dispute handling reverses entitlements with deduplication and preserves credit debt.

After approval: validate SQL in a staging database, test owner/outsider/anonymous grants, race two reservations and saves, test abandoned reconciliation, duplicate webhooks, refund-before/after fulfillment and rollback. Only after those pass should production installation be proposed/applied. This source review and unit suite do not prove live RLS or concurrent SQL execution.

## Exact backend deployment approval

Deploy the new `velori-studio` Edge Function from `supabase/functions/velori-studio/index.ts` into the existing **velori complete** Supabase project (`gmgobchwnfkwfuekhpkr`). This creates a new public HTTP endpoint; it does not replace `server` or change its configuration. Gateway `verify_jwt=false` is needed for public readiness, plans, expiring-token previews and signed Stripe webhooks. Every account action independently verifies the bearer token with Supabase getUser and rejects anonymous accounts; webhooks independently verify the raw-body signature. Protected actions remain disabled until server flags, schema and encryption are ready.

Public readiness returns only booleans, never secret values. Configured-origin allowlisting defaults to this existing VELORI site and may be explicitly overridden with exact origins. Server key resolution supports both Supabase legacy environment keys and the newer default key dictionaries.

**25 October 2026:** automatic approval review rejected both database installation and Edge deployment because this specific production schema and new public endpoint lack explicit approval. Neither operation was retried or bypassed. To proceed, explicitly approve both the six-table SQL and this isolated backend deployment. Provider/payment credential setup and end-to-end acceptance are still required afterward.

## Approved installation result

User explicitly approved both operations. Migration version **20261024232208**, name `velori_forge_studio`, applied successfully after correcting a CASE-expression parsing issue; the failed first attempt rolled back. Actual migration source is in `supabase/migrations/20261024232208_velori_forge_studio.sql`. The isolated `velori-studio` function is ACTIVE, version 1, with handler-level authentication and approved gateway configuration. Existing `server` was not replaced.

Transactional SQL acceptance passed quota deduction/replay, failure and abandoned refunds, save replay/version conflicts, outsider mutation denial, billing duplicate/reversal behavior, owner reads, outsider reads, anonymous-account denial and anonymous grants. Fixtures rolled back; projects/accounts/orders returned to zero. All nine helper functions deny anon/authenticated execution and allow service_role. This does not claim concurrent network races, live provider calls or actual payments were tested.

Deployed HTTP readiness returned 200 with correct site CORS: database ready; encryption, server activation, provider/model and billing configuration absent. Live AI/cloud/billing remain disabled until protected server setup.
