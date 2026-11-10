# 04 â€” Stories

Status: IMPLEMENTED â€” NOT VERIFIED. Authenticated visual and interaction acceptance remains pending.

## Routes and implementation

- `/stories` â†’ `StoriesPage` in `src/app/social-media-pages.tsx`; includes story retrieval/viewer and in-page composition state.
- `/stories/create` â†’ standalone `StoryEditorPage` in `src/app/story-editor-page.tsx`, with supporting `src/lib/story-editor/*` and story-editor components.
- `/stories/archive` â†’ `StoriesArchivePage`.
- `StoryTray` is also used within the feed/home experience.
- Story records/media use Supabase, visibility helpers, media signing/upload utilities, feature flag `stories_enabled`, and RLS. The editor has dedicated API, navigation, text/media tools, stickers, collaboration, templates and export modules with unit tests.

## Phase 4 plan

- Keep tray grouping, view progression, expiry/archive semantics, unseen/viewed state, and query-selected story behavior.
- Preserve public/follower/close-friends/private audience controls, reaction/reply permissions, seen/mark-viewed behavior, and accessible previous/next/close interactions.
- Keep story creation media validation/upload, text-only stories, draggable text overlays, audience selection, publish/error states, and full editor tools.
- Preserve archive ownership, unavailable story feedback, media signed URL access, and retry behavior.
- Avoid making stories public or bypassing media RLS to simplify rendering.

## Acceptance

Check signed-out and signed-in states, empty tray, active story, unavailable story, archive empty/populated/error, disabled feature flag, all audience modes, media failure, keyboard controls, touch progression and composition/editor publish failures. Run story-editor unit tests and visual checks at target widths.

## Story Studio layout follow-up

- The standalone `/stories/create` editor now uses a contextual back/title/draft/preview/post header, centered 9:16 canvas, toggleable safe-zone guides, canvas play control, six-tool toolbar, conditional single-tool panel, and persistent slide storyboard capped at 10 slides.
- Sticker tools show 12 recent and 8 trending selections by default with search and four tabs. Brand Kit, collaboration, and share/export are available under More. Primary export actions stay user-facing; technical encoding details remain behind the optional advanced disclosure.
- The existing preview state drives full-screen playback, auto-advance, pause/resume, and swipe navigation. Existing editor data, upload, export, and collaboration logic was not replaced.
- Authenticated Playwright verification passed at 1440Ã—1000 and 390Ã—844. Evidence covers the six toolbar destinations, single-panel disclosure, sticker counts, More subsections, adding/selecting slides, preview pause/advance/swipe, no horizontal overflow, and complete storyboard visibility. Browser screenshots are captured under `test-results/qa-matrix-Phase-4-authenti-ab470-and-previews-the-storyboard-chromium/`.
- Current checks: `pnpm run typecheck` PASS; `pnpm test` PASS (203 passed, 0 failed); `pnpm run build` PASS (existing Node `module.register()` deprecation warning); changed-file `oxfmt --check` PASS.
- This is not full Phase 4 acceptance: tray/viewer/archive, audience privacy, upload retry/failure, and story publication remain unverified. Keep the phase status `IMPLEMENTED â€” NOT VERIFIED`.

## Simple Story Studio integration (2026-10-17)

- Replaced the `/stories/create` route chrome with a viewport-filling shell, centered 9:16 canvas, six tool destinations, responsive controls panel, and compact Publish/Menu footer. The route retains its auth and app wrappers.
- Connected the supplied layout to the existing StoryCanvas, validated MediaTools/upload flow, styled text, stickers, drawing, slide actions, and advanced editor controls. Publish opens the existing authenticated review dialog and calls the real story publishing handler. Save draft writes the existing device-local collaboration snapshot and IndexedDB media manifest; feedback identifies it as device-local.
- Music continues to use the existing visual music sticker; there is no configured music catalog or soundtrack mixer. No database schema or dependency changes were made.
- Authenticated browser review passed for text and sticker insertion, Background panel, draft feedback, and opening the publish review dialog. At 1440×900, 768×900, 390×844, and 320×740 there was no horizontal overflow and the preview retained a 9:16 ratio. The automated media fixture did not confirm a resulting uploaded preview; media selection/upload acceptance remains open. No story was published.
- `pnpm typecheck`, `pnpm test` (143/143), `pnpm build`, and focused formatting passed. Phase 4 remains `IMPLEMENTED — NOT VERIFIED`; tray/viewer/archive, audience, upload preview/failure, and end-to-end publication acceptance remain open.

## Standalone editor correction and feature completion (2026-10-17)

- Selection no longer changes the active tool. Text and sticker pointer gestures move/select without opening a panel; opening Text or Stickers deliberately exposes properties for the selected object. Empty-canvas click deselects while leaving the current tool layout open. Selection handles remain touch-sized and object surfaces suppress text selection/page gestures.
- Desktop tools are one horizontal row with Lucide icons and labels. The right-side controls use their own workspace column. On mobile, the sheet is in normal layout flow below the preview, scrolls internally, and leaves Publish/Menu in a safe-area-aware footer. Empty media prompt is small; tap-area guides and safe-zone labels default off.
- Text editing now uses explicit selection; multiple overlays, multiline copy, duplication, deletion, presets, font family/weight/size, bold/italic, alignment, line/letter spacing, palette/custom color, highlight opacity/radius, outline, shadow, text opacity, rotation, position presets, and layer-order controls are connected to the existing canvas model and undo history. Opening/closing tools preserves selection.
- Text and sticker effects use shared timing/frame functions with duration, delay, start time, loop, preview, and reset controls. Text effects: None, Fade In, Fade Out, Fade In and Out, Slide Up/Down/Left/Right, Zoom In/Out, Pop, Bounce, Pulse, Rotate In, Float, Typewriter. Sticker effects include those visual presets except text-only Typewriter, plus Spin. Preview respects `prefers-reduced-motion`. MP4 rendering applies the same animation transforms; PNG remains a static final composition. Publishing sends animated slides through the existing MP4 pipeline and static image slides through PNG. Browser/server MP4 publication was not run.
- Music now has a separate no-track empty state, not a music-sticker shortcut. Repository inspection found no admin-published music table/catalog, admin management UI, read endpoint, storage catalog, or licensing fields. Existing `AudioTrack` API is an in-memory editor model only. A real browser/playback/licensed track integration cannot be completed until that backend contract exists. No schema or dependency was changed.
- Authenticated Playwright: `e2e/story-studio-correction.spec.ts` PASS. At desktop 1440×900 the test confirms the 6-tool row and 9:16 preview. It confirms text and sticker movement while the tool panel is closed without opening a modal, intentional Text controls, animation transform changing during preview, sticker animation settings, Music empty state, and separate mobile preview/panel/footer geometry at 390×844 and 320×740. No horizontal overflow or page errors. Captures: `artifacts/story-studio-correction-desktop.png`, `artifacts/story-studio-correction-mobile.png`.
- Existing device-local draft snapshots remain the editor persistence behavior; the repository exposes no remote story-draft endpoint to use here. Story publishing was not invoked. Phase 4 remains `IMPLEMENTED — NOT VERIFIED` pending real audio catalog/backend, authenticated draft restoration, uploaded media preview/failure, audience behavior, and an actual publish/MP4 browser run.

## 2026-10-23 â€” Story hub and theatre replacement

The current viewer is src/features/stories/StoryExperience.tsx, connected to the existing StoryViewer data adapter in social-media-pages.tsx. It replaces the old backdrop/card presentation in tray, /stories and archive. Includes progress, active-only image/video/text playback, pause/hold/mute, swipe and keyboard navigation, media retry (refreshes signed URLs), real reactions/like/viewer lists, and draft-safe replies. Story likes now use conflict-ignore inserts because the existing reaction table intentionally has no UPDATE grant. No schema or RLS change.

Actual story image rendering, pause, persisted like (restored afterward), six responsive sizes and Full/Gentle/Off checked. In-memory fixtures exercised successful/failed replies, media failure, video loading/advance and physical swipe; no real reply was sent. Regression suite 209/209. Full Phase 4 privacy/publication acceptance remains open; see progress tracker for limits.
