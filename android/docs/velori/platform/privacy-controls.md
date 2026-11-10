# VELORI Platform — Privacy Controls

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Existing boundaries

Current accounts, content visibility, private messages, blocking and connection-list permissions remain governed by the existing database policies and server handlers. This expansion must not replace those rules with client-side filters. Message attachments stay private, including the newly allowed GIF MIME type.

## New workflow boundaries

Support tickets belong to their requester; staff notes are separate from requester-visible replies. Recruiters may access only applicants for their authorized organization. Developer owners may see application metadata but never stored credential verifiers or webhook signing references. Verification evidence and resumes require private storage and short-lived server-authorized delivery. Translation and legal review drafts are not public content.

All new status transitions and mutations require trusted endpoints, validation, ownership checks, permitted state transitions and audit records. The proposal grants no browser writes to workflow tables, preventing a client from approving itself. RLS reads and column grants remain a second boundary even when client code is modified.
