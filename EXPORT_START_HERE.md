# VELORI V33 — complete source export

Source commit: 41af005cb7993a7e33784d541bf73fa40fbd2da0
Latest included update: automatic post playback, toolbar removal and active Reel sound-default correction.
This is the real existing application source, including React/TypeScript, app assets, Supabase functions/migrations, server services, tests and documentation.

## Run locally

Use Node 24 and pnpm 10.34.3 (pinned in package.json).

1. Extract this ZIP and open the VELORI_V33 directory.
2. Run: corepack pnpm install --frozen-lockfile
3. Copy .env.example to .env.local and provide your Supabase project URL and public publishable key. Existing project reference: gmgobchwnfkwfuekhpkr. Never use a service-role key as a browser environment value.
4. Run: corepack pnpm dev
5. Validate: corepack pnpm verify
6. Production build: corepack pnpm build

The current published frontend uses the existing Supabase backend. Do not blindly apply all historical migrations to an existing production database. Backend provider keys and protected runtime secrets must be configured separately; they are intentionally excluded. .openai/hosting.json retains the original Site identity for continuity; change deployment configuration deliberately if hosting elsewhere.

## Included status

The latest verification ran 317 tests: 316 passed, one existing platform skip. TypeScript and production build passed. Full-platform acceptance is still incomplete. Read docs/v33/RELEASE.md, MUSIC_PLAYBACK_FIX.md and POST_AUTOPLAY_FIX.md for exact verified scope and remaining blockers.

Not included: node_modules, Git history, private .env files, credentials, database contents, runtime uploads, generated deployment bundles and internal browser audit screenshots. All tracked application assets are included. Internal audit documents may reference excluded screenshots.
