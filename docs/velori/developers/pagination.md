# VELORI Developers — Pagination

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Current conventions

Existing APIs are not assumed to share one envelope. Read the handler and caller together. The new public ecosystem API must define a versioned envelope before release, while preserving existing social and administrator contracts.

## Proposed keyset pagination

Order by a stable timestamp plus UUID tiebreaker. Validate a bounded page size and an opaque cursor; query for limit + 1 accessible rows, then return next_cursor and has_more. Apply authorization and visibility before pagination so private records cannot affect disclosed counts. Empty lists return an empty array and no next cursor. Support accessible Load More even when infinite scrolling is enabled.

Search and filtered cursors must encode or bind their query/filter context. Reject a cursor from another collection rather than silently exposing an unrelated page. Do not promise globally consistent rankings while concurrent writes occur.
