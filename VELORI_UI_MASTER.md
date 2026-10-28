# VELORI UI Master Specification

Current implementation directive: V32 violet/plum luxury with a separately tuned light theme, as requested on 26 October 2026. `src/design-system/tokens.css` owns the current palette. The historical Motion Glass palette below is prior context. See `docs/v32/RELEASE_AUDIT.md` for actual implemented scope, test evidence and release blockers.

Status: Phase 0 documentation baseline. This document scopes the existing product redesign; it does not authorize removing features or changing backend contracts.

## Product and design direction

VELORI is the existing VELORYZ social content platform. Redesign its current screens as one responsive product using Motion Glass: white and soft-white foundations, light pink accents, electric-blue emphasis, readable typography, restrained glass surfaces, and purposeful motion. The starting colors are defined in `src/index.css` and runtime theme settings; preserve administrator-published theme choices and dark mode.

Use existing React 19, Vite, TypeScript, Tailwind CSS v4, React Router, Supabase JS, Framer Motion/Motion, and Lucide React. Do not add dependencies or replace the architecture for visual work.

## Actual application architecture

- Entry: `src/main.tsx` imports `src/index.css` and mounts `src/app/App.tsx`.
- Providers: `App.tsx` composes motion, auth, feature-flag, site-settings, theme-settings, and runtime motion providers before `RouterProvider`. Root and runtime error boundaries provide fatal fallbacks.
- Routes: `src/app/routes.tsx`; most public/social pages are lazy exports from `src/app/views.tsx`, which re-exports social pages. The admin console is a separate nested route tree under `/admin`.
- App shell: `src/app/shell.tsx`. Admin shell/navigation: `src/app/admin-console/frame.tsx`, `navigation.tsx`, and `page-registry.ts`.
- Shared app CSS and tokens: `src/index.css` (large global stylesheet); feature-local CSS exists, including `src/features/reels/reels.css`. Theme overrides are applied by `src/lib/theme-settings.tsx`; public motion overrides by `src/lib/motion-provider.tsx`.
- Data and permissions: Supabase JS client in `src/lib/supabase.ts`; auth in `src/lib/auth.tsx`; feature flags in `src/lib/feature-flags.tsx`; media helpers in `src/lib/social-media.ts`. Keep RLS and storage policies as the source of authorization.

## Existing route and feature inventory

The routes below are declared in `src/app/routes.tsx`; public CMS pages are also generated from `PUBLIC_PAGE_REGISTRY` in `src/app/admin-console/page-registry.ts`.

| Area                   | Existing routes and owner                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry/feed/discovery   | `/`, `/home`, `/feed` → `Feed`; `/explore` → `Explore`; `/search`, `/people`, `/hashtags/:tag` → `Search`                                                                           |
| Posts                  | `/post/:id` → `PostDetail`; `/create` → `CreatePost`; `/saved` → `Saved`; `/archive`, `/trash`, `/drafts` → `PostLibrary`                                                           |
| Profiles               | `/profile` → own-profile redirect; `/profile/:username` → `ProfilePage`; `/settings/follow-requests` → `FollowRequests`                                                             |
| Auth/onboarding        | `/login`, `/signup`, `/forgot-password`, `/reset-password` → `AuthPage`; `/auth/check-email`, `/verify-email` → `AuthCheckEmail`; `/auth/confirm`, `/auth/confirmed`; `/onboarding` |
| Stories                | `/stories` → viewer/composer; `/stories/create` → standalone `StoryEditorPage`; `/stories/archive` → archive                                                                        |
| Reels                  | `/reels` → viewer; `/reels/create` → `ReelStudioPage`                                                                                                                               |
| Messaging/groups       | `/messages`; `/groups`, `/groups/create`, `/groups/:slug`, `/groups/:slug/members`, `/groups/:slug/requests`                                                                        |
| Notifications/settings | `/notifications`; `/settings/notifications`; `/settings/privacy`; `/settings`, `/settings/appearance`, `/settings/account`                                                          |
| Public help/CMS        | `/help`; CMS registry slugs: `/about`, `/privacy`, `/terms`, `/community-guidelines`, `/safety`, `/cookies`, `/acceptable-use`, `/data-policy`, `/legal`, `/contact`                |
| Platform state         | `/maintenance`; unknown paths use `RouteDispatcher` and published CMS lookup before Not Found                                                                                       |
| Admin auth/console     | `/admin/login`; `/admin` and nested console screens listed in `08-settings-admin-and-cms.md`; unknown `/admin/*` is handled by admin fallback                                       |

The admin tree also declares aliases/duplicate paths. `/admin/assets` redirects to branding; `/admin/logs` redirects to audit; `/admin/people` and `/admin/users` share the users screen; `/admin/moderation` is declared both as a redirect to posts and as a reports screen. Treat this as an inventory finding to resolve deliberately during the admin phase, not as permission to silently change route behavior.

## Design/system constraints

- Refine existing tokens instead of scattering colors, radii, blur, shadows, or gradients.
- Preserve current user/site theme settings and `data-theme` light/dark mode behavior.
- Reuse app and admin primitives where contracts match; do not merge the separate admin and social shells blindly.
- Keep all media, collaboration, moderation, privacy, visibility, blocking, and feature-flag behavior.
- Use real data only. Existing feature flags can disable features; `PendingFeature` is a deliberate unavailable-state component and must not be replaced with fake content.
- Do not edit schema, migrations, auth, permissions, environment values, or backend contracts for visual work. Any separately requested backend change still requires explicit approval under `AGENTS.md`.

## Dependency-ordered roadmap

| Phase | Scope                                                                        | Specification                                                           | Depends on |
| ----- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------- |
| 0     | Repository audit, baseline checks, route inventory, design specs             | this master, `01`–`10`, progress tracker                                | none       |
| 1     | Shared tokens, typography, primitive controls, interaction states            | `01-design-system.md`                                                   | Phase 0    |
| 2     | Social shell, navigation, responsive layout, shared overlays                 | `02-app-shell-and-navigation.md`                                        | Phase 1    |
| 3     | Auth, visitor entry, feed, posts, post authoring/libraries                   | `03-authentication-and-feed.md`                                         | Phases 1–2 |
| 4     | Stories viewing, archive, standalone story editor                            | `04-stories.md`                                                         | Phases 1–2 |
| 5     | Reels viewer and separate reel studio                                        | `05-reels.md`                                                           | Phases 1–2 |
| 6     | Profiles, discovery, messages, groups, notifications                         | `06-profiles-and-discovery.md`, `07-messaging-and-notifications.md`     | Phases 1–2 |
| 7     | Account/privacy settings, admin, moderation, CMS/public pages                | `08-settings-admin-and-cms.md`                                          | Phases 1–2 |
| 8     | Responsive, accessibility, interaction, performance, visual regression audit | `09-motion-responsive-accessibility.md`, `10-testing-and-acceptance.md` | Phases 1–7 |

These phases are independently verified; each phase must update `docs/VELORI_PROGRESS.md` with evidence and blockers before the next phase starts.

## Phase execution sheet

| Phase                  | Required spec      | Existing routes/components                                                                        | Intended code changes                                                        | Dependencies / risks                                                                           | Acceptance and verification                                                                                                                    |
| ---------------------- | ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Audit/docs         | Master + `01`–`10` | `routes.tsx`, `views.tsx`, `social-media-pages.tsx`, shell, tokens, auth, settings, admin modules | Documentation and tracker only                                               | Do not infer from stale test artifacts; preserve database and environment                      | Reconcile paths, verify references; record `pnpm verify` and each stage separately; no visual claim without browser evidence.                  |
| 1 — Design system      | `01`               | `index.css`, theme settings, app/admin primitives, motion providers                               | Token/typography/control-state refinements; avoid unrelated class churn      | Runtime theme overrides and dark mode can supersede defaults; duplicate legacy tokens          | Contrast and interaction states in both themes; format/typecheck/build plus focused screenshots at 320/1440.                                   |
| 2 — Shell/nav          | `02`               | `Shell`, `AnimatedOutlet`, admin frame/navigation, route tree                                     | Responsive shell, navigation, safe areas, overlays                           | Auth redirects, fixed nav, lazy route boundaries, duplicate admin route aliases                | Verify public/auth variants, every nav target, direct URL/query/hash, overflow and keyboard at 320/375/430/768/1024/1440.                      |
| 3 — Auth/feed/posts    | `03`               | auth routes, Feed, Explore/Search, PostDetail, CreatePost/PostLibrary                             | Align visitor, feed, post and editor surfaces                                | RLS, feature flags, draft collaboration, media upload and privacy                              | Verify signed-out/authenticated, load/empty/error, post actions, draft/publish, privacy; focused post-editor tests, E2E and screenshots.       |
| 4 — Stories            | `04`               | `/stories`, `/stories/create`, `/stories/archive`, StoryTray, StoryEditorPage                     | Align viewer, tray/archive and creator studio                                | Expiry, audience, signed media, editor export/collaboration                                    | Verify audiences, progression, archive, editor validation/publish and inaccessible media; story-editor tests + viewport screenshots.           |
| 5 — Reels              | `05`               | `/reels`, `/reels/create`, ReelsExperience, ReelStudioPage/editor                                 | Align viewer and studio as separate workflows                                | Current viewer interactions are not visually verified; RLS/media integrity; large editor scope | Swipe/actions/permissions, comments, load-more, missing-media fallback, studio draft/export; reel editor tests + authenticated screenshots.    |
| 6 — Social surfaces    | `06`, `07`         | profile/search/explore, messages, groups, notifications/settings                                  | Align social content, discovery, chat/group/notification states              | Privacy/blocking, group roles, realtime, push support, account visibility                      | Verify real user state and denied state; privacy/security scripts where affected; keyboard/touch/viewport screenshots.                         |
| 7 — Settings/admin/CMS | `08`               | Settings, privacy/notification pages, admin frame/screens, public registry/dispatcher             | Align account settings, console, moderation and public pages                 | RBAC, admin sessions, draft/publish, duplicate routes and destructive actions                  | Verify role-gated routes, settings persistence, CMS publish and aliases; admin/security E2E + screenshots.                                     |
| 8 — Product audit      | `09`, `10`         | All route families and interaction checklist in tracker                                           | Fix cross-product responsive, accessibility, motion, performance regressions | Depends on Phases 1–7; do not mark unchecked routes verified                                   | Full `pnpm verify`, targeted Playwright, UI audit at listed widths, keyboard/reduced motion/contrast, record screenshots and remaining issues. |

## Definition of done

A screen is done only when the relevant specification and acceptance checks pass, existing functionality/permissions remain intact, loading/empty/error/disabled states are handled, responsive and keyboard/touch behavior are checked, and the tracker records evidence. A visual claim requires actual browser inspection. Do not claim the whole product is redesigned after a single route or viewport.
