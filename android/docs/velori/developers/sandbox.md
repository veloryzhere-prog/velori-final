# VELORI Developers — Sandbox

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current development environment

Use isolated fixtures or a dedicated approved test backend. Never send test messages to real members or use production resumes as fixtures. The current documentation/GIF checks use pure validation tests and an isolated real React picker for insertion and recents.

## Required integration sandbox

Create synthetic accounts for applicant A, applicant B, a recruiter, an outsider and administrators with distinct permissions. Test allow and deny cases, expired and revoked credentials, concurrent status changes, empty datasets, malformed cursors, unsupported files and repeated idempotency keys. Roll back database fixtures or provide an explicit cleanup process.

There is no public developer sandbox or registration service currently deployed. A preview badge does not turn a mock response into a working integration endpoint.
