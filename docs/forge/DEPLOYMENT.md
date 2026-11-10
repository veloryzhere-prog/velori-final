# Studio deployment and operational checklist

1. Obtain explicit approval for both the six-table proposal and the isolated Edge deployment in SCHEMA_REVIEW.md. Review staging execution, grants/RLS, concurrency, reconciliation and rollback before production. Use the installed Supabase CLI's current help to generate an actual migration; the SQL under proposals is review-only.
2. Configure `supabase/functions/velori-studio/.env.example` as protected Supabase Edge secrets. Keep the AES key exactly 32 cryptographically random bytes encoded as base64; retain a secure backup. Rotating/removing it without re-encryption makes saved projects unreadable. Never use VITE_ for Gemini, service-role, encryption or Stripe keys.
3. Set exact allowed origins and an app URL matching one of them. Configure current Gemini model identifiers available to the owner account and check current provider documentation, pricing and quotas. Generation is disabled unless both Studio and generation flags are true.
4. Deploy the isolated `velori-studio` function after schema validation. Its handler independently verifies real user bearer tokens. Public status/plans/capability preview and signed Stripe webhooks need gateway JWT verification disabled for this function only; confirm the CLI's current flags/config before deployment. Do not change the existing social function's JWT policy.
5. Use a separate Stripe sandbox first. Configure actual active one-time INR/USD price IDs for PACK100 and PREMIUM. Use a restricted server key with the necessary read/create permissions where supported. Hosted Checkout selects eligible dynamic methods; do not promise UPI availability. No payment is fulfilled by a success URL.
6. Register the function's `/webhook` URL for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded` and dispute events handled in index.ts. Store the endpoint-specific signing secret. Test successful, unpaid, asynchronous, duplicate, altered, mismatched and replayed events; verify full refund and dispute reversal. Partial refunds do not automatically remove the whole pack.
7. Test two real authorized users: project/save/list ownership, expired/revoked shares, no prompt history in public responses, no raw database token/source exposure, quota concurrency, provider errors/timeouts, save conflicts and cache replay. Verify public frames cannot access application storage or credentials.
8. Enable `VITE_STUDIO_ENABLED=true` only after acceptance, rebuild/redeploy frontend and retest production origins. Billing availability derives from validated configured prices, not a client mock.

Run `corepack pnpm test`, `corepack pnpm typecheck` and the supported Sites build helper. Pure TypeScript server tests run under Node; they do not replace `deno check` and deployed-function tests. Keep generation disabled if those acceptance checks cannot be performed.

## Recovery

Disable VELORI_STUDIO_GENERATION_ENABLED to stop model calls, or VELORI_STUDIO_ENABLED to stop cloud services. Rebuild with VITE_STUDIO_ENABLED=false to restore local-only UI. Revoke share rows through authorized backend operations. Preserve the encryption key and take a protected database backup before any destructive rollback. Existing social routes and admin remain independent.

## Readiness and retries

The assistant's Connection & setup panel can recheck server readiness once the function is deployed and VITE_STUDIO_ENABLED=true. Until then the public frontend makes no calls to the missing endpoint. The protected server status route reports database, encryption, activation, provider and billing booleans without exposing values. Cloud capability requires all database/encryption/activation checks. AI and billing have their own additional gates.

General calls time out after 12 seconds; generation allows 65 seconds for the server's bounded provider attempt. Uncertain save retries reuse the same request identifier for an unchanged project to prevent duplicate quota deductions. Draft edits produce a new fingerprint. Runtime key parsing supports current Supabase default-key dictionaries and existing legacy variables; no credential is returned to the browser.
