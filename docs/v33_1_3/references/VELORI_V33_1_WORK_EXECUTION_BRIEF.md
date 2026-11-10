# Work execution brief — VELORI V33 to V33.1

**Use with:** `VELORI_V33_1_PRODUCTION_BLUEPRINT.md` and `VELORI_V33_1_UI_REFERENCE.html`.

## Operating instructions

You are working in the **existing active VELORI V33 Work project**, not an older ZIP snapshot. Implement this as a code change and verified deployment, not a generic answer, visual concept, or rewritten template. Follow the attached blueprint as product acceptance requirements. Read `AGENTS.md`, `CLAUDE.md`, `VERSION.json`, package manifests, router registry, Supabase migrations, editor runtimes, licensing documents and test commands before editing.

### Source baseline safety — mandatory

1. Report actual V33 branch/commit/source version, latest migration and active deployment target.
2. Make a rollback branch/commit before modifications. Do not overwrite V33 with `VELORI_V31_COMPLETE_REDESIGN_SOURCE.zip` or `VELORI_V33_1_INTEGRATION_SOURCE_BASE_V31.zip`.
3. Review the reference `VELORI_V33_1_MERGE_PATCH.zip` only as V31-derived sample changes. Apply compatible hunks after diff review, and reject outdated code.
4. Enumerate current functionality: social feed, profiles, auth, posts, stories, reels, editor, mentions, music, FORGE, admin, CMS and payment/usage. Keep unrelated routes and production users intact.
5. List blockers honestly when required credentials, licensing, databases, runner hosting or source files are unavailable; do not fabricate success or hidden progress.

## Workstreams and required outputs

**A. Music:** unified published licensed catalog, artist/rights metadata and per-format use scopes; post soundtrack association and viewer-initiated playback; reel audio mix, render and publish proof; story media/background + soundtrack composition and playback; signed-URL renewal, codec/autoplay handling, draft recovery and user-visible errors.

**B. Stories:** author grouping, individual top progress segments, tap within author, swipe between authors, last-author behavior, private-account permissions, touch/keyboard support, real-device tests.

**C. FORGE UI:** VELORI-branded responsive chat-first layout, no second AI response area, contextual prompts and follow-ups, inline approval cards, saved transcript, real run progress, errors/quota messages, preview/diff/code panes. Use the UI reference for layout only; do not ship static demo contents as production.

**D. FORGE architecture:** retain existing static generator; add versioned durable run state/event stream, idempotent allowance ledger, secret-safe Gemini routing, model health checks and differentiated provider/plan/runner errors. If general-purpose full-stack coding is in release scope, deploy a genuinely isolated runner service with file/tool protocols, permission gates, build/test execution, artifact snapshots and security review. Do not pretend a Supabase Edge Function alone runs a full Node/Python development environment.

**E. Exports/shares:** real saved source archive, correct files/lockfile/README/notices, immutable revision snapshots, dedicated safe preview delivery, revocable unguessable share links, tier-consistent preview branding and legally accurate rights policy.

**F. Admin/quotas:** model config, real health signals, per-user and provider cap, costs and runner health, rights-cleared music catalogs, plan-entitlement webhook verification, role-sensitive operational logs.

**G. Rights/licensing:** preserve MIT attributions and third-party licenses, review commercial WebContainer licensing, never claim that all AI outputs are automatically owned by VELORYZ; validate free attribution terms and Premium removal, honor user source rights.

## Expected deliverables

1. A V33 -> V33.1 source diff and changed-file map.
2. Additive, reviewed SQL migrations and RLS tests.
3. Working backend/API and (if enabled) sandbox runner, not mock events.
4. Responsive chat-first UI and verified music/story media workflows.
5. Automated unit/integration/E2E test logs + manual Android/mobile QA evidence.
6. Security/licensing audit and remaining risk register.
7. Built source archive and verified live preview/download features.
8. Staging deployment, production release commit/URL, rollback point and smoke tests.

### Release truth constraint

Only state **"V33.1 deployed"** after the actual current V33 source has been merged, compiled, tested and deployed. A spec, patch ZIP, UI mock or successful static generator response is not proof of production completion.

## Priority sequence

1. Source identity and backup.
2. Story navigation and all three media/music fixes.
3. FORGE chat controls and truthful error/progress UX.
4. Durable jobs/events, quota controls, projects, share/export.
5. Safe runner, framework support and actual build/test execution.
6. Licensing/copyright/paid entitlements.
7. Staging, QA, canary, production deploy/rollback.

**Product goal:** Premium-feeling, easy-to-use, accessible VELORI social and FORGE experiences, with security, user rights and operational honesty treated as release-blocking requirements.
