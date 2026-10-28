# 03 — Authentication, feed, posts, and post creation

Status: IMPLEMENTED — NOT VERIFIED.

## Routes and implementation

- `/`, `/home`, `/feed` → `Feed` in `src/app/views.tsx`. Signed-out visitors are deliberately shown the visitor entry experience; do not treat these as authenticated feed routes without checking current guard behavior.
- `/login`, `/signup`, `/forgot-password`, `/reset-password` → `AuthPage`; email-check/confirmation routes map to `AuthCheckEmail`, `AuthConfirm`, `AuthConfirmed`.
- `/onboarding` → `Onboarding`.
- `/explore` and `/search`/people/hashtag routes discover public content and creators.
- `/post/:id` → `PostDetail`; `/create` → rich `CreatePost` editor; `/saved`, `/archive`, `/trash`, `/drafts` → saved/library workflows.

Auth is centralized in `src/lib/auth.tsx` using the Supabase client. Sign-up/sign-in/recovery live in `AuthPage`; redirects use `src/lib/auth-redirect.ts` and navigation helpers. Keep account creation, confirmation, reset, and redirect preservation intact.

Feed and post data use Supabase tables, `postSelection`, shared media/engagement helpers and RLS. CreatePost includes media modes, draft save/restore, post editor canvas tools, templates, layer management and collaboration. Keep these features and permission/visibility controls.

## Phase 3 plan

- Design visitor entry, authenticated feed, feed loading skeletons, empty/error/retry and pagination separately.
- Preserve post author links, media gallery, likes/comments/share/save counts and privacy-aware visibility.
- Redesign post creation without reducing its editing workflow; inspect `src/components/post-editor/*` and `src/lib/post-editor/*` specifications/tests before changing it.
- Keep draft, archive, trash, saved and restore/delete confirmations understandable and keyboard reachable.
- Cover auth validation, pending email/confirmation, recovery, errors, busy states, and return-to-requested-route behavior.

## Acceptance

Use QA states for signed-out visitor, signed-in user, empty feed, populated feed, failed query, media unavailable, draft editing, publish success/failure, private/follower visibility, and narrow phone. Existing post editor tests in `src/lib/post-editor` and `src/components/post-editor/canvas-engine.test.mjs` remain green.

## Implementation and verification evidence

- Updated the actual feed and post-authoring presentation in `src/app/views.tsx` and the global styles in `src/index.css`. `src/main.tsx` also imports `src/styles/reference-ui.css` after `index.css`; its later duplicate homepage selectors control the rendered landing and authenticated feed surfaces.
- Refined Motion Glass hierarchy and responsive styling for the existing story tray, create-post prompt, post cards, author metadata, media, engagement controls, loading/pagination area, and real composer controls. Existing real actions and destinations remain intact.
- Extended consistent surfaces, keyboard focus feedback, and mobile spacing to the existing post-edit/owner panel, comments, and saved/archive/trash/draft library cards. Their current action handlers and confirmations were preserved.
- Feed fetching, public/follower visibility filters, cursor pagination, error/retry and empty states, media signing, like/comment/share/save/report behavior, author links, draft/collaboration workflows, media validation/upload, audience permissions, preview, and publishing logic were not changed.
- Browser: signed-out `/home` visitor rendered with no horizontal overflow at 320/375/430/768/1024/1440 px. Direct `/create` redirected to `/login` and rendered the login form. No authorized signed-in browser session was available, so authenticated feed/editor content was neither accessed nor simulated.
- Checks: `pnpm run typecheck` PASS; `pnpm test` PASS (203 passed, 0 failed, including existing post-editor suites); `pnpm run build` PASS (Node reported its existing `module.register()` deprecation warning); `pnpm exec oxfmt --check src/app/views.tsx` PASS.
- Outstanding verification: authenticated feed states/actions/pagination, unavailable-media behavior, draft editing, publish success/failure, follower/private visibility, and authenticated narrow-phone/desktop layouts. Do not mark this phase VERIFIED until these are tested with authorized access. Phase 4 (Stories) remains NOT STARTED.

## Homepage redesign and cascade diagnosis (2026-10-19)

- Confirmed the root route is auth-dependent: `Shell` renders `VisitorLanding` for signed-out `/`, while authenticated `/`, `/home`, and `/feed` render `Feed`.
- The no-visible-change failure was caused by editing the earlier `index.css` homepage rules while later duplicate `.visitor-landing` rules in globally imported `reference-ui.css` supplied the active computed style. The stylesheet order and the browser's computed values confirmed the override; the page was not a stale production build, and the selectors matched the visitor markup.
- Redesigned the actual signed-out entry with a working header, preserved login/signup actions and return state, local logo fallback, social/story/reel preview, feature section, and footer. Added a branded intro and working Explore link to the authenticated `Feed`; feed fetching, visibility, pagination, and post actions remain unchanged.
- Fresh local-browser checks confirmed the actual signed-out `/` route at 320, 375, 390, 430, 768, 1024, and 1440 px with no horizontal overflow. The project logo loaded; reduced-motion preference was active; Help, signup, and login links reached `/help`, `/signup`, and `/login` without console errors. Desktop and mobile layouts were visually inspected.
- Validation: `pnpm run typecheck`, `pnpm test` (180 passed, 0 failed), and `pnpm run build` passed. Focused formatting passed for the homepage components and active stylesheet. Full `pnpm run format:check` reports only the pre-existing worktree change in `src/index.css`; no `lint` script is defined.
- Authenticated browser verification was unavailable, so the Feed's new intro and the authenticated feed data/actions still require a signed-in visual check. Keep Phase 3 `IMPLEMENTED — NOT VERIFIED`.
