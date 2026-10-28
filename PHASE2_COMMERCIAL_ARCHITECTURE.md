# FORGE AI Phase 2 Commercial Architecture

## Authority and data flow

```text
Authenticated user
  -> edge-function authentication and user-scoped actions
  -> verified pricing / existing checkout mapping
  -> Stripe payment
  -> verified webhook and backend entitlement records
  -> account/quota response
  -> FORGE access and account billing UI
```

The client displays validated server responses; it does not assign prices, payment outcomes, or entitlements. A return URL is not evidence that a payment succeeded. The new billing-history action derives ownership from the authenticated user rather than accepting a client-supplied user ID.

## Pricing and products

The current pricing integration recognizes `PRO_MONTHLY`, `PREMIUM`, and `PACK100`. Stripe/provider data is validated by the existing backend. The UI displays only returned verified prices and reports unavailable/loading states otherwise.

| Product | Commercial type | Current treatment |
|---|---|---|
| Free | Existing account allowance | Displayed without changing the configured allowance |
| Forge Pro Monthly | Recurring subscription | Shown as a monthly product; purchasability depends on verified recurring price and active subscription schema |
| Premium access | One-time purchase | Kept distinct from subscription status |
| Credit pack | One-time, 100 additional requests | Kept distinct from subscription benefits |
| Yearly / Max / campaign offer | Not verified/configured | Not advertised as purchasable |

No values are inferred from marketing copy. Currency and amount require provider response. No discount percentage is calculated without comparable configured prices.

## Entitlement and quota

The account UI accepts and validates both the existing legacy quota response (`FREE`/`PREMIUM`, `freeLeft`, `tokens`) and the newer `hybrid-v2` shape. It preserves the distinction between base allowance and purchased requests. The server remains the source of truth for balances and entitlement.

Legacy responses do not contain totals, used quota, or reset timestamps; the UI therefore does not derive percentages or dates for them. The work did not add a new ledger, reservation transaction, expiry policy, or debit priority. Those are not claimed as newly verified behavior.

## Purchase history

`billingHistory` is an authenticated edge-function action. It reads a limited set of recent purchase fields for the authenticated identity and returns an explicit service error when the query fails. The frontend validates the response before presenting entries. It does not expose project source or accept a caller-selected account identity.

## Offers

Offer discovery is presentation logic over existing configuration, not an entitlement grant system. It respects active generation and dismissal/frequency behavior, surfaces fetch failures, and makes no unverified discount or bonus-credit claim. Financial campaign eligibility and duplicate-grant protection remain unverified and require a server-authoritative offer contract.

## Database and deployment boundary

No database migration or production data change was made. The recurring subscription SQL under `supabase/proposals/` is a proposal, not an active migration. Confirm schema, RLS, webhook configuration, and environment-specific Stripe prices before enabling recurring subscriptions or deploying the commercial flow.
