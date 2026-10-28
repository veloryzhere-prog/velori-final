# 09 — Motion, responsive behavior, and accessibility

Status: NOT STARTED (shared providers and tokens exist; audit has not been performed).

## Existing support

- Framer Motion `MotionConfig reducedMotion="user"` and `LazyMotion` are provided by `src/motion/MotionProvider.tsx`.
- Public runtime motion settings are read by `src/lib/motion-provider.tsx`; common springs/timings/variants are in `src/motion/springs.ts` and `src/motion/variants.ts`.
- CSS uses `:focus-visible`, semantic controls and responsive media queries in `src/index.css` and feature CSS.
- Theme code supports system/light/dark. Shell and editor use touch/keyboard behaviors.
- At writing time the repository provides Playwright E2E, screenshot-on-failure, and `scripts/_ui-audit.mjs`; see test specification for baseline.

## Motion rules

- Keep motion brief and state-linked. Existing timing tokens: micro interaction 200 ms, component entrance 300 ms, page transition 400 ms, exit 200 ms; existing spring stiffness/damping lives in `src/motion/springs.ts`.
- Use opacity/transform for simple transitions. Do not block input until an animation finishes.
- Respect `prefers-reduced-motion` through providers and CSS; disable nonessential distance/scale/continuous motion under reduced motion.
- Avoid decorative loops, excessive bounce, and layered blur that harms rendering.

## Responsive audit widths

Minimum: 320, 375, 430, 768, 1024, 1440 px. Existing E2E audit script currently checks 390 px mobile and 1440 px desktop; expand coverage for a phase only when practical and record the actual viewport sizes tested. Handle safe areas, touch size, responsive nav, overlay and keyboard viewport behavior.

## Accessibility rules

Use semantic landmarks/headings/buttons/links, labels and descriptions for inputs, accessible names for icon-only controls, visible focus, logical tab order, focus restoration for dialogs, suitable contrast in both themes, and keyboard equivalents for swipe/drag or pointer-only actions. Do not rely on color alone. Preserve screen-reader live status for loading/errors where present.

## Acceptance

For changed screens check 320/375/430/768/1024/1440 or state exact available sizes; check keyboard-only navigation, focus-visible, touch interactions, reduced motion, contrast, safe areas, no horizontal overflow, dialog focus lifecycle, accessible loading/error announcements. Record visual evidence location without committing user/private screenshots unintentionally.

## 2026-10-23 — Shared spatial motion implementation

New MotionSculpture and spatial-motion.css add CSS depth geometry and social motion across active product components. MotionExperience now targets ProductFrame-era selectors, batches dynamic scans, limits pointer tilt to one animation frame, pauses off-screen sculptures and suspends ambient motion in hidden tabs. Existing Full/Gentle/Off and device preference are preserved; browser checks confirmed Full animation and static Gentle/Off decorations. Story theatre additionally uses a 10 Hz progress timer, active-only video, document-visibility pause, keyboard controls and modal focus handling. Shared route checks and exact acceptance limits are recorded in VELORI_PROGRESS.md. This is not a claim that every accessibility or performance audit in the original roadmap is complete.
