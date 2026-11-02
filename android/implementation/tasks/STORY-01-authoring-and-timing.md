# STORY-01 — Close story authoring, timing and media gaps

## Task identification

- **Stage:** D — Individual screen implementation
- **Dependencies:** Stage A–C verified; retain current Story Studio and its authenticated route.
- **Specification:** `specs/03-story-editor.md`; `docs/ui-redesign/04-stories.md`, `story-studio-blueprint.md`, `story-studio-audit.md`, `story-studio-device-parity.md`, `story-studio-mobile-ux-audit.md`, and `docs/ui-redesign/10-testing-and-acceptance.md`.
- **Status:** NOT STARTED.

## Objective

Compare the existing Story Studio against the full story specification and implement only concrete gaps in media, 10-slide authoring, 15-second timing, interactive sticker preview, transitions, brand tools, and export.

## Repository inspection

Read all relevant story specs, `src/app/story-editor-page.tsx`, story components, `src/lib/story-editor/*`, story tray/viewer/archive, existing Supabase media upload/publish, RLS policies, and Playwright acceptance evidence in `docs/VELORI_PROGRESS.md`.

## Required changes

- Keep the current 9:16 canvas, scene tools, object editing, animations, responsive shell, feature flag and auth wrappers.
- Verify 10 slides/15-second limits, transitions, story player timing, touch/keyboard navigation and mixed-media behavior.
- Verify photo/video (60-second input limit)/GIF/camera, video trim/speed/reverse, available background/collage/blur options, 20+ text styles and auto-sizing, and 3/5/10/15-second timing with 0.3–1.5-second transitions.
- Verify actual interactive sticker semantics in preview. A static poll/question label must not be represented as a working audience-response feature.
- Verify searchable animated/static sticker catalog, PNG/SVG sanitation, poll/question/quiz/slider/link/countdown and location/mention/music/hashtag behavior; only inputs with actual functional interactions may be called interactive.
- Verify logo/watermark controls, brand consistency checks, full-story dark/fullscreen preview, per-slide/full-story MP4 and images, and story template/brand-kit behavior against actual renderer support.
- Reuse current validated media tools and upload/signing flow; implement only capabilities supported by installed browser/server processing.
- Resolve story scene save/restore only through an existing authorized backend API; otherwise clearly retain device-local boundaries.

## Design requirements

Preserve the verified six-tool layout and responsive panel/footer geometry. Use Motion Glass tokens, reduced motion, accessible keyboard/pointer/touch interactions and honest empty/error/retry states.

## Files and integration

Likely `src/app/story-editor-page.tsx`, `src/components/story-editor/*`, `src/lib/story-editor/*`, story CSS and existing media helpers. No schema or dependency changes.

## Acceptance criteria

- A five-slide mixed-media story can be authored, ordered and previewed with correct per-slide timing/transitions.
- Unsupported stabilization/audio mix/export options are accurately surfaced; configured audio tracks or transitions are not claimed in output unless actually composited.
- Any interactive preview item performs its real preview action and is not confused with audience response collection.
- Upload errors/retry and unsupported media states are surfaced without corrupting the draft.
- Existing story audience/privacy/publish permissions remain unchanged.
- Test actual route at desktop, tablet and phone sizes; no overflow or console errors.

## Tests

Affected story unit tests, full suite, typecheck, build, focused format, and authorized authenticated browser checks. Do not publish a story.

## Completion report

Record spec gaps, verified media/preview behavior, viewport evidence, tests, data persistence boundaries and remaining blockers.
