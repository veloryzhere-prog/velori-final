# VELORI — complete source package

Prepared 24 October 2026. The archive contains the actual existing VELORI project, including the social frontend, all editors, admin panel, Supabase functions/migrations, tests, assets, configuration and a matching production build.

## Run locally

Use Node compatible with this repository and pnpm 10.34.3 (package.json/package lock are included).

1. Extract the velori folder.
2. Run pnpm install --frozen-lockfile.
3. The available .env.local provides the existing public Supabase URL and publishable key. Review .env.example and existing setup docs for server configuration.
4. Run pnpm dev. Run pnpm typecheck, pnpm test and pnpm build to validate.

## Backend and admin

The Supabase backend is in supabase/functions and supabase/migrations. The admin panel remains in src/app/admin-console and uses the existing server authorization system. This ZIP does not grant administrator access or replace existing authentication.

Account chat sync and private reporting are deployed to the connected hosted database. Migration version 20261024062302 was applied and transactional participant/account-isolation/reporting checks passed, with all test fixtures rolled back. For a fresh database, apply supabase/migrations/20261024062302_chat_preferences_and_private_reporting.sql using your normal migration workflow; then run the catalog acceptance check in supabase/tests/chat_preferences.sql and authenticated multi-account tests. The frontend remains usable with a clearly labeled local cache before installation.

With a management credential securely configured, the existing helper supports:

    node scripts/db-query.mjs --file supabase/migrations/20261024062302_chat_preferences_and_private_reporting.sql --write
    node scripts/db-query.mjs --file supabase/tests/chat_preferences.sql --expect-no-rows

Review migration history before applying to avoid reapplying an already installed change. Never put management/service-role credentials into VITE_ variables.

## Included configuration and data scope

The available local runtime configuration is included. Privileged backend/management secrets were not present in this workspace and are not invented or recoverable from source. Keep your own server secrets in the deployment secret store. Hosted database records and user-uploaded files remain in the existing Supabase project; this is a source/build package, not a database or private-media backup. Dependency downloads, Git authentication/history, caches and previous export archives are excluded. Install dependencies from the included lockfile.

## What changed in this release

Added shared menu/tab/card/dialog/navigation motion and continuous accents, with off-screen/background pausing and Full/Gentle/Off support. Batched and deferred feed-gallery signing near the viewport. Added queued personal chat synchronization, offline cache, retry/status feedback and the database migration for personal settings, message hiding and private reporting. Child Mode remains optional client text filtering, not a guardian lock or server moderation policy.

## Evidence and limitations

241 automated tests passed. TypeScript and final production build run during packaging. Browser checks verified actual settings/gallery components using isolated services, including deferred signing (zero off-screen; one request for three files), theme/Child Mode save acknowledgment, missing-schema feedback, Full/Gentle/Off behavior and a six-width overlay check. The production migration, SQL role-based persistence/isolation/reporting checks and catalog checks passed. Physical cross-device delivery, real mobile keyboard and low-end FPS benchmarks remain unverified. See docs/audits/2026-10-24-motion-performance-sync.md.


## Inbox polish and mutual connections

The final pass fixes inbox navigation and delayed-request isolation, adds a full-display messaging layout and branded loading states, exposes existing account messaging controls, and adds privacy-aware people-you-both-follow lists. Migration 20261024063821_profile_mutual_connections.sql is deployed alongside the chat preference/report migration. Official Instagram feature descriptions were reviewed; third-party translation, licensed music and scheduled delivery are not represented as implemented. See docs/audits/2026-10-24-inbox-polish.md for exact acceptance evidence and remaining verification limits.
