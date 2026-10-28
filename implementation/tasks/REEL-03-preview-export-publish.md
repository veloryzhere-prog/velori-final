# REEL-03 — Reel preview, export and publish integration

## Task identification

- **Stage:** D — Individual screen implementation
- **Dependencies:** REEL-02 verified; actual supported export/publish provider contract required.
- **Specification:** `specs/02-reel-editor.md`; `docs/ui-redesign/05-reels.md`, `10-testing-and-acceptance.md`.
- **Status:** NOT STARTED.

## Objective

Deliver an accurate realtime/platform preview, validated export settings and real upload/publish/scheduling only through existing authorized backend/provider integrations.

## Repository inspection

Inspect preview and render pipeline, `supabase/functions/reel-export`, Supabase storage signing/authorization, post/reel social publishing contracts, route permissions, time zone handling, and current UI-only publish action.

## Required changes

- Provide playback/scrubbing/frame step, platform frame/safe zone, audio meters, thumbnail selection, and accessible preview controls.
- Implement actual MP4/MOV encodes only if renderer and server contract support codec/resolution/fps options; validate generated media/duration.
- Replace the false local “Published” success with a real existing publish flow or explicit unavailable/error state. Scheduling must use authorized API and timezone-safe values.
- Never send uploads or publish content during testing without explicit test-account/environment availability and user authorization previously granted.

## Design and acceptance criteria

Preview follows editor scene; render output matches chosen dimensions/fps/duration; progress, cancel/retry, errors, and permission restrictions are real. No placeholder-success state remains.

## Files and integration

Likely reel preview/export/publish components, `src/lib/reel-editor/export*`, existing Edge Function and route. No new provider, dependency or database contract.

## Tests

Export pipeline tests, typecheck, full suite, build, formatting, browser export with safe fixtures and authorized non-production publish flow where available.

## Completion report

Report actual output formats/options measured, endpoint and permission path used, browser evidence, tests and unsupported options.
