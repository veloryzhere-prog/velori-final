# VELORI Developers — Rate Limits

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current status

The existing administrator code includes bounded login attempts and lockout controls. Those controls do not establish limits for a proposed public API. No requests-per-second or daily quota is advertised as implemented for /v1.

## Required enforcement

Define limits separately for login, contact submissions, file uploads, search, application submissions, key rotation and webhook registration. Enforce quotas on trusted infrastructure using authenticated identity and a carefully chosen network signal where appropriate. Do not use only a browser timer or an in-memory per-process counter across horizontally scaled workers.

Return 429 with an accurate retry policy and avoid charging a retried idempotent submission as a second successful mutation. Set operational values after capacity and abuse testing. Record configured values in API documentation only after the gateway actually enforces them.
