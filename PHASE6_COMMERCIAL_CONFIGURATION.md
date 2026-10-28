# PHASE 6 COMMERCIAL CONFIGURATION

## Current state
The workspace preserves the existing pricing and billing architecture, but no live Stripe-provider billing mutation layer was introduced in this patch. This is intentional: billing prices and currencies are authoritative at the Stripe provider layer.

## Required operating rule
- Presentation content can be edited in VELORI admin
- Actual price objects remain authoritative in Stripe
- Checkout must continue to use provider-verified price IDs
- Subscription migrations and price transitions require explicit server-side reconciliation and authorization

## Phase 6 readiness
The repository has the right structural foundation for pricing administration, but end-to-end commercial testing remains blocked on live payment and entitlement data.
