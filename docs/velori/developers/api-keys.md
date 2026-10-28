# VELORI Developers — Api Keys

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Availability

Third-party developer credentials are not currently issued. The public Supabase publishable key identifies the project and never substitutes for user authorization. The service-role key is server-only and is not a developer credential.

## Proposed lifecycle

Require approved application ownership and an allowlisted set of actually implemented scopes. Generate high-entropy secrets on the trusted server, return plaintext only at creation, persist a verifier hash, display a nonsecret identifier and support expiry, rotation and revocation. Never log plaintext, expose secret_hash through SELECT *, or send keys in query strings.

Rotation must invalidate the old verifier according to an explicit documented policy and write a privileged audit event. A revoked or expired application must fail before an operation reads or changes a resource. Credential storage in the proposal does not implement the API gateway, OAuth or these operational checks.
