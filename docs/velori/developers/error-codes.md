# VELORI Developers — Error Codes

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Existing server errors

src/lib/admin-api.ts wraps administrator failures in AdminApiError with status and optional code, permission and errorId. Recent reauthentication and password-change gates are interpreted separately by the console. Preserve this existing contract.

## Proposed public errors

The new gateway should use a versioned safe envelope with a machine code, user-readable message, bounded field details and request_id. Document 400 invalid syntax, 401 missing/invalid identity, 403 denied permission, 404 unavailable or concealed resource, 409 version/idempotency conflict, 413 size limit, 415 unsupported MIME, 422 semantic validation, 429 throttling and 500 unexpected failure where applicable.

These meanings are a proposed contract rather than a statement that every current handler emits this exact shape. Never return SQL errors, service keys, user tokens, internal stack traces or another applicant's personal information. Retain input drafts on recoverable submission failures.
