# REEL-01 — Reel project model and timeline route integration

## Task identification

- **Stage:** D — Individual screen implementation
- **Dependencies:** Stage A–C verified; no schema changes without authorization.
- **Specification:** `specs/02-reel-editor.md`; `docs/ui-redesign/05-reels.md`, `09-motion-responsive-accessibility.md`, `10-testing-and-acceptance.md`.
- **Status:** NOT STARTED.

## Objective

Replace the local-demo-only creation path with the existing reel editor architecture where safely possible, beginning with project/track/clip state and the real timeline. Preserve the reels viewer and existing auth/media gates.

## Repository inspection

Inspect `/reels/create`, `src/pages/ReelStudio/*`, `src/components/reel-editor/*`, `src/lib/reel-editor/*`, Twick integration, Supabase upload/export functions, route/feature/auth gates, tests, and all `specs/02-reel-editor.md` requirements. Identify what persists remotely versus in memory/local browser.

## Required changes

- Integrate the multi-track engine (4 video, 4 audio, 2 overlay tracks), timecode/frame stepping, playhead, ruler, zoom/fit, scrubbing, markers, and clip selection into the actual authenticated route.
- Support frame boundaries at 1/30 or 1/60 and existing tested timeline geometry without unbounded rendering costs.
- Reuse current browser storage/API contracts. Do not create Prisma/Supabase schema or claim remote persistence without authorization and a deployed contract.
- Keep Twick as a dependency only if it serves a real supported workflow; do not duplicate timeline state between engines.

## Design requirements

Use Motion Glass tokens, clear transport hierarchy, responsive timeline/panels, keyboard scrubbing/frame step, focus states, reduced motion, and informative empty/loading/error states.

## Files and integration

Likely `src/pages/ReelStudio/*`, `src/components/reel-editor/Timeline*`, `src/lib/reel-editor/engine*`, route and focused CSS. Explain any architecture changes.

## Acceptance criteria

- Authenticated editor route uses the timeline engine rather than a detached demo state.
- Timecode and frame-step operations are exact at selected frame rate.
- A project with 100+ clips loads and remains responsive.
- Existing reel viewer, auth, upload validation, and privacy boundaries remain intact.
- No false claim of server save/publish.

## Tests

Reel engine/API/timeline/clip-editing tests, typecheck, full suite, build, focused format, authenticated browser interaction and responsive review.

## Completion report

Record route/auth behavior, model persistence limits, performance evidence, viewport evidence, tests and blockers.
