# VELORI implementation audit

> Historical source audit. Current live migration state and unresolved workflows are tracked in `docs/SUPABASE_MIGRATION_AUDIT.md`.

> Current end-to-end status is consolidated in [the VELORI feature matrix](VELORI_FEATURE_MATRIX.md). The route/status table below is an early snapshot and is superseded by that matrix.

## Blueprint implementation update — Phase 1 in progress

`20261009120000_velori_profile_privacy.sql` follows the platform core migration. It adds a username availability RPC with a server-side reserved-name guard, profile link and account-mode fields, and per-user avatar storage policies. The Settings page now edits those fields, confirms username changes, and supports optimized square avatar upload, crop zoom, rotation, replacement, and removal. Public profile pages and post cards display uploaded profile images and profile links. Existing auth, profile IDs, and social tables are retained.

This code has passed local TypeScript, frontend build, formatting, and eight existing unit tests. The new migration has **not** been applied to Supabase. The live verifier consequently reports `42703` for the new profile columns; the server Edge Function still returns 404, and protected storage/RLS checks remain unverified without deployment credentials. Private accounts remain owner-only until approved follow requests are implemented.

## Blueprint implementation update — Phase 2 in progress

`20261010000000_velori_post_lifecycle.sql` adds public/owner-only post visibility, server-enforced like/comment permissions, like-count hiding, sharing controls, archives, a 30-day trash recovery window, a scheduled database-row purge, RLS-protected drafts and media metadata, and a private media bucket. The app filters archived/trash/private/unpublished posts out of public feed, search, and profile results; post owners can edit post text/settings and manage archive/trash; dedicated `/archive`, `/trash`, and `/drafts` pages support restoration, permanent deletion, and draft resume/delete. The composer has per-account browser recovery, server autosave, and a manual save option. It stages optimized images and validated MP4s under draft ownership, reports upload progress, supports cancellation/retry/removal/reordering/alt text, and publishes media only after RLS-scoped metadata is attached to the post.

Migration `20261031003600_velori_expired_media_storage_cleanup.sql` now has a local implementation for the old cleanup limitation: expired stories and permanently expired trash posts enqueue object paths before row cascades, and a service-token-protected Edge route removes those bytes through the Storage API with retryable failures. The route and hourly workflow remain unverified until deployed and exercised with a real test object.

> Historical audit snapshot. Its live checks and migration coverage are not current verification. Use [the Supabase deployment runbook](../supabase/ADMIN_DEPLOYMENT.md) for the actual migration order, deployment commands, and post-deployment acceptance procedure.

## Social graph prerequisite — in progress

`20261009000000_velori_platform_core.sql` already supplied the relationship and account-safety tables. The new `20261011000000_velori_follow_relationships.sql` extends that existing contract rather than creating a duplicate graph: public-account follows become accepted, private-account follows remain pending, only the profile owner may accept a pending request, and either side can remove a relationship. A privacy-aware count RPC exposes private-account counts only to the owner or an accepted follower. The profile page now supports follow/unfollow/request/cancel, the Settings page links to an incoming-request review page, and post audiences include Followers. Feed, search, profile, and post visibility are backed by database RLS rather than client-side trust.

The migration has not been applied or tested against Supabase. Read-only checks on 2026-10-03 confirm the live project has the original post/profile/comment/like/save tables plus the draft and media tables, but it lacks the `profile_follow_counts` RPC and `follows.updated_at` column required by the current app contract. Multi-account acceptance tests remain required, especially around private-profile reads and follow-request transitions. Typecheck, build, formatting, and the eight existing unit tests pass. The supplied blueprint places Stories next; follow approval is being completed first because private-profile and follower-only story audiences depend on this relationship state. The existing platform-core migration already contains close-friends and story-hide list tables, but no story publishing/viewing backend yet.

`20261012000000_velori_admin_content_management.sql` is also present in the current worktree. Its report, CMS, navigation, feature-flag, announcement, and error-page relations respond on the configured project. Table existence alone does not verify their admin-only policies or migration history; those still require service-role catalog checks and live administrator tests.

## Starting state

The supplied repository was a blank Vite/React scaffold with an empty `App.tsx`. The three files under `src/imports/` were copies of scaffold configuration, not an application. There were no application routes, pages, images, 404 assets, authentication flows, database migrations, storage buckets, or social APIs. A Supabase connection was added during this work; its autogenerated KV helper and health endpoint are not a social data model. No pre-existing VELORI features or user data were replaced.

## Route / feature matrix after this pass

| Route(s)                                                                                   | State                              | Data / access                                                                       |
| ------------------------------------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------- |
| `/`, `/home`, `/feed`                                                                      | Implemented UI; database-dependent | Public posts, cursor pagination, loading/empty/error; RLS migration **not applied** |
| `/explore`                                                                                 | Implemented                        | Navigation and discovery entry points; no invented trends                           |
| `/search`, `/people`, `/hashtags/:tag`                                                     | Implemented UI; database-dependent | Debounced bounded people/post search; indexed hashtags once migration is applied    |
| `/post/:id`                                                                                | Implemented UI; database-dependent | Post detail and first 50 top-level comments; invalid IDs use 404                    |
| `/profile/:username`                                                                       | Implemented UI; database-dependent | Public/self profiles and recent posts; unknown/inaccessible use 404                 |
| `/saved`                                                                                   | Implemented UI; database-dependent | Private saved posts; collection management absent                                   |
| `/create`                                                                                  | Implemented UI; database-dependent | Authenticated text post publishing; no media upload                                 |
| `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/onboarding` | Connected to Supabase Auth         | Email delivery/OTP template and redirects need dashboard configuration and live QA  |
| `/settings`, `/settings/account`, `/settings/appearance`                                   | Partly implemented                 | Local appearance; profile and private-account persistence require migration         |
| `/about`, `/contact`, `/privacy`, `/terms`, `/community-guidelines`, `/safety`, `/cookies` | Implemented informational routes   | Text explicitly distinguishes summaries from complete reviewed legal policies       |
| `/messages`, `/notifications`, `/stories`, `/reels`                                        | Explicitly unavailable             | No fake data or writes; require backend models and authorization                    |
| `/maintenance`                                                                             | Informational illustration         | Supplied maintenance artwork; its progress values are explicitly not live status    |
| Other paths, invalid post/profile                                                          | Branded 404                        | Uses the supplied animated robot SVG, with a static reduced-motion variant          |

No admin, moderation, follow-request, block/mute, push, realtime, video, storage, or multi-device security flows existed. They remain unimplemented rather than being mislabeled as working. Mobile/tablet/desktop styling, dark mode, reduced motion, offline notice and a render-error boundary are provided; visual-device QA has not been run.

## Required activation

1. Apply `supabase/migrations/20261001000000_velori_core.sql` in the connected project's Supabase SQL editor. At audit time the `posts` REST endpoint returned **404 / PGRST205**: the schema is not installed. The migration is supplied but **not deployed or verified against the database**.
2. Configure Supabase Auth site URL and redirect allowlist for the deployed domain and preview origin. Configure a working email delivery provider. If using six-digit signup OTP, set the Confirm signup template to include `{{ .Token }}`; otherwise the standard link email does not supply the code requested by the UI. Supabase owns OTP generation, expiry, replay protection, and rate limits; their project settings and actual delivery were not inspected or tested.
3. Replace the summary legal pages with reviewed policies before production launch. Decide and implement moderation/reporting and data deletion/export before onboarding real users.
4. If a real maintenance event occurs, publish a verified service update separately. The supplied illustration is not a status dashboard and is not used for unexpected application errors.

The app uses only the autogenerated public Supabase key in browser code. Never put a service-role key, SMTP credential, or database password in a `VITE_` environment variable or frontend source. The SQL includes RLS for the core tables, but cross-account RLS tests cannot be run before deployment and test accounts exist.

## Verification boundaries

`pnpm build` and `pnpm exec tsc --noEmit` pass. Build still warns about a large initial JavaScript bundle; route views were split into a lazy chunk, but the remaining router/Supabase dependency chunk is above the 500 kB warning threshold. Direct-navigation HTTP tests could not run: the supervisor's preview server was not reachable from the shell at `127.0.0.1:8443`. Authentication email delivery, data writes, RLS, responsive screenshots and direct browser routing were **not** verified end-to-end.

## Second pass: administrator backend

The first pass shipped the administrator interface but not the server it calls. `supabase/functions/server/index.tsx` registered only `/make-server-86a4973e/health` and an unused autogenerated KV import, so all fourteen `/admin/*` routes in `src/lib/admin-api.ts` and `src/app/admin.tsx` returned 404. `supabase/ADMIN_DEPLOYMENT.md` had described the server as implemented. It is now implemented.

Also corrected in this pass:

- Five malformed inline type annotations in `src/app/views.tsx` and `src/lib/supabase.ts` (missing `;` between type members) that made `tsc --noEmit` fail with syntax errors. The previous verification note claiming typecheck passed was wrong. It passes now.
- Edge Function CORS was `origin: "*"`, which invited any site to drive admin requests with a stolen token. It now validates against the `ALLOWED_ORIGINS` secret.
- The Edge Function declared `SUPABASE_SERVICE_ROLE_KEY` through an unused import; nothing needed the KV table, and the import was removed.
- The first administrator is now minted through a server-side setup code (`ADMIN_SETUP_CODE`) compared with a constant-time check, rather than a commented SQL snippet and a dashboard visit. The code is not in `src/` and cannot be read from the bundle.

Still not verified: the Edge Function has never been deployed or executed. `tsconfig.json` includes only `src` and `vite.config.ts`, so `tsc --noEmit` does not cover it. Run `deno check supabase/functions/server/index.tsx` and the post-deployment checklist in `supabase/ADMIN_DEPLOYMENT.md` before trusting it.

## Third pass: live production audit

This pass tested the running Supabase project directly with its public anon key rather than reading source. Results are recorded in full in `supabase/ADMIN_DEPLOYMENT.md`. The headline: **the deployed system is essentially empty.**

- The core social migration is not applied, so every social feature returns `PGRST205`. The application cannot do anything.
- The administrator migration is **partially** applied: tables and RLS exist, but the `site-assets` bucket does not.
- The Edge Function is not deployed at all, so no administrator route has ever responded.
- Signup is returning `HTTP 429 over_email_send_rate_limit`; no account can be created by anyone until custom SMTP is configured.

What the live checks confirmed as genuinely secure: anonymous writes to `admin_audit_logs`, `admin_login_attempts` and `admin_profiles` are refused with `42501` (including a direct attempt to self-grant `super_admin`); anonymous `UPDATE`/`DELETE` affect zero rows; storage uploads are refused; and `/auth/v1/token` returns an identical response for an unknown address and a wrong password, so accounts cannot be enumerated.

Fixed in this pass, in addition to the earlier work:

- `Access-Control-Allow-Origin: *` was removed. The allowed origin now comes from the `ALLOWED_ORIGINS` secret, and an unset configuration falls back to localhost only rather than opening up.
- **`apikey` was missing from `allowHeaders`.** `src/lib/admin-api.ts` sets it on every request, so every administrator call would have been blocked at CORS preflight even with the routes implemented. This was the single blocking contract defect.
- `auth.getSettings()` was called in the health check but does not exist on the current supabase-js client; it now queries the Auth settings endpoint directly.
- Five malformed inline type annotations in `src/app/views.tsx` and `src/lib/supabase.ts` were breaking `tsc --noEmit`. The earlier verification note claiming typecheck passed was wrong.
- The confirmation page assumed only the `?token_hash=` link shape and reported a working confirmation as a broken link for the stock Supabase template. It now accepts both.
- Maintenance mode blocked `/reset-password` and `/auth/confirm`, which could permanently lock a user out. Authentication routes are now exempt.
- `signOut` discarded its promise, so a failed sign-out showed no error. It now reports failure.
- `contact_email`, `contact_phone` and `website_url` were editable in the admin panel but rendered nowhere; a null in the database also silently overwrote the compiled-in defaults. Both are fixed and the public pages now use them.
- A dead Notifications button in the admin header was removed, and administrators can now be granted, demoted and revoked from the Users panel, which is what makes the last-super-administrator guard reachable.

A fifth migration, `20261005000000_animated_error_pages.sql`, and the matching frontend and Edge Function changes appeared in the workspace during this pass and were not authored here. The feature was left incomplete — `defaultSiteSettings` did not satisfy the widened `SiteSettings` type, so the project did not typecheck. That was completed; the migration itself is not applied.

## Second hardening pass — 2026-10-02

Six defects were found by re-reading the live contract rather than the source, and all six are fixed here.

### Bootstrap was never atomic

`public.admin_bootstrap_available()` took a transaction-scoped advisory lock, counted administrators, and returned. That lock is released when the RPC's transaction commits — which is _before_ the Edge Function's separate `auth.admin.createUser()` HTTP call and its `admin_profiles` insert. Two simultaneous first-time-setup submissions could both observe "no administrator exists" and both mint a super administrator from a one-time code.

`supabase/migrations/20261007000000_veloryz_admin_bootstrap_claim.sql` replaces the check with a durable singleton claim row. `insert … on conflict do nothing` is atomic on its own, so exactly one concurrent caller wins. A failed attempt releases the claim so the operator can retry; a successful one finalises it against the new administrator's id.

### The access code could not be changed

The code existed only as the `ADMIN_SETUP_CODE` environment secret, so the initial value stayed live until someone deleted the secret and redeployed, and there was no way to retire it from inside the product.

The same migration adds `public.admin_access_code`, storing only `pbkdf2$<iterations>$<salt>$<hash>` derived in the Edge Function with WebCrypto at 210,000 iterations. New routes `GET /admin/access-code` and `PUT /admin/access-code` (both behind `requireAdmin`) let an administrator rotate or disable it from Admin → Security. Storing a new hash is what invalidates the previous code. Rotations are throttled to five per administrator per hour so a stolen session cannot lock the operator out, and the plaintext is never returned, logged, or written to an audit row.

### The setup code had no brute-force budget

The bootstrap route validated the code with a constant-time compare but recorded no attempts. The code is deliberately short enough to type on a phone, which makes it the most guessable secret in the system. It now gets eight failures per address per thirty minutes, counted in the same indexed table the login throttle uses under a namespaced hash so the two budgets cannot interfere.

### The root error boundary could itself blank the screen

`RootRenderErrorBoundary` renders `<ErrorPage>`, and `ErrorPage` calls `useSiteSettings()`. That boundary sits _outside_ `SiteSettingsProvider`, so if the provider was the thing that threw, the fallback threw too and there was no boundary left above it to catch that — producing a blank white page, the exact failure the boundary exists to prevent. It also pulled in assets and stylesheet classes, so it failed again whenever the network was the problem.

It now renders `FatalErrorPage`: no context, no hooks beyond React's own, and inline styles so it still renders when the stylesheet chunk never loaded.

### Source encoding corruption

`src/app/admin.tsx` and `src/app/views.tsx` contained UTF-8 read as CP1252, several layers deep. Visible strings were garbage: `Authenticatingâ€¦`, `VELORI Studios Ãâ€ ·Restricted system`. Repaired with a decoder that only rewrites character runs which decode back to complete, valid UTF-8, so genuine punctuation elsewhere in the files is provably untouched.

### Four unreferenced duplicate assets

`Scene-1.mp4`, `Velori_Gradient_Wing_Logo-1.png`, `maintainance_gtp_page.png` and `Error_404.svg` were byte-identical to siblings that are actually imported, and nothing referenced them. Removing them freed 2,499 KB. `src` assets went from 5.27 MB to 2.83 MB.

### Also in this pass

- Added `src/app/views.tsx` → `HelpCenter`, a searchable, category-filtered help page with twenty answers that describe only behaviour that actually exists, routed at `/help` and linked from the footer.
- Routed `/groups` to the honest `PendingFeature` page. It previously fell through to the 404, which implied groups existed and merely broke, rather than not existing.
- Added port 3000 to the Edge Function development-origin allowlist alongside 8443, so a `PORT` override in `vite.config.ts` does not silently break every administrator request.

## Third hardening pass — 2026-10-02

### Local fixes and evidence

- A clean `pnpm install --frozen-lockfile` completed with the declared pnpm 10.34.3 and the single `pnpm-lock.yaml`.
- Access-code rotation had a repository bug: PBKDF2 hashes were generated with an extra `$`, while verification expected four fields. Hashing/verification now live in `supabase/functions/server/access-code.mjs`; tests cover valid hashes, replacement, disabled/rotated-code precedence, malformed hashes, and fixed-time string comparison.
- A rotated database code now overrides the bootstrap environment secret immediately, including when deliberately disabled. The server secret is still required for first bootstrap; it was not added to source or browser configuration.
- Appearance now supports Light, Dark, and System, initializes before first paint, follows OS changes with a cleaned-up listener, and has a Settings control to clear only the saved appearance choice. The storage page states that optional analytics/advertising storage is not used.
- Direct requests to `/`, `/home`, and a nested unknown path against Vite preview returned the SPA shell (`200`). This checks host fallback only; it does not execute React routes.
- The source/build scan found no initial setup-code value `200814` and no `SUPABASE_SERVICE_ROLE_KEY` in compiled JavaScript.

### Verification limits

- **PASS:** clean frozen pnpm install, production build, frontend TypeScript check, five Node access-code tests, and the Vite preview SPA-shell smoke check.
- **FAIL:** `pnpm format:check` reports eight source files that are not formatted. The configured formatter has previously corrupted inline TypeScript type literals, so no write-mode format pass was run.
- **BLOCKED:** this environment has no Deno, Supabase CLI, PostgreSQL CLI, admin session, service-role key, or SMTP dashboard access. The Supabase project state, Edge Function typecheck/deployment, migrations, auth/email delivery, RLS, storage writes, administrator flows, and in-browser animation playback were not reverified in this pass.
- Vite preview is not a browser QA environment. No mobile screenshots, keyboard walkthrough, runtime-console audit, or actual email delivery test was available.

## Fourth pass: real-browser verification — 2026-10-02

This pass closes the verification gaps left by the third pass. A headless Chromium
harness now exercises the app the way a user does, against the **production bundle**
served with SPA fallback, not just against the dev server.

### Toolchain gaps from the previous pass are now closed

- The previous `format:check` failure was the formatter itself. oxfmt 0.2.0 silently
  stripped the `;` separator between members of inline TypeScript type literals and
  walked `node_modules` when given no path. Upgraded to 0.71.0, which is the normal
  write path again; `pnpm format` and `pnpm format:check` both pass and are idempotent.
- Deno 2.9.7 and the Supabase CLI are present, so `deno check
supabase/functions/server/index.tsx` and `deno test` now run and exit 0.

### Every route renders, in dev and in production

- 37 routes exercised in Chromium, in both the dev server and the built `dist`
  bundle served over static SPA fallback.
- **0 uncaught JavaScript exceptions and 0 blank renders on all 37 routes**, in both
  modes. Every route exposes real, non-empty content and an `<h1>`.
- Unknown paths return the app shell and render the not-found view
  (`/this-route-does-not-exist`, `/deep/path/that/does/not/exist`).
- Routes that need data do not fake success. `/profile/someone` renders an explicit
  failure state naming the actual PostgREST code, so the missing migration is
  diagnosable in the UI instead of silently showing an empty profile.
- `/post/abc` renders not-found without issuing a doomed query, rather than firing a
  request that can only fail.

### The duplicated settings request is a dev-only artifact, not a defect

- The dev server issued the `site_settings` read **twice per route**; the production
  bundle issues it **once**. The read lives in a single `useEffect` with `[]`
  dependencies in `src/lib/site-settings.tsx`, so the duplicate is React 18
  `StrictMode` double-mounting the effect in development. No production fix is needed
  and none was applied.
- The same loader already degrades correctly: on a `42703`/`PGRST204` it retries with a
  legacy column list, and on any other failure it keeps compiled defaults so a missing
  migration or a Supabase outage cannot break the router.

### Interaction behavior verified

22/22 checks pass against the production bundle.

- Empty submit on `/login` is blocked with a visible message; an invalid email is
  rejected and the user stays on `/login`.
- Signup gating is enforced client-side before any network call. A weak password, and
  a password/confirm mismatch, each produce **zero** requests to `/auth/v1/`; a fully
  valid form reaches the auth layer.
- Password policy is `>= 12` characters, at least one letter, and at least one
  number or symbol, enforced in `src/lib/auth-input.mjs` and shared by signup and
  reset-password.
- Appearance controls genuinely work end to end: choosing Dark sets
  `data-theme="dark"`, repaints the page (`body` background becomes
  `rgb(16, 23, 38)`), persists to `velori-theme`, and survives a reload.
- `/admin/dashboard` is guarded when unauthenticated and leaks no metrics.
- No horizontal overflow at a 390 px viewport; content still renders under
  `prefers-reduced-motion: reduce`; no JavaScript errors across six core routes.

### Security scan

- No `dangerouslySetInnerHTML`, no `innerHTML` assignment, no `eval`/`new Function`,
  no `document.write` — no injection sink.
- Both `target="_blank"` links carry `rel="noopener noreferrer"`.
- No access or refresh token is written to `localStorage`/`sessionStorage`.
- No `console.log`/`console.debug` left in source.
- The only secret-shaped string in the browser configuration is the **anon** key
  (JWT `role: anon`), which is designed to be public. The service-role key and
  `ADMIN_SETUP_CODE` appear in no client artifact.
- The `http://localhost` strings in the built bundle are third-party sentinels
  (React Router's `createURL` base and gotrue-js 2.117.2's default auth URL), never
  fetched because an explicit project URL is supplied. There is no mixed content.
- `autoComplete="off"` appears only on the one-time administrator setup-code field,
  where suppressing password-manager autofill is correct.

### Accessibility

9/9 checks pass across seven routes: every image has `alt`, every button has an
accessible name, every form control is labelled, each route has exactly one `<h1>`,
no heading levels are skipped, no duplicate element `id`s, every route exposes a
landmark region, Tab reaches interactive controls, and the focused element shows a
visible focus ring.

### Bundle note (informational, not a defect)

The `error-404` chunk is 331 kB and contains its own copy of the Supabase client,
because it is split away from the main entry. The main entry chunk is 236 kB
(74 kB gzipped), which is reasonable. Sharing one client instance across chunks would
trim the 404 payload but is an optimization, not a correctness or security issue.

### Test-runner scoping

Running bare `deno test` from the repository root fails with `TS5101`, because it
also discovers `src/lib/auth-input.test.mjs` — a Node test that `pnpm test` already
runs — and type-checks it against the root `tsconfig.json`, whose `baseUrl` option
TypeScript 6.0 deprecates. This is a test-runner scoping problem, not a source defect,
and `--no-check` would only hide it. A `test:edge` script now runs
`deno test supabase/functions/`, which executes the 5 Edge Function access-code tests
and exits 0. The documented Deno command is therefore the scoped one.

### LAN reachability

- The dev server binds `0.0.0.0` on `PORT || 8443` with `strictPort`, and is reachable
  at both `http://127.0.0.1:8443/home` and `http://192.168.29.47:8443/home` (`200`).
- The production bundle served with SPA fallback is likewise reachable on loopback and
  LAN on port 4173 (`200`).
- Port 3000 is not bound in the default configuration; the CORS allowance for it only
  matters when `PORT` is overridden, and is kept for that reason.

### Final regression state

| Command                                          | Result                          |
| ------------------------------------------------ | ------------------------------- |
| `pnpm install --frozen-lockfile`                 | exit 0                          |
| `pnpm format:check`                              | exit 0, 24 files                |
| `pnpm typecheck`                                 | exit 0                          |
| `pnpm test`                                      | 8 passed, 0 failed              |
| `pnpm test:edge`                                 | 5 passed, 0 failed              |
| `pnpm build`                                     | exit 0                          |
| `pnpm verify`                                    | exit 0                          |
| `deno check supabase/functions/server/index.tsx` | exit 0                          |
| Production bundle secret scan                    | 0 hits                          |
| Browser route sweep (dev and production)         | 37/37 render, 0 uncaught errors |
| Interaction suite                                | 22/22                           |
| Accessibility suite                              | 9/9                             |

## Fifth pass: completing the administrator console — 2026-10-03

The previous passes kept improving the administrator _interface_ while leaving half of it unreachable. This pass found and closed the gap.

### The console existed and nothing could open it

`src/app/admin-console/` held a complete, permission-aware console: a shared frame, session provider, widget library, and twenty-four screens covering users, moderation, CMS, navigation, branding, motion, theme, error pages, platform settings, feature flags, announcements, notifications, ads, email templates, administrators, roles, sessions, provisioning, the audit log and system health. **No file in the repository imported it.** `src/app/routes.tsx` sent every `/admin/*` path to a separate 2,741-line monolith, `src/app/admin.tsx`, whose own screens were partly stubs — `AdminErrorPages` rendered the fixed sentence "this deployment currently uses the default page configuration" instead of the editor sitting unused in the same file.

The result was that eleven screens in the new console, eleven client functions in `src/lib/admin-api.ts`, and roughly forty Edge Function routes had no reachable UI at all. `/admin/users`, `/admin/settings`, `/admin/platform`, `/admin/emails`, `/admin/admins`, `/admin/roles`, `/admin/sessions`, `/admin/audit`, `/admin/animations`, `/admin/routes` and `/admin/announcements` did not exist as routes.

### The console is now the only admin surface

`/admin` is the console layout with one lazy route per screen, so each screen is still its own chunk and an operator who opens the dashboard does not download the motion studio. `/admin/login` and the unregistered-path guard stay outside that layout, because they are the two screens that must render before an administrator session exists; they moved to `src/app/admin-auth.tsx`. `src/app/admin.tsx` is deleted.

### Three defects inside the console, all of which would have surfaced on first load

- **`screens/platform.tsx` would have thrown on six screens.** All six exported screens call `useScreenReauth()`, which reads a context that only `ConsoleScreen` provides, and the file imported `ConsoleScreen` without ever rendering it. Every one of Platform, Feature flags, Announcements, Notifications, Advertisements and Email templates would have raised `useScreenReauth must be used inside a ConsoleScreen`. Each is now a thin wrapper around its body.
- **`SiteSettingsBody` was complete and unreachable**, so `/admin/settings` had no screen even though the sidebar linked to it. It is exported now.
- **The error-page editor was unreachable and the motion studio was rendered twice.** `ErrorPagesScreen` rendered a second copy of `MotionCmsEditor` — which `AnimationsBody` already embeds — while `ErrorPagesBody`, the actual per-code editor, was dead. `/admin/error-pages` now renders `ErrorPagesBody` behind `errorpages.view`, and the motion studio is its own `/admin/motion` screen behind `motion.read`. A role can hold the animation permissions without holding the design ones, so merging them hid the editor behind the wrong permission.

Also removed: a stray `export { AreaField }` in `governance.tsx` that re-exported an import no file consumed, and two `Â·` sequences in `appearance.tsx` — UTF-8 read as CP1252, the same corruption class the second pass repaired elsewhere.

### Reels and stories could not be moderated at all

Migration 200 registered `reels.view/hide/delete/restore` and `stories.view/hide/delete`, and `supabase/functions/server/admin-social.ts` implements the endpoints, but no client code called them: `src/lib/admin-api.ts` had no reel or story function and the console had no screen. `docs/SUPABASE_MIGRATION_AUDIT.md` recorded this as an open finding ("Admin Reels/Stories currently lack permission-checked moderation endpoints"), which is no longer accurate.

`src/app/admin-console/screens/social.tsx` adds both queues, and `admin-api.ts` gains the four functions and the moderation-state type they share.

**The server had one unreachable state.** `permissionFor("story", "clean")` returned `stories.restore`, which migration 200 never inserts into `admin_permissions` and no role is ever granted. Restoring a story would have returned 403 to every administrator forever. A story restore is now authorised by `stories.hide`, the same permission that hides one and the same soft-action rule the handler already applied to `restricted`. `reels.restore` exists and is used for reels.

### Four server capabilities had no console surface

`src/lib/admin-api.ts` exported functions nothing called. Each now has a caller:

| Function                | Where it is used now                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `adminSearch`           | Console search in the top bar, debounced 250 ms, gated on `users.view` to match the route                           |
| `adminUserProfile`      | Profile override in the user detail dialog, gated on `users.edit`, sending only the seven fields the server accepts |
| `adminDeleteComment`    | Delete in the comment moderation dialog, gated on `comments.delete`                                                 |
| `adminChangeAccessCode` | New Security screen: access-code state, rotation and disabling                                                      |

The Security screen also reports the current administrator's session, expiry and last password confirmation, and revokes other console sessions. The sidebar never linked to it; the access code was previously only reachable from a panel in the monolith.

### Client permission type was narrower than the server

`AdminPermission` listed forty-three keys and omitted `audit.view`, `motion.read`, `motion.write`, `motion.publish` and the six reel/story keys — every one of which the Edge Function checks. `admin-ui` also gated the Reels and Stories nav entries on `system.view` rather than the permissions that actually govern them.

### One endpoint is still without a console surface, deliberately

`POST /admin/assets` uploads to `site-assets` under a generated key and returns a URL. It records no asset version and activates nothing, so an object uploaded through it is never used by the public shell. The console uploads through `POST /branding` and `POST /motion`, which version the previous file and activate the new one. The endpoint is left in place because removing a deployed route is a separate, contract-level decision; it is not called by any client.

### Verification

`pnpm format`, `pnpm typecheck`, `pnpm test` (8), `pnpm build` and `deno check supabase/functions/server/index.tsx` all exit 0. Two new CSS classes the console already referenced (`admin-form-grid`, `admin-row`) had no rule at all and are defined, along with the search panel. No route was exercised in a browser in this pass: the server still requires deployment and non-production administrator credentials, so every screen was verified by reading it against the Edge Function route that serves it, not by a signed-in request.
