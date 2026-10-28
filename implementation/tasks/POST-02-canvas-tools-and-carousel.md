# POST-02 — Complete the post canvas and carousel workflow

## Task identification

- **Stage:** D — Individual screen implementation
- **Dependencies:** POST-01 verified.
- **Specification:** `specs/01-post-editor.md`; `docs/ui-redesign/03-authentication-and-feed.md`, `09-motion-responsive-accessibility.md`, and `10-testing-and-acceptance.md`.
- **Status:** NOT STARTED.

## Objective

Bring the existing `/create` editor to the specified multi-slide canvas workflow while preserving its Supabase draft/media/publish path. Inspect current support before editing; the canvas, layer panel, and up-to-10 uploaded media slides already exist, so add only verified gaps.

## Repository inspection

Read `/create` route and `CreatePost`, post canvas and layer panel, canvas engine and tests, post editor types, upload validation/ordering, draft loading, current theme tokens, auth/feature gates, and post publish handler. Inspect `specs/01-post-editor.md` in full and relevant current browser layouts.

## Required changes

- Verify or complete 1–20 slide capacity and order controls against the existing product/backend limits; do not raise the 10-media limit without checking current database constraints.
- Verify mixed text/image/shape layers, selection, transform, z-order, visibility/lock, and slide-scoped state.
- Complete text font/size/weight/color/alignment/letter-spacing/line-height/stroke/shadow; image crop/rotate/flip/brightness/contrast/saturation/blur/opacity; per-layer blend/opacity; and the specified 50+ geometric/arrow/badge shapes and searchable recolorable icons where real assets exist.
- Complete solid, linear/radial gradient, image and pattern backgrounds, 20+ filter presets and custom LUT only when the current renderer can apply/export them. Do not add fake libraries or placeholder controls.
- Retain image accessibility text, current media validation, upload retry/errors, and publish permission rules.

## Design requirements

Use Motion Glass tokens and shared controls; preserve the current editor shell. Provide accessible names, keyboard focus, touch targets, responsive panel behavior, and loading/empty/error/disabled states. Inspect at 320, 375, 430, 768, 1024, and 1440 px where browser environment permits.

## Files and integration

Likely `src/app/views.tsx`, `src/components/post-editor/*`, `src/lib/post-editor/*`, `src/lib/post-media.ts`, and focused editor CSS. No schema/dependency changes without authorization.

## Acceptance criteria

- Create and reorder a five-slide mixed text/image/shape carousel and retain each slide's independent layers.
- Specified text and image properties remain editable and apply to the rendered canvas. Shape, icon, GIF, background, filter and LUT controls are exposed only when connected to real supported behavior.
- Editor media limits match the existing server/database contract and errors explain exceeded limits.
- Existing saved drafts, audience settings, and real post publish behavior remain connected.
- No inaccessible controls or unintended horizontal overflow at target widths.

## Tests

Canvas engine tests, relevant post-media/editor tests, typecheck, full suite, build, focused formatting, and authenticated browser interaction tests. Avoid live publication.

## Completion report

Record inspected existing capabilities, added behavior, files, tests, viewport/browser evidence, and any target feature blocked by absent asset/backend contracts.
