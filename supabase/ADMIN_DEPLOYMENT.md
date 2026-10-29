# VELORI Supabase deployment runbook

This is the operational source of truth for deploying this repository. It replaces earlier audit checklists that described a different function slug or incomplete migration inventory. No privileged values belong in this file, frontend source, build output, or chat.

## Target project

### Current live state

- The linked project is `mvvjyxfojxyuwsykfujf` (organization `lmyflfqmuoehqdrsplsu`). The local browser configuration points at this project.
- All 112 local migration versions are recorded on the project; `supabase migration list` showed no local/remote mismatch. The read-only schema probe returns zero failures. A clean empty-database replay was not run.
- `server`, `velori-environment`, and `velori-studio` are deployed and report `ACTIVE`. The live `server` verifier passed, and the environment endpoint denied anonymous access with HTTP 401.
- The administrator account was initialized. A real login, authenticated `/admin/me`, logout/revocation, and anonymous `/admin/me` denial (HTTP 401) were verified.
- The requested production secret names are configured. One-time `ADMIN_SETUP_CODE` and `VELORI_ADMIN_INITIAL_PASSWORD` were removed remotely after initialization; the local one-time setup code was removed. The initial admin password remains only in ignored `.env.secrets.local` for the owner to retrieve.
- No Gemini API key/model was supplied. Studio and generation remain disabled, and the live Studio status endpoint confirms generation is unavailable. Configure `GEMINI_API_KEY` and `VELORI_GEMINI_MODEL` before enabling generation. `reel-export` was not part of this deployment.
- The production frontend build, TypeScript check, full Node test suite, live schema probe, and live Supabase verifier passed in this setup pass. The CLI warned that Docker is not running, but function deployment used the Supabase API successfully.

The older dated deployment notes below are historical snapshots; the current live-state report above supersedes their target and migration counts.

## Current repository state (2026-10-05)

The local migration directory contains 66 versions through `20261031003700`. A fresh read-only query on 2026-10-05 confirms 61 applied versions through `20261031003300`. Local migration `20261014000100` is also absent from the ledger, though its public theme read policy, grants, and Realtime publication are present in the live catalog; migrations `03400`–`03700` are pending. They add CMS draft/publish isolation, social-media read privacy, queued expired-media Storage cleanup, and transactional notification-campaign delivery. The inventory and deployment results below are a historical 2026-10-04 snapshot; use `docs/SUPABASE_MIGRATION_AUDIT.md`, `docs/VELORI_FEATURE_MATRIX.md`, and the live migration ledger for current status.

The browser client and server target are supplied by `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; no remote project is hard-coded. Copy `.env.example` to `.env.local` for local use. The publishable key is public and is not an administrative credential.

Security note: a previous version of `.env.example` contained privileged deployment values. They have been removed. Treat the exposed Supabase access token, database password, legacy service-role key, and bootstrap code as compromised; revoke or rotate them in Supabase/CI before production use. Do not reuse or copy them.

Latest deployment and verification report (2026-10-04; migration ledger rechecked in this session):

- **PASS:** All 39 repository migrations are recorded on the linked project through `20261031000500`. The group-moderation metadata migration and social RLS-helper permission repair were applied in timestamp order and verified against the live catalog.
- **PASS:** The read-only schema probe returns zero failures, including authenticated-only execution for the four conversation/group RLS helpers.
- **PASS:** All six authenticated main-site Playwright tests pass. The route sweep covers 11 signed-in routes, including `/messages` and `/groups`, with no 4xx responses or uncaught exceptions.
- **FOLLOW-UP:** A broader Playwright run also found an unrelated admin-audit render error on `/admin/feature-flags` (`map is not a function`) and an aborted `/admin/motion` navigation. These are outside the social route repair and remain to be investigated.
- **PASS:** `admin_sessions.session_token_hash` is present. The new password-change RPC is present, executable by `service_role`, and not executable by `anon` or `authenticated`.
- **PASS:** The `server` Edge Function was deployed and reports `configured=true` and `originsConfigured=true`. The live verifier passed public/protected relation, RLS-denial, storage, RPC, and CORS checks, including anonymous denial for the password-change RPC.
- **PASS:** The local `/admin/login` browser route renders the username/password form and is reachable. Empty-login validation returns HTTP 400; unauthenticated `/admin/me` returns HTTP 401.
- **PASS:** TypeScript, frontend formatting, all 48 Node tests, and the Vite production build pass. The Edge Function files pass TypeScript syntax transpilation.
- **PASS:** Deno type-check and lint now run in this workspace (Deno 2.9.7). `deno check supabase/functions/server/index.tsx` and `deno lint supabase/functions/server/index.tsx` both exit 0. An earlier revision of this file recorded them as unavailable.
- **NOT TESTED:** A successful login or password change with a dedicated non-production admin account, authenticated multi-account RLS, email delivery, or destructive administrator actions. Do not use the production administrator credentials for acceptance testing.
- **NOT RUN:** An empty-database migration replay. Docker/Podman are still unavailable, so a clean-state replay cannot be proven here; the catalog assertion below substitutes for it and the limitation is stated rather than papered over. Do not substitute `db reset --linked` against production.

### Catalog assertion without Docker

The plpgsql gate `scripts/validate-velori-schema.sql` raises exceptions and is therefore refused by the read-only classifier in `scripts/lib/guards.mjs` (a `do` block can run anything). Where a Management API token is available but `psql`/Docker/Supabase CLI are not, run the read-only twin instead:

```
node scripts/db-query.mjs --file scripts/validate-velori-schema.probe.sql
```

Both files assert the same catalog contract: required relations and columns, RLS enabled, key policies, indexes, triggers, definer `search_path`, RPC execute grants, storage buckets and policies, the post purge cron job, and the motion publication contract. Zero rows means the catalog matches; any row names the broken rule. Both gates were executed against the configured project on 2026-10-03 and returned zero failures. Their assertions must be kept in step; a rule present in one file and not the other is a drift bug in the gate itself.

The verifier includes motion-CMS table and RPC checks, public reel/story read checks, local Vite CORS regression checks, and admin-session rejection checks. Live schema validation does not prove every migration replays cleanly from an empty database.

### Live RLS repair (2026-10-03)

The linked project's missing social-reader migrations were repaired; the recorded migration history now matches local through `20261030000200`. Anonymous reel and story queries return HTTP 200. The signed-in Home layout puts the live story tray first and removes the marketing hero and ad slot from that feed; signed-out visitors retain the landing hero. Authenticated ordinary-user journeys still need a non-production test account. Earlier admin browser checks are historical evidence and were not repeated with a production account in this pass. A clean local migration reset remains unavailable because Docker and Podman are not installed; never replace it with `db reset --linked`.

### Animation library and motion invalidation (2026-10-03)

`20261030000200_velori_animation_library_presets.sql` is not a duplicate of migration 31. Migration 31 adds the media columns and creates `motion_publication_events`; migration 33 seeds the two library slots (`startup_intro`, `error_artwork`) that have no other insert anywhere in the chain. Both keys are present in the live catalog and both files are applied, so neither may be edited or removed. Verified live: `motion_publication_events` has RLS enabled, `anon`/`authenticated` SELECT only with writes held by `service_role`, and is listed in `pg_publication_tables` for `supabase_realtime`; `animation_configs` carries `media_url`, `media_mime_type`, `media_byte_size` and the 10 MiB `animation_configs_media_byte_size_check` ceiling, which a deliberately oversized write was rejected by with SQLSTATE 23514. `scripts/verify-supabase.mjs` now asserts all of this on every run.

## Migration inventory and dependency order

There are thirty-nine migrations in the repository. They are applied in timestamp order, and the workflow tests the full chain against a clean local Supabase database. All 39 versions are recorded on the linked project:

1. `20261001000000_velori_core.sql` creates profiles, posts, likes, saves, comments, hashtag indexing, and their RLS policies.
2. `20261002000000_veloryz_admin.sql` creates the admin role, admin/settings/audit/login tables and public-read-only `site-assets` bucket policies. It depends on the Auth schema and Supabase Storage schema.
3. `20261003000000_veloryz_admin_backend.sql` creates service-role-only SECURITY DEFINER admin reporting functions. It depends on migration 020.
4. `20261004000000_veloryz_admin_repair.sql` ensures the storage bucket/policy, adds the last-super-admin trigger and the earlier bootstrap availability function. It depends on migration 020 and is safe to reapply.
5. `20261005000000_animated_error_pages.sql` adds the `site_settings.error_404_enabled` flag, initially false. It depends on migration 020.
6. `20261006000000_admin_animation_assets.sql` adds startup/error animation URLs, changes the 404 default to true, enables it for existing settings rows, and expands the existing bucket's allowed types/size. It depends on migrations 020 and 050.
7. `20261007000000_veloryz_admin_bootstrap_claim.sql` adds the serialized bootstrap claim and salted access-code storage/functions, replacing the earlier check-only bootstrap flow. It depends on migrations 020 and 040.
8. `20261008000000_velori_backend_contract_repair.sql` reasserts the core social tables/policies, animation settings, private bootstrap relations, admin RPCs/grants, admin read policies, last-super-admin trigger, and `site-assets` bucket. It fails unless the tables, columns, RLS, bucket, RPC privileges, policies, and trigger are present.
9. `20261009000000_velori_platform_core.sql` adds account modes/settings, reserved usernames, the follow graph, blocks/mutes/restrictions, hidden authors, story hides, close friends, and shared viewer visibility rules. It depends on the core social schema.
10. `20261009120000_velori_profile_privacy.sql` adds profile links/account mode fields, protected username changes and reserved-name checks, and an avatar bucket scoped to the authenticated user's own folder.
11. `20261010000000_velori_post_lifecycle.sql` adds public/owner-only audiences, interaction controls, archived/trash state with a 30-day recovery deadline and scheduled database-row purge, RLS-protected drafts and post-media relations, and a private media bucket with object access inherited from each post's RLS visibility. The SQL cron job does not delete Storage blobs; a privileged Storage API cleanup worker is still required for automatic expiry cleanup.
12. `20261011000000_velori_follow_relationships.sql` tightens the existing follow graph for owner-approved private-profile requests, adds followers-only post audiences, signed-in profile discovery that respects blocks, a guarded acceptance transition, and a privacy-aware follow-count RPC. It depends on migrations 090, 0912, and 100.
13. `20261012000000_velori_admin_content_management.sql` adds RLS-protected reports, CMS pages and versions, navigation, feature flags, announcements, and error-page configuration, with admin-only write access and safe defaults. It depends on the admin and core social tables.
14. `20261013000000_velori_admin_rbac.sql` adds the administrator role/permission registry, session ledger, audit-log reason/result fields, role-resolution RPCs, and narrowly scoped public reads for active feature flags, visible navigation, live announcements, and published CMS pages. It depends on the admin and migration-120 content tables.
15. `20261014000000_velori_admin_console.sql` adds branding version history, animation and theme configuration, advertisements, targeted notifications and receipts, platform settings, email-template metadata, and the route registry. Animation durations allow up to 30 seconds so the seeded background/hero cycles (18 and 14 seconds) pass their own constraint. It depends on the admin and core social tables.
16. `20261015000000_velori_social_product_infra.sql` adds persisted reels, stories, their media/interaction rows, and user notifications. It depends on the profile, follow, close-friend, and account-settings tables from migrations 090 and 110. Its table-level row policies are further restricted by migration 160.
17. `20261016000000_velori_navigation_scope_and_social_rls.sql` separates public/admin navigation and repairs social visibility policies for reels, stories, child media/replies, and notifications. It adds database-generated notifications for supported social events. It depends on migrations 120, 130, 150, and the close-friends/follow graph from 090/110.
18. `20261017000000_velori_public_ad_read_policy.sql` restores the narrow public read grant for active, untargeted advertisements while keeping campaign management and writes server/admin-only. It depends on migrations 140 and 130.
19. `20261018000000_velori_motion_experience_cms.sql` creates the approved motion preset registry, draft/published configuration, immutable snapshots, public-safe configuration RPC, and motion permissions. It imports existing error-page content into the initial version. It depends on migrations 120, 130, and 140.
20. `20261019000000_velori_messaging_and_groups.sql` adds conversations, direct and group messaging, participants, attachments, group membership/settings, authorization helpers, and notification integration. It uses existing profiles, follows, blocks, and notifications.
21. `20261020000000_velori_ad_events_and_reel_story_moderation.sql` adds persisted ad event metrics and server-only recording, reels/stories moderation permissions/state, and scheduled story-expiry cleanup. It depends on the ads, reels/stories, and admin RBAC schema.
22. `20261021000000_velori_rls_repair.sql` restores audience-aware story reads and public/follower reel reads while retaining moderation checks. It depends on the follows and reels/stories tables.
23. `20261022000000_velori_public_social_reader_rls.sql` removes the obsolete combined-role reel reader policy that caused anonymous reads to require direct `follows` table privileges. It depends on migrations 200 and 210.
24. `20261023000000_velori_story_reader_rls_repair.sql` removes migration 160's separately named combined-role story policy, which also made anonymous story reads require direct access to `follows`. It depends on migrations 160 and 210.
25. `20261024000000_velori_story_reel_media_repair.sql` restores the story reader contract and makes story/reel uploads private, owner-scoped Storage objects.
26. `20261025000000_veloryz_admin_accounts.sql` adds the dedicated administrator username/password credential registry with PBKDF2 password hashes, account lockout state, and separate admin session support.
27. `20261026000000_velori_messaging_realtime.sql` adds conversation-scoped message publication to Supabase Realtime; participant RLS remains the row filter.
28. `20261027000000_velori_group_creation_and_chat.sql` links group records to chat conversations and routes membership changes through authorized database functions.
29. `20261028000000_velori_notification_realtime.sql` publishes notifications through Supabase Realtime with recipient-scoped RLS.
30. `20261029000000_velori_admin_session_tokens.sql` stores only SHA-256 digests of opaque admin session tokens and invalidates legacy email-login sessions.
31. `20261030000000_velori_page_experience_runtime.sql` adds uploaded animation media metadata and a public, realtime-safe motion publication version event. It depends on the migration-140 animation configuration and migration-180 motion configuration.
32. `20261030000100_velori_admin_atomic_password_change.sql` changes an admin password and revokes all active sessions in one service-role-only transaction, preventing partial credential changes from leaving sessions valid. It depends on the administrator accounts, profiles, and session tables from migrations 130 and 250/290.
33. `20261030000200_velori_animation_library_presets.sql` seeds the `startup_intro` and `error_artwork` rows in `animation_configs`, giving the visual animation library two stable named upload targets that exist independently of any route assignment. It depends on migration 140's `animation_configs` and is additive; no other file inserts these keys.
34. `20261031000000_velori_site_settings_realtime.sql` publishes the public `site_settings` row to Supabase Realtime so branding, maintenance, homepage announcements, and legacy animation settings invalidate in other open tabs without a reload. It depends on the existing `site_settings` relation and the `supabase_realtime` publication.
35. `20261031000100_velori_site_settings_write_lockdown.sql` removes browser write privileges on `site_settings` while retaining public reads; administrator writes remain server-side through the service-role Edge Function. It depends on the public settings relation and the publication configured by migration 34.
36. `20261031000200_velori_motion_configuration_restore.sql` restores the missing published motion-configuration singleton from the newest immutable snapshot, or seeds the validated built-in defaults when no snapshot exists. It also synchronizes the public Realtime publication version. It is idempotent and depends on the motion configuration, version, and publication-event relations from migrations 180 and 310.
37. `20261031000300_velori_profile_provisioning.sql` creates and backfills public profiles for real Auth signups while excluding administrator identities, so new members can use the social schema. It depends on the core profiles and reserved-username relations.
38. `20261031000400_velori_admin_group_moderation.sql` adds audited metadata and permission catalog entries for administrators to lock groups without exposing group posts or chat messages. It depends on the group and admin permission relations.
39. `20261031000500_velori_social_rls_helper_grants.sql` grants only authenticated users the execute rights needed by conversation/group RLS policies, keeps anonymous execution denied, and binds the viewer arguments to `auth.uid()` to prevent cross-user membership probes.

The Motion & Experience CMS is served through permission-checked Edge Function routes under `/admin/design/motion`; public clients can call only `get_published_motion_config()`. The live verifier confirms the migration-180 relations and public RPC response shape. Public clients fall back to built-in settings and revalidate the published configuration every two minutes. A read-only live check confirmed the singleton, newest immutable snapshot, and RPC response are all present at version 1 and match. Migration 36 is an idempotent restore guard for a future missing-row state; it is pending but is not needed to repair the currently observed project. Admin publish and cross-tab Realtime delivery still require an authorized non-production administrator account for end-to-end acceptance.

### Automated deployment

`.github/workflows/supabase-backend.yml` runs on backend changes to `main` and supports manual dispatch. It runs Deno check/lint, starts local Supabase and resets the database to apply every migration, then links to the project selected by `SUPABASE_PROJECT_REF`, pushes pending migrations, deploys the `server` Edge Function, and runs live contract and CORS checks. A concurrency group prevents simultaneous migration pushes. Never use `supabase db reset --linked` against production.

Configure these GitHub Actions repository variables and secrets before a deploy can succeed:

- Variables: `SUPABASE_PROJECT_REF`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `VELORI_SUPABASE_SECRET_KEY` (use a current Supabase secret API key, not the exposed legacy service-role key)
- `VELORI_ALLOWED_ORIGINS` (comma-separated exact HTTPS origins, no wildcard or path)
- VELORI_ADMIN_SETUP_CODE (one-time setup code; keep server-side)

The workflow verifies that the frontend, CLI configuration and Edge Function target the same project. It stages function secrets in a permission-restricted temporary file, sends them to Supabase and removes the file without printing values. Rotate the exposed legacy service-role key to a new Supabase secret API key and store the new value as VELORI_SUPABASE_SECRET_KEY in GitHub Actions; remove the old GitHub secret after the new deployment succeeds. Keep admin usernames and passwords out of GitHub Actions. Publish the one-time initial password from local protected configuration only when VELORI_PUBLISH_INITIAL_ADMIN_PASSWORD=true is set, then remove that opt-in and unset the remote password secret after initialization.

Manual deployment from a trusted machine uses the pinned Supabase CLI version in the workflow. Set `SUPABASE_PROJECT_REF`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VELORI_SUPABASE_SECRET_KEY`, and `VELORI_ALLOWED_ORIGINS` in the shell without echoing them, then run:

```powershell
supabase link --project-ref $env:SUPABASE_PROJECT_REF
supabase migration list --linked
supabase db push --linked --include-all --yes
node scripts/publish-supabase-secrets.mjs
supabase functions deploy server --project-ref $env:SUPABASE_PROJECT_REF
node scripts/verify-supabase.mjs
```

`--include-all` handles missing entries in the old migration history. Migrations 010 and 020 are safe to rerun over the observed partial schema, and migration 080 repairs objects missing even if an older version was recorded as applied. If required columns or security properties remain inconsistent, the repair migration fails instead of reporting a successful deployment.

The linked migration history is checked read-only during each deployment. Migration 39 was applied after migration 38 so the remote version ledger remains in timestamp order. The social contract probe checks both the authenticated execute grants needed by RLS and the denial of those helpers to anonymous users. This does not make every earlier migration universally safe to replay; 010/020 guard objects they own and 080 reasserts core/admin function contracts. Do not manually mark migrations applied without checking their objects.

The migrations use built-in Supabase roles/schemas (`anon`, `authenticated`, `service_role`, `auth`, `storage`) and are not self-contained plain-Postgres scripts. The Supabase CLI, Deno, Docker, and Podman are unavailable in the current workspace, so Deno checks and an empty-database local replay were not run in this session. Earlier Deno checks are historical evidence only. The live verifier and schema contract query check deployed catalog, access, storage, RPC, and CORS behavior; they do not establish authenticated multi-account RLS behavior or prove a clean replay.

## Administrator console surface

The browser console is one layout with one route per screen. Every screen below is served by the Edge Function route in parentheses; the permission in brackets is what the route requires, and it is re-checked on every request.

| Route                                                                                                                         | Screen                                                                                                                   | Endpoint set                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| /admin/login                                                                                                                  | Username and password sign-in                                                                                            | /admin/login                                                                                                                           |
| `/admin/dashboard`                                                                                                            | Metrics, recent users, reports, admin activity                                                                           | `/admin/overview`                                                                                                                      |
| `/admin/users`                                                                                                                | Members, moderation actions, profile override                                                                            | `/admin/users`, `/admin/users/:id`, `/admin/users/:id/actions`, `/admin/users/:id/profile`                                             |
| `/admin/posts`, `/admin/comments`, `/admin/reports`, `/admin/messages`                                                        | Content and message report queues; message reports require `messages.view_reports` and never include conversation bodies | `/admin/posts`, `/admin/comments`, `/admin/reports`, `/admin/message-reports`                                                          |
| `/admin/reels`, `/admin/stories`, `/admin/groups`                                                                             | Reel, story, and group moderation; group actions are audited and expose no group chat content                            | `/admin/reels`, `/admin/stories`, `/admin/groups`                                                                                      |
| `/admin/cms`, `/admin/navigation`, `/admin/routes`                                                                            | Content                                                                                                                  | `/admin/cms/pages`, `/admin/navigation`, `/admin/routes`                                                                               |
| `/admin/branding`, `/admin/animations`, `/admin/motion`, `/admin/error-pages`, `/admin/theme`                                 | Appearance                                                                                                               | `/admin/branding`, `/admin/animations`, `/admin/motion`, `/admin/design/motion`, `/admin/error-pages`, `/admin/appearance`             |
| `/admin/settings`, `/admin/platform`, `/admin/feature-flags`, `/admin/emails`                                                 | Configuration                                                                                                            | `/admin/settings`, `/admin/platform-settings`, `/admin/feature-flags`, `/admin/emails`                                                 |
| `/admin/announcements`, `/admin/notifications`, `/admin/ads`                                                                  | Messaging                                                                                                                | `/admin/announcements`, `/admin/notifications`, `/admin/ads`                                                                           |
| `/admin/admins`, `/admin/roles`, `/admin/provisioning`, `/admin/sessions`, `/admin/security`, `/admin/audit`, `/admin/system` | Governance                                                                                                               | `/admin/admins`, `/admin/roles`, `/admin/provisioning`, `/admin/sessions`, `/admin/access-code`, `/admin/logs`, `/admin/system-health` |
| `/admin/assets`, `/admin/logs`, `/admin/moderation`                                                                           | Legacy route aliases                                                                                                     | Redirect to `/admin/branding`, `/admin/audit`, and `/admin/posts` respectively                                                         |

The console-wide search box in the header calls `GET /admin/search` and is only drawn for a role holding `users.view`, which is the permission that route requires.

`POST /admin/assets` is intentionally not reachable from the console. It uploads to `site-assets` without recording an asset version or activating the file, so the public shell never reads what it writes. Logo, startup-animation and error-animation uploads go through `POST /admin/branding` and `POST /admin/motion`, which keep the previous version and activate the new one.

## Auth, email, and redirects

In Supabase Dashboard → Authentication → URL Configuration:

- Set **Site URL** to the exact production SPA origin.
- Add exact redirect URLs for `/auth/confirm` and `/reset-password` on production, local development (`http://localhost:8443`), and each active preview origin. Remove stale preview entries after testing. Do not use a wildcard origin.
- Confirm the deployed host serves direct SPA navigation for those paths.

In Authentication → SMTP Settings, configure a verified sender identity and a production SMTP provider. The built-in Supabase sender is rate-limited; it is not sufficient for public signup. Keep SMTP credentials only in protected Supabase settings.

Install the repository templates in Authentication → Email Templates:

- `email-templates/confirm-signup.html` as **Confirm signup**, subject `Verify your VELORI account`. Keep the Supabase-generated `TokenHash` and exact `.RedirectTo`; the page verifies the token only after the user presses the button.
- `email-templates/recovery.html` as **Reset password**.
- `email-templates/email-change.html` for the email-change templates enabled by the project.

Test signup, delivery, link confirmation, expired/consumed links, resend, password recovery, and email change using a non-production account. A reachable Auth endpoint is not proof that SMTP delivered a message.

## Storage

Verify the `site-assets` bucket exists and is public-read. Client-side policies permit reads only; browser inserts/updates/deletes must remain denied. Migration 060 allows supported MP4 objects and a 10 MiB upload ceiling; migration `20261031004300` additionally allows `image/svg+xml` for error-page illustrations, which the server decodes as strict UTF-8 and rejects if they carry scripts, event handlers, entities or embedded HTML. Uploads must still go through the authenticated Edge Function, which validates the declared type against file bytes and creates a generated object path. Test anonymous read and denied write, then an authenticated admin upload for logo, startup video, error video, and an error-page SVG illustration. Never grant browser write access to make an upload test pass.

## Edge Function and server secrets

The backend workflow deploys the function using its folder name. For manual recovery only:

```powershell
supabase functions deploy server --project-ref $env:SUPABASE_PROJECT_REF
```

The CLI config sets `verify_jwt = false` so the public username/password login and one-time initialization request can reach Hono. The initializer is protected by a setup code and rate limiting. `requireAdmin` is installed over every other `/admin/*` route before route handlers and validates the opaque session on each request. Browser sessions use an HttpOnly cookie; the cross-origin fallback sends a bearer token held only in tab `sessionStorage`.

The Edge Function prefers the custom `VELORI_*` values and falls back to Supabase's injected `SUPABASE_PUBLISHABLE_KEYS` and `SUPABASE_SECRET_KEYS` dictionaries, then legacy injected keys. Custom Edge Function variables may not start with `SUPABASE_`, because that prefix is reserved by Supabase. Configure these values in the target project; names only are listed here:

- `ALLOWED_ORIGINS`
- `ADMIN_SETUP_CODE` (temporary; publish only during initial setup and remove immediately after initialization)
- `VELORI_ADMIN_USERNAME` (primary username used by the one-time initializer)
- `VELORI_SUPABASE_PUBLISHABLE_KEY` (only needed when the injected key dictionary is unavailable)
- `VELORI_SUPABASE_SECRET_KEY` (optional custom secret key; the injected dictionary or legacy service-role key is used otherwise)

`ALLOWED_ORIGINS` must contain the exact trusted production and preview origins, comma-separated. The function does not allow wildcard CORS. Its allowlist also includes the explicit local Vite origins `http://localhost:8443` and `http://127.0.0.1:8443`. The deployed health endpoint currently reports `configured=true` and `originsConfigured=true`. Deno dependencies are pinned by `supabase/functions/deno.json` and `supabase/functions/deno.lock`; validate with `deno check supabase/functions/server/index.tsx` and `deno lint supabase/functions/server/index.tsx` before deployment. Deno checks were not available for the 2026-10-03 deployment; the server-side CLI bundler accepted the function, and TypeScript syntax transpilation passed, but those are not substitutes for Deno checks.

The client calls only `/functions/v1/server/admin/*` and `/functions/v1/server/health`. Do not deploy a second alias or add legacy route prefixes. Live CORS checks confirm exact-origin echo, credentialed cookies, bearer fallback, and rejection of an unknown origin. The dedicated administrator login was exercised in an earlier browser pass; this latest pass did not sign into the production account.

## First administrator

The first administrator was previously initialized as `VELORYZMANAGEARYAN` and verified through the browser. The initial password is retained only in the ignored local `.env.secrets.local` file so the operator can sign in; it was not used in this pass, printed, committed, or present in Supabase Function secrets. The server retains only its PBKDF2 hash. Both the remote `VELORI_ADMIN_INITIAL_PASSWORD` and `ADMIN_SETUP_CODE` secrets and the local setup code have been removed after initialization.

For a fresh project, keep the initial username/password in protected local configuration, publish the temporary setup code as `ADMIN_SETUP_CODE`, set `VELORI_PUBLISH_INITIAL_ADMIN_PASSWORD=true` only during bootstrap, deploy the migrations and `server` function, and run `pnpm admin:initialize`. This sends only the setup code; the initial password is read server-side. After the first account is created, remove the publish opt-in and unset both `ADMIN_SETUP_CODE` and `VELORI_ADMIN_INITIAL_PASSWORD` from Function secrets. Change the generated initial password from Admin Security after signing in.

## Post-deployment acceptance tests

Do not mark these passed until each has been executed against the project:

- `GET /functions/v1/server/health` reports the function is configured.
- GET /functions/v1/server/admin/me without an administrator session returns 401; an ordinary user token is rejected; an active administrator session succeeds; disabling or revoking an administrator blocks its next request.
- On a fresh project, verify `/admin/initialize` rejects an incorrect setup code, creates only one initial account, and rejects a second initialization. Remove the setup-code and initial-password Function secrets as soon as initialization succeeds.
- Admin login throttles repeated failures and does not distinguish unknown users from incorrect passwords.
- Admin settings validate input and persist after reload. Verify maintenance mode leaves admin and auth recovery routes reachable.
- Verify each core REST table is available. Explicitly retest `PGRST205`; do not treat friendly frontend messaging as a schema fix.
- Use two test accounts to verify RLS: profile ownership, private/public profile visibility, post ownership, likes, comments, and saves. Confirm anonymous writes remain denied.
- Verify Storage read/write policies for both buckets: avatar reads are public; signed-in users can only upload, replace, or delete objects under their own user-ID folder. Verify image/video content validation; reject a mismatched MIME signature and oversize upload.
- Verify profile editing persists display name, bio, website, link title, and account type. Test username syntax, availability, reserved-name rejection, and uniqueness under concurrent attempts. Upload, crop, rotate, replace, and remove a profile photo; confirm another account cannot write to that user's avatar folder.
- Verify private-profile mode hides the profile and posts from other signed-out and signed-in users, while the owner retains access. Follow requests are implemented by the relationship migration and still require live multi-account acceptance testing.
- Verify post creation and edits persist audience and interaction settings. Confirm private posts are owner-only, disabled likes/comments are rejected by RLS, hidden like counts are not returned to other viewers, and archived/trash posts disappear from public feed/search/profile queries. Restore archived/trash items and confirm expired database rows are purged by the scheduled `velori-purge-expired-posts` job. Verify expired media objects are removed by the separately deployed cleanup worker before treating storage cleanup as complete.
- In a non-production project, send one administrator campaign to all accounts and one to selected account types. Confirm only recipients with system notifications enabled receive timeline rows, the displayed recipient count matches actual rows, `read_at` updates the matching receipt, expired rows are hidden, and deleting a campaign withdraws its rows from recipient timelines. Do not test a broad campaign against real users.
- Verify drafts survive refresh and sign-in, belong only to their author, can be resumed/deleted, and are removed after successful publication.
- Verify public-profile follows become accepted, private-profile follows remain pending until owner approval, declined/canceled requests are deleted, and only accepted followers can read followers-only posts or posts belonging to private profiles. Test all cases with signed-out users and at least three accounts; direct REST attempts to self-accept, alter relationship owners, or read pending requests must fail.
- Verify multiple image/MP4 uploads, image optimization, cancellation/retry, progress, order, alt text, signed media reads for public posts, and denied reads for private/unpublished posts from a second account. Confirm draft media cannot be read or deleted across user folders.
- Complete a real signup → delivered email → confirmation → onboarding → refresh → sign-out → sign-in flow. Explicitly retest `over_email_send_rate_limit`; do not treat UI error handling as email delivery success.
- Admin → Site settings: enable animated 404, save, reload, open an invalid URL, and verify animation. Disable it, save/reload, and verify the static fallback. Check with `prefers-reduced-motion: reduce`; the static image must be used. Confirm the startup animation setting remains independent.
- Admin → Reels and Admin → Stories: hide a reel, confirm it leaves the public surfaces and its row survives; remove one, confirm it is gone; restore it. Repeat for stories. A story restore is authorized by `stories.hide`, because the permission registry has no `stories.restore` entry — check that a role holding only `stories.hide` can still undo its own hide.
- Admin → Users → Manage: apply a profile override and confirm the public profile reflects it, then confirm the audit row lists the changed field names.
- Admin → Security: rotate the access code and confirm the previous value stops working; disable it and confirm first-time setup closes.
- Exercise every admin route and confirm sensitive actions are recorded in audit logs.

## Rollback

Take a database backup before migrations. Migrations are forward changes; do not drop production tables or roll back data destructively to recover from a partial apply. Fix with a reviewed forward migration or restore the backup under an approved recovery procedure. A bad Edge Function release can be replaced by redeploying the last known-good source. If the temporary setup secret is exposed, remove it and rotate the stored code; review admin audit logs. Never expose the service-role key or SMTP credentials in a browser bundle, build artifact, issue, or log.
