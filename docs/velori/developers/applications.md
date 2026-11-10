# VELORI Developers — Applications

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

# 5. COMPLETE DEVELOPER APPLICATION SYSTEM

Build `/developers/apply`.

## Application requirements

Fields:
- Developer or organization name.
- Verified email.
- Organization website, if applicable.
- Application name.
- Application description.
- Intended integration purpose.
- Requested permission scopes.
- Redirect URIs.
- Privacy policy URL where required.
- Data handling explanation.
- Expected API traffic.
- Security contact.
- Agreement to current developer terms.

## Approval workflow

Draft → Submitted → Under Review → Changes Requested → Approved / Rejected → Suspended / Revoked.

Applicants must be able to view decisions and requests for additional information.

Administrators must record decisions, dates, reviewers and the reason for material permission changes.

Approval cannot be represented as automatic when review is required.

## Developer console

Build:
- Application overview.
- Credentials.
- Redirect URI management.
- Scope management.
- Webhook subscriptions.
- Request usage.
- Rate-limit information.
- Error diagnostics.
- Audit activity.
- Security notices.
- Developer support.

Never expose secrets in client-side code.

---
