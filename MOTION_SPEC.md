# Motion Design System

## Timing
- Micro-interaction (tap, toggle, hover): 200ms
- Component entrance (sheet, modal, card): 300ms
- Page/screen transition: 400ms
- Exit/dismiss: 200ms
- Stagger between list items: 50ms

## Motion Glass UI Tokens
Shared UI defaults live in `src/index.css`; editor token aliases in
`src/styles/tokens.css` consume the same semantic colors, spacing, typography,
radii, and shadows. Reusable controls and their states are in
`src/components/ui.tsx` and `src/components/ui.css`.

- Canvas: `#FFFFFF`; soft canvas: `#FFF8FC`; primary/muted text:
  `#17131B` / `#706A76`; border: `#EDE5ED`
- Brand pink/electric blue: `#F05A9D` / `#3478F6`; soft tints:
  `#FCE7F1` / `#EAF1FF`
- Spacing: 4, 8, 16, 24, 32, and 48 px; radii: 6, 10, 16, 32, and 999 px
- Typography: DM Sans body, Manrope headings; 12, 14, 16, 20, and 28 px
  shared scale
- Surfaces: translucent primary/secondary/elevated and glass variants;
  opaque fallbacks, 16 px glass blur, semantic focus ring, primary/strong
  borders, and status colors
- Responsive breakpoints: 520, 760, 1050, and 1440 px
- Motion tokens: 160, 240, and 320 ms; standard/emphasized easing; 4, 8, and
  16 px motion distances
- App shell: 258 px sidebar, 1280 px content width, 76 px desktop header, and
  62 px mobile header

Published theme settings continue to override the light palette. Dark mode
derives readable text and canvas colors from those settings; disabling the
existing glass-effects setting removes blur from the shared navigation chrome.

## Springs (use for all interactive/user-initiated motion)
- Default: `{ type: "spring", stiffness: 300, damping: 30 }`
- Heavy (modals, sheets): `{ type: "spring", stiffness: 200, damping: 25 }`
- Light (toggles, buttons): `{ type: "spring", stiffness: 400, damping: 30 }`

## Rules (NON-NEGOTIABLE)
1. ONLY animate `transform` and `opacity`. Never width, height, top, left, margin.
2. Use `AnimatePresence` for all enter/exit animations.
3. Use `layoutId` for shared element transitions between screens.
4. Wrap all motion in `MotionConfig reducedMotion="user"`.
5. Use `useMotionValue` + `useTransform` for continuous values (progress, scroll).
6. Hoist variant objects outside components (no inline object creation per render).
7. Use `LazyMotion` + `m` component for production bundle optimization.
8. Stagger children with `staggerChildren: 0.05` on parent variants.
9. No animation on scroll position (use `whileInView` for entrance only).
10. Every animated component must have a `useReducedMotion()` fallback.

## Section-Specific Specs

### Reels
- Vertical swipe: drag with `dragConstraints`, `dragElastic: { top: 0.1, bottom: 0.1 }`
- Progress bar: `scaleX` synced to video currentTime via `useMotionValue`
- Comment sheet: bottom sheet, `y: "100%"` → `y: 0`, drag-to-dismiss, staggered comments
- Double-tap heart: `scale: [0, 1.2, 1]`, `opacity: [0, 1, 0]`, duration 600ms
- UI auto-hide: after 3s idle, `opacity: 0` + `pointerEvents: none`
- Swipe up to dismiss: `y: "100%"` with velocity check

### Stories
- Ring: SVG stroke-dashoffset animation synced to story progress
- Auto-advance: crossfade `opacity: [1, 0]` → next story `opacity: [0, 1]`
- Pull-to-dismiss: rubber-band `drag` with `dragElastic: 0.8`
- Reply input: slide up from bottom, spring entrance

### Feed / Posts
- Card entrance: `opacity: 0, y: 30` → `opacity: 1, y: 0`, stagger 50ms
- Like button: `scale: [1, 1.3, 1]` spring bounce
- Save/bookmark: `scale` morph + color transition
- Infinite scroll: skeleton shimmer (CSS `@keyframes` for the shimmer, Framer for card entrance)

### Profile
- Header reveal: `opacity: 0, y: -20` → visible on mount
- Stats counter: `useMotionValue` + `useTransform` count-up animation
- Tab indicator: `layoutId="tab-indicator"` shared element morph
- Cover image: subtle parallax via `useScroll` + `useTransform`

### Messages / Chat
- Bubble entrance: `scale: 0.9, opacity: 0` → `scale: 1, opacity: 1`, spring
- Typing indicator: three dots, `y: [0, -6, 0]` staggered 100ms, infinite
- New message: smooth `scrollTo` bottom with spring
- Send button: `whileTap: { scale: 0.9 }`

### Settings / Navigation
- Page transition: `x: "100%"` → `x: 0` (enter), `x: "100%"` (exit)
- Toggle: `x` spring animation on the thumb
- Destructive confirm: `x: [0, -10, 10, -10, 0]` shake + red flash
- Bottom nav: `layoutId` for active indicator morph
- Sheet (edit profile): same as comment sheet pattern

## Accessibility
- `prefers-reduced-motion`: all animations become `duration: 0` (instant, no transform)
- Focus states: `whileFocus: { scale: 1.02 }` on interactive elements
- No information hidden behind hover-only animations
