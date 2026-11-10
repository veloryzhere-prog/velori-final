# POST-03 — Post animation, export and platform previews

## Task identification

- **Stage:** D — Individual screen implementation
- **Dependencies:** POST-02 verified and scene format stable.
- **Specification:** `specs/01-post-editor.md`; `docs/ui-redesign/09-motion-responsive-accessibility.md`, `10-testing-and-acceptance.md`.
- **Status:** NOT STARTED.

## Objective

Implement the specified layer/page animation timeline, image exports, carousel PDF, animated MP4 path, and platform/feed previews only to the extent supported by existing browser/server processing services.

## Repository inspection

Read current post animation utilities/tests, canvas renderer, current export/publish code, Supabase/Edge export functions, package capabilities, preview component, and actual route UI. Confirm whether each target format has an executable pipeline before exposing controls.

## Required changes

- Add/complete per-layer animation and page-transition editing with a usable timeline and keyboard-accessible transport.
- Provide verified PNG scale options, PDF carousel output, and MP4 only through an existing supported renderer; never display success for an unavailable encoder.
- Complete IG/FB/LinkedIn/X preview framing and feed context from actual editor content; support dark/light preview.
- Add clear progress, cancellation/error, and output feedback states.

## Design and functional requirements

Honor reduced motion and keep editor preview timing separate from published content. Use real generated output, correct dimensions, accessible controls, and responsive timeline behavior.

## Files and integration

Likely post editor animation/export modules, preview/export components, and `CreatePost`; reuse installed project tools. No new dependency or API contract without approval.

## Acceptance criteria

- An animated element and a page transition can be edited and previewed from a timeline.
- PNG at 2x has the expected pixel dimensions; PDF includes all carousel slides in order.
- MP4 action appears only if a working renderer exists and produces a validated file.
- Platform preview changes context without mutating or publishing the draft.
- Reduced-motion preference, errors, and small viewport behavior are correct.

## Tests

Animation/export unit tests, typecheck, full suite, build, focused formatting, and browser checks for preview and real export output. Never claim unexecuted format support.

## Completion report

List each verified export type, measured output dimensions, supported platform previews, tests, visual evidence, and unsupported formats.
