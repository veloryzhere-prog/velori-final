# Expanded implementation status

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

The machine-readable implementation-status.json is authoritative for this handoff. Every requested route is classified; requested routes are not counted as deployed. The foundation release and the much larger attached ecosystem request are distinct scopes.

## Blocking decision

AGENTS.md says: Never modify database schema without asking. Review supabase/proposals/20261024_ecosystem.sql and SCHEMA_REVIEW.md. No schema has been applied and no new private workflow can be advertised as operational until its tables, guarded handlers and authorization tests are installed.

## Remaining work

Apply an approved schema; integrate legal content-hash approval into CMS publishing; implement ticket/recruiter/developer/verification state machines and private attachments; configure real provider delivery; build article records/search/category/feedback; implement and review translations; implement approved API operations and credential lifecycle; run cross-account, unauthorized, expiry, revocation, abuse, file and delivery acceptance checks. AI remains under construction. There is no automatic legal approval or verified-employer data seeded by this proposal.
