# VELORI Developers — Authorization

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

# 8. API PERMISSION SCOPES

Design a scope system:

- `profile:read`
- `profile:write`
- `posts:read`
- `posts:write`
- `comments:read`
- `comments:write`
- `reels:read`
- `reels:write`
- `stories:read`
- `stories:write`
- `notifications:read`
- `media:write`
- `jobs:read`
- `applications:write`

Not all scopes should automatically be made available to third-party integrations.

Sensitive permissions need additional approval.

Separate first-party internal permissions from third-party delegated scopes.

Any messages-related developer scope must receive a dedicated security and privacy assessment before implementation.

Use default-deny rules, short-lived authorization and revocation support.

---
