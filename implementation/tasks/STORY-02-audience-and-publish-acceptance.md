# STORY-02 — Story audience, tray/viewer/archive and publish acceptance

## Task identification

- **Stage:** D — Individual screen implementation
- **Dependencies:** STORY-01; an authorized non-production account and backend are required for protected interactions.
- **Specification:** `specs/03-story-editor.md`; `docs/ui-redesign/04-stories.md`, `10-testing-and-acceptance.md`.
- **Status:** NOT STARTED.

## Objective

Verify and fix real story audience/privacy, tray grouping, viewer progression, archive, signed media access, upload retry and publish success/failure flows.

## Repository inspection

Inspect routes for `/stories`, `/stories/create`, `/stories/archive` and feed `StoryTray`; existing query/mutation helpers, Supabase RLS, audience settings, signed URL expiry, feature flags, and prior acceptance notes.

## Required changes

- Preserve public/follower/close-friends/private audience checks, reply/reaction permissions, seen/viewed state, expiry, archive ownership and unavailable-story feedback.
- Verify empty/loading/error/retry states, keyboard controls, touch progression, selected-story deep links and disabled feature flag.
- Correct only reproducible defects; never broaden visibility or use a service-role bypass from client code.
- Exercise story upload failure and publication responses without publishing real content.

## Acceptance criteria

Signed-out and signed-in states, all audience modes, tray/viewer/archive states and RLS paths behave according to the actual backend. Unauthorized access is rejected. No private media is exposed through preview or URL fallback.

## Tests

Story and privacy tests, typecheck, full suite, build, browser route/interactions at target widths and authorized non-production RLS checks. Do not claim privileged acceptance without the required role/session.

## Completion report

List account role/environment used, privacy cases, results, screenshots or trace IDs, tests and anything still blocked by missing credentials/backend availability.
