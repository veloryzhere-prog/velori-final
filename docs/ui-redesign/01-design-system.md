# 01 — Design system

Status: VERIFIED (shared design foundation implemented and checked; later phases remain untouched).

## Existing sources of truth

- Global defaults and most application styling: `src/index.css`.
- Runtime site-theme settings and CSS variable application: `src/lib/theme-settings.tsx`.
- Public Motion configuration: `src/lib/motion-provider.tsx` and shared config in `supabase/functions/_shared/motion-config.mjs`.
- Global reduced-motion-aware animation wrapper: `src/motion/MotionProvider.tsx`, used by `src/app/App.tsx`.
- Spring and timing constants: `src/motion/springs.ts`; variants: `src/motion/variants.ts`.
- App primitives: `src/app/admin-primitives.tsx`. Admin-specific primitives: `src/app/admin-console/primitives.ts`.

## Current default token inventory

Defaults in `:root` in `src/index.css` already match the Motion Glass brief:

| Token role             | Current value                                                                     |
| ---------------------- | --------------------------------------------------------------------------------- |
| Canvas / soft canvas   | `#ffffff` / `#fff8fc`                                                             |
| Primary / muted text   | `#17131b` / `#706a76`                                                             |
| Border                 | `#ede5ed`                                                                         |
| Pink / blue            | `#f05a9d` / `#3478f6`                                                             |
| Soft pink / soft blue  | `#fce7f1` / `#eaf1ff`                                                             |
| Spacing                | 4, 8, 16, 24, 32 px                                                               |
| Radius                 | 6, 10, 16, 32 px (phone shell)                                                    |
| Sidebar/content/header | 258 px / 1280 px / 76 px (mobile header 62 px)                                    |
| Glass blur             | 16 px                                                                             |
| Motion                 | `--ease-out: cubic-bezier(.22,1,.36,1)`; `--ease-smooth: cubic-bezier(.4,0,.2,1)` |

The active theme may override colors, fonts, card style, button style, navigation style, and glass setting from Supabase. Light/dark theme values are set via `data-theme`. Keep user/site-configurable tokens working; Motion Glass defaults are not permission to remove those controls.

Typography defaults are DM Sans body and Manrope headings. Playfair Display is loaded for selected decorative/editorial uses. Existing token scale includes 12, 14, 16, and 20 px; inspect component usage before expanding the scale.

## Rules for Phase 1

- Define semantic tokens once; use semantic names for surface, border, text, brand, status, focus, and overlay states.
- Audit existing duplicate/legacy variables before consolidating; do not mass-replace fallbacks without screenshots and regression checks.
- Make glass selective: translucent white, subtle border, controlled blur/highlight. Ensure opaque fallback and readable contrast.
- Standardize button variants, icon buttons, input/textarea/select, cards/panels, dialogs/drawers, tabs, badges, avatars, skeletons, toasts, empty/problem states.
- Preserve app and admin primitives where their API/semantics differ; share tokens first, consolidate only with demonstrated value.
- Required states: default, hover, focus-visible, pressed, selected, disabled, loading, success, warning, error, and permission-restricted.
- Use lucide-react already in package for new app icons, consistent with existing icon system.

## Implemented foundation

- `src/index.css` defines the shared palette, semantic surfaces and text, status/focus/overlay colors, spacing, radii, typography, borders, shadows, glass, responsive breakpoints, and motion tokens. Glass surfaces have opaque fallbacks before translucency is applied. Runtime theme settings and dark-mode overrides remain active.
- `src/styles/tokens.css` maps the editor/studio aliases onto the shared token values instead of maintaining a competing palette.
- `src/components/ui.tsx` and `src/components/ui.css` provide shared buttons and links, icon buttons, inputs, textareas, selects, cards, badges, avatars, loading/empty states, notifications, menus, tabs, and accessible dialogs.
- The visitor landing uses shared buttons, cards, badges, and avatars; shell icon controls and admin input wrappers reuse the shared primitives without changing their product-specific behavior.
- Shared cards honor the existing runtime flat, outlined, elevated, and glass styles. Glass cards respect the published glass-effects setting and fall back to an opaque elevated surface when effects are disabled or unsupported.
- Control styling covers focus-visible, hover, pressed, selected, disabled/loading, validation-error, and status tones. Component animation is transform/opacity-only and respects reduced motion.
- `MOTION_SPEC.md` documents the default palette and preserves runtime theme overrides.

## Acceptance

- Each semantic token has one documented default and theme override behavior.
- Interactive controls have visible keyboard focus and disabled/loading states.
- Rendered visitor entry states were inspected at 1440x900 and 390x844. Playwright confirmed the page rendered, reduced motion hid the startup intro, neither viewport had horizontal overflow, and keyboard focus showed a 3px ring. Runtime checks confirmed all four shared card styles and that disabling glass removes blur while preserving a near-opaque surface. Screenshots are retained in `artifacts/phase1-visitor-1440.png` and `artifacts/phase1-visitor-390.png`.
- `pnpm typecheck`, `pnpm test` (203 passed, 0 failed), and `pnpm build` passed. Focused formatting passed for `src/components/ui.css` and `src/styles/tokens.css`; `src/index.css` retains pre-existing whole-file formatting drift and was not reformatted wholesale.
- No dependency, backend contract, authentication flow, database schema, or later redesign phase was changed.
