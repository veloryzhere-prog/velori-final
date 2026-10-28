# REEL-02 — Reel clip, effects, captions, overlays and audio panels

## Task identification

- **Stage:** D — Individual screen implementation
- **Dependencies:** REEL-01 verified.
- **Specification:** `specs/02-reel-editor.md`.
- **Status:** NOT STARTED.

## Objective

Complete connected reel editing controls for clips, transforms/keyframes, speed ramps, transitions, effects/color grading, captions, overlays, audio, voiceover and beat tools.

## Repository inspection

Read corresponding `src/lib/reel-editor/*` modules and tests, inspector/panel components, media fixture constraints, browser audio/video APIs, and existing upload/export contracts. Verify every control's state path before editing.

## Required changes

- Connect trim/split/ripple/roll/slip/slide/reframe/rotate/flip/speed, keyframes, mask/chroma key/PiP, and transitions to actual selected clip state.
- Enforce clip source bounds; support 0.1x–4x speed and ramps, position/scale/rotation/opacity/crop keyframes, rectangle/ellipse/polygon/bezier masks, freeze/loop, and transitions from the specified 50+ catalogue.
- Connect blur/sharpen/noise/vignette/letterbox, color wheels/curves/HSL and safe `.cube` LUT controls to preview or render state; unsupported render operations must be identified clearly.
- Connect 30+ text animations, caption SRT/VTT import and presets, sticker/emoji/GIF overlays, marker/chapters, and beat snapping to actual project state.
- Verify 500+ template browsing/search/filter/application using real templates and working replacement slots. Connect local/library audio only where licensed catalog and playback contracts exist; the specification's 10k music/500 SFX counts must never be fabricated. Reuse waveform/beat/EQ/dynamics/voiceover logic already present.
- Verify collaboration comments/annotations/assignments/review/version compare and client link against actual access controls. Existing client-side roles or temporary channels are not authorization or durable collaboration.

## Design requirements

Keep panels compact and accessible, with validation, empty/error/permission states and responsive scroll behavior. Do not present placeholder catalog content as real/licensed media.

## Files and integration

Likely `src/components/reel-editor/*`, `src/lib/reel-editor/*`, route state and CSS. No additional dependencies or backend contracts without authorization.

## Acceptance criteria

- Each displayed control changes the selected project state and survives timeline selection changes.
- Invalid/out-of-media bounds edits fail safely.
- Imported captions parse accurately; preview/render timing stays aligned.
- Template application changes real project state; collaboration permissions and persistence are reported according to the actual backend contract.
- Audio library data is real and licensed, or the catalog is clearly unavailable without fake assets.

## Tests

Run each affected clip/effect/color/caption/audio test, full suite, typecheck, build, focused format, and browser interaction checks with safe local fixtures.

## Completion report

List connected editing operations, actual render support, test results, media/catalog limits and browser evidence.
