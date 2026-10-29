# Business & Growth API contracts

These are source contracts for Supabase project `gmgobchwnfkwfuekhpkr`. On 2026-10-29, read-only remote checks confirmed that migration `20261107000000_velori_business_growth.sql` is present in the production migration ledger, all 111 local migration versions match the remote ledger, and the active `server` Edge Function is version 62. The downloaded deployed `index.tsx` and `admin-business.ts` SHA-256 hashes exactly match this worktree. Anonymous GETs to the admin referral-program and offers routes returned HTTP 401. These checks do not replace authenticated admin workflow or end-to-end testing.

## Admin API

Base URL: `${supabaseUrl}/functions/v1/server/admin`. Requests use the existing HttpOnly admin session. Every route reuses the server-side admin permission middleware; UI visibility is not an authorization boundary.

### Offers

| Method and path | Permission | Request / response |
|---|---|---|
| `GET /offers?page=&perPage=&status=` | `offers.view` | Response: `{ offers: OfferRow[], total, page, perPage }`. `status` is `draft`, `active`, `paused`, or `archived`. |
| `POST /offers` | `offers.edit` | Requires `title`, `offer_type`, `eligibility`, ISO `starts_at`, ISO `ends_at`, and integer `usage_limit`; `description` is optional. New rows are always `draft`. Response: `{ offer, created: true }`. |
| `PATCH /offers/:id` | `offers.edit` | Partial allowed offer fields plus optional `status` and `reason`. Response: `{ offer, updated: true }`. `paused` deactivates; `archived` is terminal. |

Offer types are `percentage`, `fixed_amount`, `bundle`, `free_trial`, and `manual`. Eligibility values are `all_users`, `new_users`, `pro_users`, `creator_users`, and `vip_users`. An offer can be activated only when its window is valid, has started, has not expired, and its configured usage limit is not exhausted. Invalid date windows are rejected on create and update.

Offers are administrative configuration only. No checkout/redemption endpoint is implemented, so usage counts remain database values and are not represented as measured redemptions or conversions. No consumer flow can apply an offer until that integration is separately implemented.

### Referrals and rewards

| Method and path | Permission | Request / response |
|---|---|---|
| `GET /referrals/program` | `referrals.view` | `{ program }` for the singleton current rule set. |
| `PATCH /referrals/program` | `referrals.edit` | Partial program fields: `enabled`, ISO-or-empty `starts_at`/`ends_at`, `require_verified_email`, `min_successful_generations`, `inviter_reward_tokens`, `invitee_reward_tokens`, `max_rewards_per_inviter`, `max_total_qualified_referrals`, `max_lifetime_reward_tokens_per_user`, and optional audit `reason`. Returns `{ program, updated: true }` when saved. Enabling currently returns `409` because the repository has no trusted Android installation-verification integration. |
| `GET /referrals?page=&perPage=&status=` | `referrals.view` | `{ referrals, total, page, perPage }`; status is `pending`, `qualified`, or `rejected`. |
| `GET /referrals/rewards?page=&perPage=&status=` | `referrals.view` | `{ rewards, total, page, perPage }`; status is `granted` or `reversed`. |
| `GET /referrals/events?page=&perPage=` | `referrals.view` | `{ events, total, page, perPage }`, including qualification outcomes and recorded processing failures. |
| `PATCH /referrals/codes/:userId` | `referrals.edit` | `{ enabled: boolean, reason?: string }`; response `{ code, updated: true }`. |
| `POST /referrals/rewards/:id/reverse` | `referrals.reverse` | `{ reason }`, 1–1,000 characters. Successful response `{ reversed: true, rewardId }`; repeat reversal returns conflict. |

Admin mutation responses are audited with the existing `admin_audit_logs` system. Reward reversals additionally persist the administrator, reason, and timestamp on the reward transaction and add a referral event.

### Failure cases

- `400`: malformed input, unsupported enum, invalid date, or failed field validation.
- `401` / `403`: missing or invalid admin session / missing server permission.
- `404`: unknown offer, reward, or referral code owner.
- `409`: invalid lifecycle transition, expired/full activation, repeated reward reversal, or an attempt to enable referrals before trusted Android installation verification is deployed.
- `500`: database operation failed; response does not return a success-shaped fallback. If an audit insert fails after a mutation has committed, the request fails explicitly; check the saved state and audit log before retrying.

## Public signup and account RPCs

The browser uses only the existing Supabase publishable key. Referral tables are not directly readable or writable by `anon` or `authenticated`.

- `velori_validate_referral_code(p_code text)` is callable by `anon` and `authenticated` and returns `{ valid: boolean, reason: string | null }`. Reasons include `invalid_code`, `disabled_code`, `expired_code`, `program_disabled`, `program_not_started`, `program_expired`, `self_referral`, and `already_used`. It reveals no user identity.
- Signup sends a prevalidated code in `auth.signUp` metadata as `referral_code`. An `auth.users` trigger independently validates it and creates one unique referral record per invitee. Normal signup continues without referral attribution when the preflight code is invalid or the validation service is unavailable.
- `velori_qualify_my_referral()` requires an authenticated user and returns the server-calculated state. It accepts no user ID argument.
- `velori_my_referral_dashboard()` requires an authenticated user and returns only that user's code, invited-user history, reward transactions, configured public qualification/reward terms, and current Forge token balance.

Attribution is pending at registration. The migration initializes `installation_verification_status` to `unsupported`; qualification returns pending with `installation_verification_unsupported` unless trusted verification has been implemented and server-validated. The installation-state/timestamp constraint and server-only table grants prevent browser clients from asserting verified installation. The existing admin API also rejects program activation while the verifier is absent. Only after the installation gate may qualification require the program to be enabled and in its date window, any configured email verification, and the configured number of completed `generate` rows in `velori_studio_requests`. The existing generation-completion trigger can request qualification, but cannot bypass installation verification.

Both reward rows, the qualified referral transition, and `velori_studio_accounts.tokens` increments occur atomically. A program-row lock serializes cap evaluation; unique invitee, idempotency, and transaction constraints prevent duplicate processing. Processing exceptions roll back reward/entitlement changes, leave the referral pending, and write a deduplicated `processing_failed` event with the SQLSTATE for admin review.

Reward type is deliberately limited to `forge_tokens`: that is the existing server-enforced spendable entitlement in FORGE. Reversal subtracts the recorded amount from the same account balance; if tokens have already been spent, the existing allowance contract prevents spending a negative balance until it is replenished. No payment, subscription, or app-install reward is granted.

Referral-link clicks are not tracked. A new account registration is not itself qualification.
