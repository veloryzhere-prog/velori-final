# VELORI Implementation Manifest

Updated: 2026-10-17

## Source specifications and scope

| Specification              | Screens and features                                                                                                                                          | Existing implementation areas                                                                                                                                                         | State                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `specs/01-post-editor.md`  | `/create`: multi-slide post canvas, layers/tools, animation/timeline, export/preview, collaboration, brand/templates, undo/autosave                           | `src/app/views.tsx`, `src/components/post-editor/*`, `src/components/studios/*`, `src/lib/post-editor/*`, `src/lib/post-media.ts`, `types/post-editor.ts`, Supabase post drafts/media | In progress; functional editor exists, but several target capabilities and durable scene persistence remain incomplete                         |
| `specs/02-reel-editor.md`  | `/reels/create`: reel project, multi-track timeline, clip/effect/audio/caption editing, preview, export, publishing/scheduling/collaboration                  | `src/pages/ReelStudio/*`, `src/components/reel-editor/*`, `src/lib/reel-editor/*`, `src/lib/social-media.ts`, `supabase/functions/reel-export/*`                                      | In progress; timeline/editor primitives exist, while the live route remains a Twick demo/local publish flow per `docs/ui-redesign/05-reels.md` |
| `specs/03-story-editor.md` | `/stories`, `/stories/create`, `/stories/archive`, feed StoryTray: authoring, media, overlays, stickers, timing, preview/export/publish, audience and archive | `src/app/story-editor-page.tsx`, `src/app/social-media-pages.tsx`, `src/components/story-editor/*`, `src/lib/story-editor/*`, `src/lib/social-media.ts`                               | In progress; Story Studio is implemented, with authenticated acceptance and backend/catalog gaps recorded in `docs/VELORI_PROGRESS.md`         |

Supporting requirements read: `AGENTS.md`, `docs/VELORI_PERMANENT_AGENT_INSTRUCTIONS.md`, `VELORI_UI_MASTER.md`, `docs/VELORI_PROGRESS.md`, and relevant shared UI specifications under `docs/ui-redesign/` (`01`, `02`, `04`, `05`, `09`, `10`). The tracker is the canonical baseline for prior phases and evidence. No `implementation/` directory or nested `AGENTS.md` existed at audit start.

## Architecture and baseline

- React 19, Vite 8, TypeScript strict mode, React Router, Tailwind CSS v4, Supabase JS, Prisma schema, Playwright, Node test runner, and `oxfmt` are installed/configured. `pnpm` is the package manager.
- Routes are defined in `src/app/routes.tsx`; `/create` is `CreatePost()` in `src/app/views.tsx`; `/stories/create` is the dedicated `StoryEditorPage`; `/reels/create` is the separate `ReelStudioPage` flow. Story viewing and archive remain under `src/app/social-media-pages.tsx`.
- Post publishing and uploaded draft media use existing Supabase `posts`, `post_drafts`, `post_draft_media`, and storage workflows. The post editor also contains an in-memory CRUD adapter and Prisma editor models; neither adapter alone proves deployed persistent editor APIs exist. Story uploads and publishing use existing authenticated Supabase flows; story draft state is device-local. Reel export has an Edge Function; the route's publish confirmation is local-only.
- Baseline before this task: `pnpm run typecheck` PASS; `pnpm test` PASS (144/144); `pnpm run build` PASS (existing Node deprecation and large-chunk warnings). The repository does not define a lint script. The progress tracker records repository-wide format drift; this task's focused formatter check passed after formatting.
- Database schema, migrations, dependencies, authentication, permissions, backend contracts, and existing publishing behavior are protected. The post scene recovery task only uses the existing user-scoped local recovery record.

## Ordered stages and task status

Statuses use the required manifest vocabulary: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `VERIFIED`.

| Order | Task                                                                               | Stage / dependency                                                           | Required checks                                                                         | Status                                                                            |
| ----- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 00    | Repository/spec audit and baseline                                                 | A; none                                                                      | typecheck, full tests, production build; route/data review                              | VERIFIED                                                                          |
| 01    | Shared Motion Glass foundation                                                     | B; Stage A                                                                   | UI-system acceptance and desktop/mobile checks                                          | VERIFIED (existing tracker evidence, Phase 1)                                     |
| 02    | App shell and navigation                                                           | C; Stage B                                                                   | route/auth preservation, keyboard, mobile navigation                                    | VERIFIED (existing tracker evidence, Phase 2)                                     |
| 03    | `POST-01` Recover unsynced canvas scene locally                                    | D; 00–02                                                                     | scene helper tests, typecheck, full suite, build, focused format; browser restore check | VERIFIED                                                                          |
| 04    | `POST-02` Complete post canvas tools and 1–20 slide workflow                       | D; POST-01                                                                   | canvas/component tests, mixed-layer carousel acceptance, responsive browser review      | NOT STARTED                                                                       |
| 05    | `POST-03` Animation, timeline, export, and platform preview                        | D; POST-02                                                                   | export dimensions/file tests, animation tests, platform preview browser checks          | NOT STARTED                                                                       |
| 06    | `POST-04` Collaboration, brand kit, templates, history and cloud persistence audit | D; POST-02; persistence changes require a verified existing backend contract | collab/API tests, two-session acceptance where authorized, backend/RLS review           | NOT STARTED                                                                       |
| 07    | `REEL-01` Establish a real project model and timeline route integration            | D; 00–02; no schema change without authorization                             | reel engine/API tests, route/auth, 100+ clip load and responsive review                 | NOT STARTED                                                                       |
| 08    | `REEL-02` Complete clip, effects, color, caption, overlay and audio workflows      | D; REEL-01                                                                   | unit tests by module, media fixture checks, accessible control review                   | NOT STARTED                                                                       |
| 09    | `REEL-03` Preview, export, publish and schedule integration                        | D; REEL-02; existing provider/backend contracts required                     | export tests, authorized non-production upload/publish checks, platform viewport review | NOT STARTED                                                                       |
| 10    | `STORY-01` Close remaining authoring, timing, sticker and media gaps               | D; 00–02; retain current Story Studio                                        | story module tests, 5-slide mixed-media/poll acceptance, responsive browser review      | NOT STARTED                                                                       |
| 11    | `STORY-02` Verify audience, tray/viewer/archive and publish/privacy flows          | D; STORY-01; authenticated non-production account required                   | route and RLS checks; audience/publish failure and retry acceptance                     | NOT STARTED                                                                       |
| 12    | `STORY-03` Resolve soundtrack and durable shared-draft capability                  | D; STORY-01; requires an approved catalog/license and backend contract       | catalog integration tests and two-session persistence tests                             | BLOCKED pending authorized music catalog/licensing and draft persistence contract |
| 13    | Cross-screen editor integration                                                    | E; POST-02–04, REEL-01–03, STORY-01–03                                       | shared route/auth/theme/privacy and responsive regression suite                         | NOT STARTED                                                                       |
| 14    | Final specification audit                                                          | F; Stage E                                                                   | typecheck, lint if defined, full tests, format gate, build, browser matrix and evidence | NOT STARTED                                                                       |

## Dependencies and parallel work

- The verified design system and shell are prerequisites for all editor screen work. Stage A/B/C are recorded complete from existing repository evidence; no redesign of those phases is planned without a spec-backed defect.
- Post canvas tools depend on local recovery being implemented and accepted. Animation/export and collaboration depend on a stable scene shape; no persistent data migration may be started under current `AGENTS.md` rules.
- Reel tasks are sequential within their editor, but can be developed independently from post tasks after Stage C if file ownership is separated. Story authoring can proceed independently from post/reel, while audience/publish verification needs an authorized non-production account.
- Cross-screen integration and final audit depend on all three editor tracks. Do not treat local demos, mock fixtures, or the in-memory adapters as deployed backend functionality.
- Music catalog and cloud draft sharing are blocked at the product/backend contract boundary, not by missing frontend controls. Continue only with independent work until an authorized contract exists.

## Completion criteria

Each task must meet its linked task-document acceptance criteria, keep existing routes/data/auth/privacy flows intact, run its listed automated checks, inspect relevant rendered UI at applicable viewport sizes, and record actual evidence. `VERIFIED` is reserved for tasks whose functional and visual acceptance is checked. The overall platform is not complete until Stage F passes and the known blockers/remaining verification are resolved or explicitly accepted.

## Task documents

- `implementation/tasks/POST-01-local-scene-recovery.md`
- `implementation/tasks/POST-02-canvas-tools-and-carousel.md`
- `implementation/tasks/POST-03-animation-export-preview.md`
- `implementation/tasks/POST-04-collaboration-brand-templates.md`
- `implementation/tasks/REEL-01-project-and-timeline.md`
- `implementation/tasks/REEL-02-editing-panels.md`
- `implementation/tasks/REEL-03-preview-export-publish.md`
- `implementation/tasks/STORY-01-authoring-and-timing.md`
- `implementation/tasks/STORY-02-audience-and-publish-acceptance.md`
- `implementation/tasks/STORY-03-catalog-and-shared-drafts.md`
- `implementation/tasks/INTEGRATION-01-cross-editor-regression.md`
- `implementation/tasks/FINAL-01-specification-and-release-audit.md`

## Current task evidence

`POST-01` stores validated post canvas layer snapshots inside the existing per-user local recovery record and restores them when that same local recovery copy wins over the account draft. Image scene layers reconnect to the current signed preview URL for their uploaded draft-media record. The browser audit also found and fixed a React warning caused by notifying the parent from inside canvas state updater functions. Helper tests cover snapshot isolation and malformed input. Final checks: `pnpm test` PASS (146/146); `pnpm run typecheck` PASS; `pnpm run build` PASS (existing Node deprecation and large-chunk warnings); focused `oxfmt --check` PASS. `pnpm e2e -- e2e/post-local-scene-recovery.spec.ts` PASS (1/1): authenticated QA owner deleted the starter canvas layer, verified the empty scene was stored, reloaded `/create`, and confirmed the empty scene remained; at 390×844 the page had no horizontal overflow, page exceptions, or console errors. No post was published. Scene persistence is device-local; account/cross-device scene storage remains a separate contract-dependent task.
