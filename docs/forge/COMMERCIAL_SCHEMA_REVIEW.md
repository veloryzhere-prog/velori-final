# Commercial v2 schema — approval required

The installed six-table Forge schema stays active. This five-table upgrade is separate and is not covered by the earlier approval.

Review: supabase/proposals/forge_commercial_v2.sql (NOT APPLIED / NOT PostgreSQL-validated).

New tables: velori_forge_wallets (daily/monthly/topup balances and manual restriction); velori_forge_requests (idempotent reservation/reconciliation); velori_forge_orders (server SKU/amount/provider mapping); velori_forge_settlements (unique event/transaction ledger); velori_forge_receipts (one queued receipt per settlement).

All tables enable RLS. Owners can only read their wallet/orders. Remaining tables and four SECURITY INVOKER helper functions are service-role only. No existing table ALTER, public token increment RPC, extension or cron is proposed.

Approval authorizes staging/transactional validation and routine corrections within this scope. Production installation follows successful acceptance. Provider purchases, charges, email sending, credential creation and worker deployment are not included.

Tests must cover simultaneous requests, duplicate/reordered payment events, cross-period refunds, UTC/month boundaries, empty topups, manual restrictions, owner/outsider/anonymous denial and duplicate receipts. Runtime settlement/refund/cancellation/outbox wiring and legacy entitlement transition must be completed before v2 activation.

AGENTS.md requires: “Never modify database schema without asking”.
