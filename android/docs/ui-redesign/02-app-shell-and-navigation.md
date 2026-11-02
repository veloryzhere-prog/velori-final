# 02 — App shell and navigation

Status: VERIFIED.

## Existing structure

The social application is rendered under the `/` layout route using `Shell` in `src/app/shell.tsx`. It owns visitor-entry behavior, primary navigation, responsive shell, feature-aware links, theme controls, and route error/not-found/maintenance surfaces. Navigation uses `react-router` and lucide-react. Page transitions use the existing motion wrappers in `src/lib/motion.tsx`.

The admin console is a separate route tree: `src/app/admin-console/frame.tsx`, `navigation.tsx`, `session.tsx`, `page-registry.ts`. It has permission-filtered navigation and console-specific content. Keep its authorization/session behavior intact and coordinate its redesign in Phase 7.

The global tokens include 258 px sidebar, 76 px header, 62 px mobile header, 1280 px content maximum and a phone-shell radius. Global styling is primarily in the long `src/index.css`; inspect existing breakpoints/selectors before reorganizing.

## Route ownership

Social shell routes include home/feed, explore/search, posts, profiles, stories, reels, messaging, notifications, groups, settings, help, dynamic CMS pages, and unknown-route dispatch. Exact paths are in `VELORI_UI_MASTER.md`. Account-only routes can redirect signed-out visitors to login while preserving the requested path; public entry routes use the visitor experience.

## Phase 2 plan

- Map current desktop sidebar/header, mobile navigation, active indicators, feature-flag visibility, profile menu, and shell-level overlays before changing layout.
- Preserve route destinations and query/hash state during auth redirects and return navigation.
- Maintain separate shell responsibilities for social app, admin console, standalone story editor and error/maintenance surfaces.
- Align page max widths, safe areas, fixed navigation spacing, scroll containers, and overlay z-index layers.
- Ensure nested route outlets and lazy chunk error boundaries continue to work.
- Avoid competing navigation patterns; test every link and keyboard focus.

## Acceptance

At 320/375/430/768/1024/1440 px, shell navigation remains reachable, content is not hidden behind fixed UI, no horizontal overflow appears, and all route destinations/permissions remain unchanged. Verify visitor and authenticated shell variants.

## Implementation and verification evidence

- Reworked the social shell in `src/app/shell.tsx` and `src/index.css` for responsive desktop navigation, a touch-sized mobile navigation pattern, and a compact-screen drawer. Existing feature-filtered destinations, profile links, unread counts, and route ownership remain in place.
- The mobile drawer supports Escape-to-close, focus trapping and restoration, background inertness, body-scroll locking, and closes after selecting a destination. The Create action continues to use the existing post, story, and reel destinations through the shared dialog; the offline banner uses the shared notification component.
- Updated the shared `IconButton` ref forwarding and `Dialog` body-scroll handling in `src/components/ui.tsx`. No authentication, route declarations, permissions, backend contracts, or database schema were changed.
- Browser auth smoke test: `/feed?hello=world#comments` redirected to `/login` while retaining `/feed?hello=world#comments` as the return location.
- Browser responsive check: the signed-out visitor entry rendered at 320, 375, 430, 768, 1024, and 1440 px with `scrollWidth` equal to `clientWidth` at every size. Fixed a narrow-screen intrinsic-width overflow by allowing the highlighted hero text to wrap and the visitor content grid to shrink.
- Current task recheck: the visitor entry, public `/about` shell, and `/login` rendered on the Vite server at 8443 without browser page errors or horizontal overflow. Visitor CTAs reached `/login` and `/signup`; direct `/feed?hello=world#comments` and `/reels?reel=lan-check` requests retained their full return destinations. Screenshots: `artifacts/phase2-visitor-320.png`, `artifacts/phase2-visitor-1440.png`, `artifacts/phase2-about-1440.png`, and `artifacts/phase2-login-390.png`.
- `pnpm run typecheck`: PASS. `pnpm test`: PASS (203 passed, 0 failed). `pnpm run build`: PASS; Node emitted a `module.register()` deprecation warning. `pnpm exec oxfmt --check src/app/shell.tsx src/components/ui.tsx`: PASS.
- Authenticated acceptance completed with the existing non-production QA owner fixture: sign-in and session persistence across reload passed; at 390 × 844 px the compact drawer opened as a modal dialog, Tab entered the drawer from its trigger, Shift+Tab wrapped to the final control, background scrolling was locked, Escape closed the drawer and restored trigger focus, and selecting Explore navigated to `/explore` and closed the drawer. The mobile Create dialog also exposed the real post/story/reel destinations and closed on Escape with focus restored.
- The authenticated responsive matrix passed at 320, 375, 390, 430, 760, 768, 980, 1024, 1250, 1280, 1440, and 1920 px, asserting no document horizontal overflow and touch-sized mobile navigation/search targets. The signed-out visitor checks and requested-path redirect preservation above also passed.
- A real authenticated compact-shell screenshot from the QA run was visually inspected at 390 px. The compact shell keeps focus on its trigger until the user tabs; the key handler moves focus into the dialog when keyboard focus starts outside and wraps it at both boundaries.
- Phase 2 acceptance evidence: `pnpm exec playwright test e2e/qa-matrix.spec.ts -g "QA owner can sign in and the session survives a reload|signed-in compact navigation opens, traps focus, and closes accessibly|signed-in home stays within small screens and keeps mobile controls touch-sized"` passed 3/3; `pnpm run typecheck`, `pnpm test` (203 passed, 0 failed), `pnpm run build`, and `pnpm exec oxfmt --check src/app/shell.tsx e2e/qa-matrix.spec.ts` passed. Build retains the existing Node `module.register()` deprecation warning.
