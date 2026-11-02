# Ecosystem acceptance tests

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

# 19. TESTING AND VERIFICATION

Run tests appropriate to the existing project.

Test all 17 original footer routes.

Test every additional public route.

Test CMS draft and publish workflows.

Test legal document version histories.

Test developer applications, scope approvals, revoked credentials, expired tokens and unauthorized access.

Test job filtering, application submissions, employer access and applicant privacy.

Test support tickets and contact confirmation.

Test mobile and desktop language selection.

Test browser refresh on nested routes.

Test animation behavior in actual browsers.

Test route transitions without breaking existing VELORI authentication.

Test Supabase RLS with distinct authorized and unauthorized users.

Test search and pagination with both empty and populated data.

Test genuine error conditions rather than only successful responses.

Never bypass authentication or disable security controls to make a test pass.

Do not claim tests ran unless they actually executed.

---

## Recorded execution

The base release passed 249 of 250 tests with one existing skip on Linux. TypeScript and production builds passed. Windows production build passed; its full-test rerun hit read-only temporary Git fixture metadata. The nine focused documentation/display-setting/GIF checks run separately. No unexecuted RLS, workflow, applicant privacy or provider-delivery test is reported as passed.

## Required next checks

After schema approval, use distinct requester/recruiter/developer/admin/outsider accounts. Include unauthorized access, column escalation, private assets, state transitions, duplicate submissions, concurrent review, expired grants and signed URL expiry. Never disable auth or policies to make tests pass.
