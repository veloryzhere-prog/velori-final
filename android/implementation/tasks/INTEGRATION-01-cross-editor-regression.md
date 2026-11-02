# INTEGRATION-01 — Cross-editor route, privacy and design regression

## Task identification

- **Stage:** E — Cross-screen integration
- **Dependencies:** POST-02 through POST-04, REEL-01 through REEL-03, and STORY-01 through STORY-03 complete or explicitly blocked with accepted product decision.
- **Specifications:** `specs/01-post-editor.md`, `specs/02-reel-editor.md`, `specs/03-story-editor.md`, `docs/ui-redesign/01-design-system.md`, `02-app-shell-and-navigation.md`, and `09-motion-responsive-accessibility.md`.
- **Status:** NOT STARTED.

## Objective

Confirm all three creation studios work as parts of the existing VELORI product and keep consistent shared controls, routing, auth, data privacy, motion, and responsive behavior.

## Repository inspection

Read all three studio routes, shared StudioShell/UI primitives/tokens, auth/feature gates, Supabase client and storage workflows, editor state models, and current E2E route/viewport coverage.

## Required changes

- Verify navigation into/out of each editor preserves route behavior and authenticated boundaries.
- Compare shared buttons, fields, panels, dialogs, feedback, tokens, focus and reduced motion across editors; fix only integration regressions.
- Confirm drafts/media do not leak between editor types, accounts, or signed-out sessions.
- Verify layout transitions and scrolling at 320, 375, 430, 768, 1024, and 1440 px.

## Acceptance criteria

Relevant routes load without runtime errors, auth/feature gates remain intact, cross-editor navigation is usable, shared UI is coherent, and no unintended overflow or privacy exposure is detected.

## Tests

Relevant route/auth/privacy tests, all tests, typecheck, build, formatter, and browser route/interactions at the viewport matrix. Do not mutate live content.

## Completion report

List route/viewports exercised, tests, regressions fixed, protected workflows not exercised, and remaining blockers.
