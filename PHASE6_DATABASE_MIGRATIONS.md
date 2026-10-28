# PHASE 6 DATABASE MIGRATIONS

## Rule
This Phase does not create duplicate database tables or rewrite the authoritative source of truth without a reviewed migration plan.

## Current state
The current project already contains a broad set of existing admin and platform data layers, and the new Phase 6 work intentionally reuses those rather than introducing competing authoritative storage.

## Safe migration policy
- Additive migration only when a real operational need is confirmed
- Preserve RLS, auditability and access boundaries
- Maintain version fields and conflict-safe updates
- Keep feature flags and config under the existing server-controlled admin pattern

## Status
No schema changes were introduced in this patch because the required operational tables for full FORGE billing, provider configuration and campaign reward ledgers are still external to this working checkpoint.
