# PHASE 6 ADMIN ARCHITECTURE

## Design principles
- Keep the admin experience within the existing VELORI admin shell
- Reserve authorization and entitlement enforcement to server-side APIs
- Keep public-facing commerce and AI policy separate from browser state
- Maintain auditability for all changes that affect billing, access, entitlements or provider configuration

## Route and navigation model
The current admin console uses a route tree and navigation registry under [src/app/admin-console](src/app/admin-console) and [src/app/routes.tsx](src/app/routes.tsx). The new FORGE admin surface is a first-class section in that shell rather than a disconnected tool.

## Security model
- Authentication remains in the admin console session layer
- Role-based permission checks remain the front-end gate for visible controls
- Actual privileged mutations remain bound to the server-backed admin API layer in [src/lib/admin-api.ts](src/lib/admin-api.ts)
- Secrets are not stored in React bundles or browser-readable config

## Operational domains
1. Platform configuration and system health
2. FORGE runtime and feature controls
3. Commercial and promotional configuration
4. AI provider and model policy
5. CMS and announcements
6. User support and audit logs

## Current Phase 6 status
The source now includes a dedicated admin overview screen for FORGE that checks feature flag and platform configuration state. Full commercial and AI operation screens remain intentionally deferred until the live server environment exposes the required back-end objects.
