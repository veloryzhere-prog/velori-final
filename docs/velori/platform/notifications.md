# VELORI Platform — Notifications

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current behavior

The existing notification system remains separate from delivery of support, recruiting or developer-program messages. A stored notification does not prove an email was delivered.

## Proposed workflow delivery

Write an outbox record in the same transaction as the accepted workflow transition. Use an idempotency key for each transition/template/recipient. A provider-configured worker leases pending records, retries bounded failures, stores an accurate receipt and reports permanent failures. Do not claim staff notification while no provider is configured.

Honor current notification preferences and optional-marketing consent. Keep passwords, identity evidence, private attachments and credentials out of email bodies and logs. Link to an authenticated application or ticket rather than attaching another person's private document. Configure and test retention before collecting applicant or verification material.
