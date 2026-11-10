# VELORI Developers — Authentication

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current first-party authentication

The browser uses the existing Supabase Auth client in src/lib/supabase.ts. Account sessions and resource authorization remain separate: a valid session does not override RLS, owner checks, blocking or private content visibility.

Administrators use the existing server/admin session, guarded routes and permission checks. The administrator API uses an HttpOnly __Host-velori_admin_session cookie where supported and a tab-isolated fallback token. Preserve CSRF/origin validation and recent reauthentication requirements; never copy a service-role key into a browser bundle.

## Proposed delegated clients

Authorization Code with PKCE is a target only after an actual authorization server, consent screens, exact redirect matching, short-lived codes, challenge verification and revocation are implemented. A Supabase first-party session is not proof that this separate delegated service exists. Keep OAuth registration unavailable until its complete flow is tested. Do not manufacture token endpoints or working examples for services that have not been deployed.

## Failure behavior

Expired, revoked and malformed sessions must return the appropriate existing unauthenticated response without resource details. Cross-user requests must remain denied even when an application is approved. Retain the visible draft while prompting a member to sign in again.
