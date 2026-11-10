# VELORI V32 implementation and release audit

Status: **IN PROGRESS — RELEASE BLOCKED**. This is an implementation checkpoint in the original application, not a claim that the complete V32 acceptance checklist has passed.

## Source and rollback

- Original project: `appgprj_6ad9f8a7371481918bde729c8934a24d`.
- Authoritative base: `f22070b826ed864a766c47ab2199b1a8e292d9d9`, published Site version 29.
- Existing public audience preserved. No replacement Site was created.
- First V32 checkpoint saved as candidate version 30, source `8a05d32647e3b3a52db7045e52a3b9b7096da9fb`; it was not deployed.
- Second V32 checkpoint saved as candidate version 31, source `21a40d22c893cecfbe3357d3ef01415394834503`; it was not deployed.
- Previous saved version: `appgprj_6ad9f8a7371481918bde729c8934a24d~appgver_ffe4d479ae7c8191a1bc15c79d3e4a64`.
- The V31 ZIP was inspected as historical source; only reviewed editor fixes were brought forward. Newer FORGE, commercial, environment, CMS and security source from version 29 was retained.

## Implemented changes

1. Central semantic violet/plum/light tokens. Existing feature aliases now refer to the shared palette. Historical studio override rules were removed from the old reference/polished/clean stylesheets; the feature styles and `studio-completion.css` own studio appearance and workspace sizing.
2. Original VELORI wing artwork, five-destination mobile dock (Home, Explore, Create, Messages, Profile), tablet rail, desktop navigation, Search entry, FORGE shortcut, real existing unread-count bindings, immersive-route behavior and keyboard-aware dock hiding.
3. Cleaner media-first feed, responsive discovery grid, profile color treatment, consistent input/focus states, reduced-motion-aware interactions, and double-tap-to-like through the existing optimistic backend handler.
4. Search cancellation, stale engagement-result protection and bounded 30-second account-scoped in-memory search caching.
5. Reel visual duration determines the endpoint. Audio/overlays cannot extend it. Seek revision resets the canonical playback origin, backward seeks reset progress reporting, paused indicators reconcile with the canonical clock, and replay is explicit. Added exact-second entry, arbitrary scrubbing, start/end controls, keyboard trim controls and edge scrolling during clip manipulation.
6. Reel audio elements synchronize with that clock, pause at the endpoint and are released on unmount. Preview video elements are also released when replaced.
7. Shared catalog music picker across Stories, Reels and Posts: debounce/cancellation, real catalog results, actual metadata duration, permitted-range selection up to 20 seconds, short-track clamping, playable excerpts, volume and expired-URL refresh. No fabricated catalog rows or trending metrics.
8. Story soundtrack/sticker separation, draggable existing music sticker, photo duration matching selected excerpt, canonical preview audio control, and audio mixed into actual published video output.
9. Fixed the Story export crop bug: a default `cropX=50,cropY=50` is a CSS percentage, not a translation of fifty canvas widths. Export geometry now matches preview object positioning. The first video frame is drawn before capture begins. Upload verification resolves a private signed URL and reads its headers before activating the Story; failure retains the failure/cleanup path.
10. Post Studio has Add media / Edit / Caption & publish stages. Optional photo music is saved in the existing local draft and encoded into MP4 media using the existing upload tables and private storage. Preview/export use the same composition path as publication.
11. FORGE uses the shared theme; existing account quotas, provider errors, cloud flags, payment checks and backend contracts are retained. The admin environment workspace is labeled Manage Importants, adds operational links and retains the original environment URL plus an alias. Secret values remain hidden and existing server-side authorization/reauthentication is retained.
12. Rendered Reel downloads retain an explicit download link until replacement/unmount, instead of revoking the object URL after four seconds. UI wording distinguishes rendering from a completed user download. Codec selection prefers explicit H.264/AAC when the browser supports it, final-frame capture uses the valid visual endpoint, and publication duration comes from the recorded file metadata rather than the intended clock length.

13. Feed comments now open the existing real discussion workflow in a phone bottom sheet or desktop side panel. Post detail deep links remain available. Existing replies, likes, permissions, errors and backend operations are reused; the shared Dialog restores focus and supports Escape.
14. Profiles use signed private-storage media thumbnails and text tiles. Owners have a Saved shortcut and can see their own private posts; other profiles retain the existing public/follower filter plus RLS. Profile tabs support arrow/Home/End keys and proper tab/panel relationships. Metadata is 13px and tabs are 44px high.
15. Completed missing shared UI aliases for spacing, typography, radii, glass surfaces, focus and motion. The old primitives referenced undefined variables, making dialog headings and spacing collapse. Added visual-viewport offset tracking for keyboard-aware sheets.
16. Removed the four unimported legacy `@twick/*` packages after checking all current application imports and the active editor routes. The custom current Reel/Post/Story implementations remain in place. Updated the existing Vite 8 override from 8.0.16 to 8.1.6, refreshed the pnpm lockfile, corrected obsolete admin editor copy and removed the old Twick-specific 4MB warning suppression. No new dependency was added.

17. Replaced unconditional client `crypto.randomUUID()` calls with one secure Web Crypto helper. Native UUID generation is preferred; `getRandomValues` supplies correctly versioned/variant UUID v4 bytes when the native method is absent. The helper fails closed without cryptographic randomness. This repaired an actual private Story publishing failure in the HTTP preview. Four regression cases cover the fallback, native binding, uniqueness and unavailable randomness.
18. Story viewer audience copy now reflects the actual stored audience, including “Only you can see this story.” for private publications. Group, message, social media, publishing and existing editor/admin UUID consumers retain their prior interfaces.
19. Moved Post reply/delete actions into the existing action row and enlarged all three comment actions to at least 44px high. Removed the obsolete global message appearance block from `polished-experience.css` after the real phone conversation showed white background with white text; the current chat component/theme now owns that surface. Dark chat canvas/bubble colors use shared V32 tokens.
20. Reel export now reports an error if an expected video/audio source cannot connect or play, instead of quietly omitting it. Export media elements unload their sources during cleanup. This last source change passes TypeScript and the Node suite, but its next browser render was blocked by automatic approval review and is not browser-verified.

## Metadata continuation — 26 October 2026

- User requested completion and publication after review of the four-column migration. Isolated PostgreSQL 18.6 WASM (PGlite 0.5.11) accepted the actual migration against current column shapes and passed legacy duration, duration bounds, JSON type/version/size and all-four-column checks. No application dependency was added. The system PostgreSQL installation was unavailable because of sandbox OS identity restrictions; it was not bypassed.
- Applied migration `20261026115830_v32_media_metadata.sql`. All 17 existing RLS policies on the four affected tables are identical before/after. Existing Story records retained seven seconds. No grant, authentication, bucket or access-control change was made.
- New shared typed composition serializer preserves only stable catalog identity, excerpt offset/duration, volume and optional sticker transforms. It rejects invalid excerpts/volumes and omits signed URLs. Story and Post publishing now write it; Reel asset drafts preserve catalog identity and publishing writes actual audio regions, fades, volume and canvas/project identity. Catalog-track volume is now used when attaching audio.
- Actual private Story `d85dd910-a91d-49f3-a505-4fe6b6f7f0d9` stored `visual_duration_seconds=15.000`, private audience and `{schemaVersion:1,audioBakedIn:false}`. Its signed image decoded at 1080×1920. After resume it remained on the same Story after 14.923 seconds, with 0.973347 progress, and paused. Screenshot and database constraint evidence are in `docs/v32/evidence/`.
- Four additional composition cases passed. Current Node suite: **308 total / 307 passed / one existing skip**; TypeScript passed. Final combined `pnpm verify` passed formatting, TypeScript, inventory consistency, zero production dependency audit findings, all 308 tests (307 passed / one existing skip) and a production build in 1.18 seconds. Existing large-chunk warnings remain.
- Actual Reel test imported a three-second MP4 plus eight-second generated WAV, sought to 1.5 and stopped at **3.00** with Replay and the final visual frame. Recorder start now waits until the encoder is active, and final capture reaches the stream before stop. The explicit download produced a real H.264/Opus 1080×1920 MP4: **3.079567 seconds**, audible mean **−23.3 dB**. Encoding padding is 79.567ms; no exact-length or physical Android/Safari compatibility claim is made.
- Browser access resumed. The user social account and separate production **super-admin** session were verified through secure authentication, without inspecting credential values. Production dashboard and `/admin/environment` loaded real records. Environment management reports not ready and all secret writes are disabled. Its project-scoped management-token bootstrap remains an external release blocker. Local preview admin requests are unavailable on that origin; production admin login and session restore work. Unavailable-service copy now avoids incorrectly asserting that an ACTIVE function is undeployed.
- The full shared editor-document consolidation, catalog library features, wider Post video/crop workflows, Tagged data, remaining all-screen/device matrix, provider operations and final publication are still open. The metadata changes above do not make the complete V32 release acceptable by themselves.

## Verification evidence

- Current continuation complete `corepack pnpm verify`: **PASS** — formatting, TypeScript, refreshed inventory consistency, zero production dependency advisories, 304 cases (303 passed / one existing skip) and production build in **973ms**. Existing >500kB chunk warnings remain (largest 571.59kB; main 506.06kB). The review-only PostgreSQL staging script is not part of this Node suite and was not executed.

- Current Node suite: **304 total, 303 passed, 1 existing Windows-specific skip, 0 failures**. The four new cases test secure UUID generation.
- Focused music, Story geometry and Reel timeline tests: **21/21 passed**.
- Final TypeScript check passed after the explicit-download, codec selection, final-frame and recorded-duration changes.
- Previous candidate complete `corepack pnpm verify`: **PASS** — formatting, TypeScript, inventory consistency, production dependency audit, all 300 Node cases (299 pass / one existing skip) and production build. Final Vite build completed in 1.41 seconds in this environment. It still warns about existing chunks above 500kB (largest 571.59kB); no Lighthouse or physical-device performance score was measured.
- Dependency audits now report **zero known findings**, for both `--prod` and the complete graph. The previous candidate had 12 findings (six high); they all came through the unimported legacy Twick graph. Their removal and the Vite update eliminated that graph without audit ignores, suppressed advisories, an unreviewed Fabric major upgrade, or removing the active editors.
- Read-only Supabase security advisors: four WARN entries and one INFO entry. No database schema, grant, policy, provider secret or bucket access was changed. The authenticated acceptance below created three explicitly private QA publications and one reply in the owner account; sign-in/viewing also creates ordinary session/view logs.
- Actual browser: public entry rendered; feed component loaded existing public posts from Supabase; phone, tablet and desktop shell screenshots were inspected. Feed component had matching document client/scroll widths in both themes at the seven requested outer frame sizes. Chromium allocates a 15px scrollbar in these frames, so measured content widths were 305/345/375/397/753/1009/1425; no document horizontal overflow was measured.
- Actual browser Story renderer check: red center pixel `[204,34,51,255]`, green corner pixel `[0,204,136,255]`, PASS. This verifies real renderer output, not a screenshot recoloring.
- Actual browser Reel component: imported a real three-second MP4 and generated permitted WAV fixture, added both to the timeline, sought to 1.5 seconds, played to exactly 3.00 seconds, observed Replay and a retained final visual frame, and restored the local draft after reload. A stale progress-label defect found while seeking was corrected; its complete regression matrix remains required.
- Reel rendering and top-level browser download produced actual files. `ffprobe` and decoded audio inspection confirmed a 1080×1920 video stream and non-silent Opus audio (mean −30.1 dB). The first generic MP4 request chose VP9/Opus and yielded 2.900458 seconds from a three-second composition. After codec preference/final-frame changes, the downloaded MP4 contains H.264/Opus and lasts 2.959875 seconds. This browser did not offer the preferred H.264/AAC pair; cross-device codec/playback and tight export-duration acceptance remain required. Metadata reporting now reads the actual recorded file. Embedded Blob download capture was unsupported; one top-level capture reported cancellation although the automatic export download was saved and inspected. No Safari/Android compatibility claim is made.
- Additional browser matrix: real-public-data Profile component and comment panel each passed seven requested frame sizes in both themes (**28 surface checks**). Profile client/scroll widths matched 305/345/375/397/753/1009/1425, with 13px username metadata and 44px tabs. Opening the dialog locks body scrolling, so its client/scroll widths match the full 320/360/390/412/768/1024/1440 frames; every panel remained within the frame. Real profile media decoded. ArrowRight switched the active tab and panel. Comment Escape dismissal returned focus to the trigger; initial dialog focus stayed inside.
- Authenticated acceptance after the latest handoff: **real private Story, Post and Reel publication passed** for `@veloryz_here`. Story `1a58160e-3f25-4302-bd01-849b58f6353b` is active/private with one persisted image. Its published viewer decoded the actual signed storage image at 1080×1920, not a Blob preview. Post `3631cacd-2259-4a58-94ff-23bacd9825de` is published/private with one persisted 1080×1080 composed image; save and the own-account test reply survived a full reload. Reel `f8c76331-5e9d-4771-acb9-fea8c7e1cfb8` is published/private with actual video and cover rows. Its stored 1080×1920 video decoded, played unmuted after interaction and paused without an error. Decoded duration was **2.941146 seconds** for the intended three seconds, matching persisted `duration_seconds` 2.941 to millisecond precision. This remains an export-timing limitation, not a passing exact-duration claim. The later `downloadMedia` operation returned a path that did not exist; no audio analysis of that particular published file is claimed.
- Anonymous probes used only the existing public publishable key: Story/Story-media/Post/Post-media/Reel/Reel-media queries returned HTTP 200 with **zero rows**, and unsigned Story storage access was denied (HTTP 400). No authenticated session token was extracted or injected. These probes are not a substitute for unrelated-account tests.
- Actual authenticated conversation deep link opened the existing account conversation and its composer. No message or attachment was sent to another person. FORGE local title/code edits, Run and a JavaScript button interaction succeeded in the real isolated preview; account connection showed its actual unavailable state. Editable-export download capture timed out and remains unverified.
- Additional authenticated matrix: conversation, private Post detail and FORGE editor each passed all seven requested frame sizes in both themes (**42 checks, no measured document horizontal overflow**). Chat composer input was 16px and remained inside each frame; the repaired header used dark surface/text (28,16,37)/(250,248,253) and light surface/text (255,255,255)/(33,20,40). Post Like/Reply/Delete controls measured at least 44px high at every width. Evidence: `docs/v32/evidence/authenticated-layouts.json` and the three private-media screenshots in the same folder. These desktop Chromium iframe measurements do not simulate a physical mobile keyboard.
- Automatic approval review blocked the next browser Reel export check because the review usage limit was reached. The tool explicitly says this is a review failure, not a determination that the site/action is unsafe. No retry through another browser, raw CDP, HTTP session replay or other bypass was attempted. Browser validation remains paused.
- The published catalog endpoint returns HTTP 200 with one actual music item. OPTIONS confirms the public VELORI origin is allowed and `http://terminal.local:4173` is not. The preview displays the real fetch failure/retry state; the production CORS policy was not weakened. A temporary development-only public proxy was tested and removed when it did not verify successfully.
- Read-only function inventory currently reports `server` v47, `velori-studio` v2 and `velori-environment` v2 ACTIVE. This does not verify newer local backend changes or end-to-end admin/AI behavior.
- Internal `v32-audit.html`, `v32-components.html` and `src/dev/v32-components.tsx` exercise actual components and explicitly disabled fixture publication. They are development inspection entrypoints, not a production replacement frontend. Vite production output is built only from the original `index.html`.

## Remaining acceptance work

- Catalog-backed photo-Story/Post music publication, selected excerpt and independent sticker metadata; unrelated-account permission-denied/error scenarios and media URL expiry. Basic private Story/Post/Reel publication is now verified as recorded above.
- Two-account messaging, reactions, read receipts, follow/privacy/mention notification flows; actual mobile keyboards and Android Chrome/mobile Safari audio behavior.
- FORGE real generation/import/export/quota enforcement and super-admin environment/configuration/pricing workflows in an authorized QA session. Prior project logs record blocked newer backend changes; this checkpoint did not deploy Edge functions. Existing ACTIVE versions were read back, while their authenticated operational behavior remains unverified.
- Exact exported duration, no missing final frame, audio offsets/fades and cross-browser codec acceptance for the recorded Reel output.
- All-route visual/accessibility matrix, including Story viewer/editor, profile tabs, notifications, messages and admin. The feed/profile/comment matrices and component checks above are not substitutes for this.
- The full shared versioned editor-document architecture is not yet consolidated across the three existing editor data models. Existing draft formats remain readable; new Post soundtrack fields are optional.
- Still-photo duration schema/client repair is now implemented and authenticated publication/viewer timing passed as recorded in the metadata continuation. Physical-device timing and the full all-route matrix remain open.
- Structured soundtrack metadata is now stored by the reviewed additive migration and client serializers. Catalog-backed audio publication and independent sticker removal still require complete end-to-end acceptance on the allowed production origin. See `docs/v32/MEDIA_METADATA_REVIEW.md` for actual migration/test evidence.
- Music Saved/Trending/Recent tab backing, Tagged profile data, broader post video editing/cropping and the complete remaining V32 feature checklist are not newly claimed as implemented.

## Release decision

**Do not deploy this checkpoint as the complete V32 release.** The user explicitly requires successful security checks and authenticated/browser acceptance before publication. Version 29 remains the verified rollback point. Preserve this work in the existing source repository and saved candidate version; finish the listed release gates before deploying that exact source through Sites.

## Current continuation source changes

The UUID helper and declarations/tests; existing UUID consumers in admin appearance/creators, social views, Story publishing/export/state, Post/Reel publishing, group/message media and creator models; Story audience reader/viewer; `src/index.css` comment actions; current chat tokens and retired legacy message styling; Reel export error/cleanup handling; the review-only SQL/tests/review document; this audit/progress/inventory and three screenshot plus JSON evidence files. The comprehensive cumulative file list follows; use Git history for the exact candidate diff.

## Changed source files

Cumulative source changes against the authoritative version-29 commit:

- `VELORI_UI_MASTER.md`
- `docs/VELORI_PROGRESS.md`
- `docs/legal/file-copyright-inventory.md`
- `docs/legal/intellectual-property-inventory.json`
- `docs/legal/intellectual-property-inventory.md`
- `docs/v32/COMPATIBILITY_MAP.md`
- `docs/v32/MEDIA_METADATA_REVIEW.md`
- `docs/v32/RELEASE_AUDIT.md`
- `docs/v32/evidence/authenticated-layouts.json`
- `docs/v32/evidence/private-post.jpg`
- `docs/v32/evidence/private-reel.jpg`
- `docs/v32/evidence/private-story.jpg`
- `index.html`
- `package.json`
- `pnpm-lock.yaml`
- `public/velori-wing-mark.png`
- `src/app/admin-console/navigation.tsx`
- `src/app/admin-console/screens/appearance.tsx`
- `src/app/admin-console/screens/environment.tsx`
- `src/app/admin-console/screens/manage-creators.tsx`
- `src/app/routes.tsx`
- `src/app/shell.tsx`
- `src/app/social-media-pages.tsx`
- `src/app/social-views.tsx`
- `src/app/story-editor-page.tsx`
- `src/app/story-editor.css`
- `src/app/views.tsx`
- `src/components/ViewportRuntime.tsx`
- `src/components/creator-manager/CreatorManagerScreens.tsx`
- `src/components/post-editor/BrandTemplates.tsx`
- `src/components/reel-editor/ReelCanvas.tsx`
- `src/components/reel-editor/ReelStudio.tsx`
- `src/components/reel-editor/ReelTimeline.tsx`
- `src/components/reel-editor/reel-studio.css`
- `src/components/social/ProfilePostGrid.tsx`
- `src/components/social/post-comments.css`
- `src/components/social/profile-post-grid.css`
- `src/components/story-editor/CollaborationPanel.tsx`
- `src/components/story-editor/ExportPublishPanel.tsx`
- `src/components/story-editor/StoryMusicBrowser.tsx`
- `src/components/story-editor/story-studio.css`
- `src/components/studio/MusicPicker.tsx`
- `src/components/studio/SoundtrackTransport.tsx`
- `src/components/studio/music-picker.css`
- `src/design-system/tokens.css`
- `src/dev/v32-components.tsx`
- `src/features/artifacts/studio.css`
- `src/features/chat/chat.css`
- `src/features/creator-studios/components/CreatorStudio.tsx`
- `src/features/creator-studios/components/PostPreviewActions.tsx`
- `src/features/creator-studios/components/PostStudio.tsx`
- `src/features/creator-studios/models.ts`
- `src/features/creator-studios/services/compose-post-media.ts`
- `src/features/creator-studios/services/publishing.ts`
- `src/features/creator-studios/styles/creator-studios.css`
- `src/features/information/information.css`
- `src/features/reels/reels.css`
- `src/features/stories/StoryExperience.tsx`
- `src/features/stories/stories.css`
- `src/index.css`
- `src/lib/group-media.ts`
- `src/lib/message-media.ts`
- `src/lib/music-range.test.ts`
- `src/lib/music-range.ts`
- `src/lib/reel-editor/publish.ts`
- `src/lib/reel-editor/render-reel.ts`
- `src/lib/reel-editor/timeline.test.ts`
- `src/lib/reel-editor/timeline.ts`
- `src/lib/social-media.ts`
- `src/lib/story-editor/editor-state.ts`
- `src/lib/story-editor/export-renderer.ts`
- `src/lib/story-editor/export.mjs`
- `src/lib/story-editor/id.mjs`
- `src/lib/story-editor/media-tools.d.mts`
- `src/lib/story-editor/media-tools.mjs`
- `src/lib/story-editor/media-tools.test.mjs`
- `src/lib/story-publishing.ts`
- `src/lib/studio-catalog.ts`
- `src/lib/theme-settings.tsx`
- `src/lib/uuid.d.mts`
- `src/lib/uuid.mjs`
- `src/lib/uuid.test.mjs`
- `src/main.tsx`
- `src/product/AuthScreen.tsx`
- `src/product/FeedScreen.tsx`
- `src/product/ProductFrame.tsx`
- `src/product/ProfileIdentity.tsx`
- `src/product/StudioHeader.tsx`
- `src/product/WelcomeScreen.tsx`
- `src/product/product.css`
- `src/styles/admin-workspace.css`
- `src/styles/clean-product.css`
- `src/styles/editorial-app.css`
- `src/styles/pink-platform.css`
- `src/styles/polished-experience.css`
- `src/styles/post-studio.css`
- `src/styles/premium-platform.css`
- `src/styles/reference-ui.css`
- `src/styles/responsive-refinement.css`
- `src/styles/social-app-finish.css`
- `src/styles/studio-completion.css`
- `supabase/proposals/20261026_v32_media_metadata.sql`
- `supabase/tests/v32_media_metadata_staging.sql`
- `v32-audit.html`
- `v32-components.html`
- `vite.config.ts`
