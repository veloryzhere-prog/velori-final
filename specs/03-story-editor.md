# Story Editor — Restructure Spec

## Current State

The VELORI project already has a social story flow and viewer experience in `src/app/social-media-pages.tsx`, and shared story/reel media helpers in `src/lib/social-media.ts`. This gives the app a working content-preview model with story cards, viewer transitions, and media validation/upload flows. However, the current implementation is not a true story editor: there is no dedicated canvas, no timeline for slide timing, no interactive sticker system, no brand/story template workflow, and no real multi-slide export or publishing pipeline. The app supports browsing and consuming stories more than producing them, so the story creation experience needs to be rebuilt as a dedicated editor surface instead of being treated as a lightweight composer.

## Target State

The story editor must support:

- 9:16 canvas (1080x1920), up to 10 slides, 15s max per slide
- Slide navigation (swipe/arrows)
- Progress bar preview (simulated IG story timing)
- Safe zones (top 250px, bottom 250px marked)
- Media: photo, video (60s max), GIF, live camera
- Per-slide video: trim, speed (0.5x-2x), reverse, stabilize
- Background: solid, gradient, image, video, pattern
- Multi-image collage (2x2, 1x3, 3x1, custom)
- Background blur (Gaussian)
- Text: 20+ pre-made styles, animated (fade, slide, pop, typewriter, bounce), auto-size
- Interactive stickers: poll, question, quiz, slider, link, countdown, music, mention, location, hashtag
- Sticker library: 1000+ animated + static
- Custom sticker upload (PNG/SVG)
- Logo overlay (configurable position/size/opacity)
- Watermark
- Transitions between slides: fade, slide, zoom, spin, wipe, glitch (0.3s-1.5s)
- Auto-advance timing per slide (3s/5s/10s/15s)
- Loop option
- Audio: background music (per-slide or global), voiceover per slide, crossfade, SFX
- Preview: full story player simulation, slide thumbnail strip, platform UI overlay, interactive element test, dark mode, full-screen
- Collaboration: shared project, slide-level assignment, real-time editing, per-slide comments, approval workflow, version history, client preview link
- Brand consistency check (rule-based)
- Export: MP4 per slide, MP4 full story, individual images
- Direct publish: IG Stories, FB Stories, WhatsApp Status, Telegram
- Scheduling
- Highlight cover design
- Archive option

## Files to Create/Modify

- `src/app/social-media-pages.tsx` — current story viewer and media experience to be expanded into a dedicated story creation flow
- `src/lib/social-media.ts` — story upload validation, signed URL generation, and media-processing utilities
- `src/lib/supabase.ts` — shared Supabase data access for story drafts, media, publish records, and approvals
- `src/app/routes.tsx` — story editor routes and navigation between publishing, preview, and library views
- `src/index.css` — editor layout, timeline, overlays, safe-zone guides, and player styling
- `src/components/story-editor/Canvas.tsx` — story slide canvas and navigation state
- `src/components/story-editor/SlideNavigator.tsx` — thumbnails, progress bars, and slide ordering
- `src/components/story-editor/Toolbar.tsx` — media/text/sticker/background tools
- `src/components/story-editor/StickerLibrary.tsx` — sticker catalog and custom uploads
- `src/components/story-editor/PreviewPlayer.tsx` — full-screen story simulation and platform frame
- `src/components/story-editor/InteractiveLayer.tsx` — poll/quiz/link/countdown sticker interactions
- `src/components/story-editor/AudioPanel.tsx` — music, voiceover, SFX, and crossfade controls
- `src/components/story-editor/BrandCheckPanel.tsx` — brand consistency, watermark, and logo checks
- `src/lib/story-editor/types.ts` — story, slide, sticker, and audio data contracts
- `src/lib/story-editor/state.ts` — slide ordering, timing, transitions, and preview state management
- `src/lib/story-editor/export.ts` — MP4/image export and publishing helpers
- `src/lib/story-editor/collab.ts` — shared editor state and comment/version tracking
- `src/app/editor/story/[id]/page.tsx` — dedicated story editor page

## Phases

1. Data model + types (Story, Slide, Sticker, AudioTrack)
2. Canvas + slide navigation
3. Media tools (photo, video, GIF, collage)
4. Text + animated text
5. Interactive stickers (poll, quiz, link, etc.)
6. Transitions + timing
7. Audio (music, voiceover, SFX, crossfade)
8. Preview system (story player simulation, platform UI)
9. Collaboration (real-time, comments, versions, approval)
10. Export + publish
11. Templates + brand kit
12. Polish

## Acceptance Criteria

- [ ] Create 5-slide story with mixed media + interactive poll
- [ ] Preview plays with correct timing + transitions
- [ ] Poll is clickable in preview
- [ ] Export as MP4 → correct 1080x1920, correct duration
- [ ] Two users edit different slides simultaneously → no conflicts
- [ ] All existing tests pass

### Phase 1 Implementation Notes

- Added SQLite-backed Prisma models for stories, story slides, stickers, story audio tracks, slide transitions, and story-specific brand overrides. Existing post slides, reel audio tracks, and reel transitions retain their original table names and data through explicit Prisma mappings; new story slide/audio/transition tables use distinct physical names to avoid collisions.
- Added TypeScript contracts and a validated CRUD request-handler API for stories and nested slide, sticker, audio, transition, and brand-override resources. The API follows the repository's existing in-memory editor API adapter pattern; durable storage is represented by the Prisma schema, while database-backed HTTP deployment is outside this phase's current app/server architecture.
- Applied the additive local SQLite development migration `add_story_editor_models`; no remote Supabase schema or database was changed.

### Phase 2 Implementation Notes

- Added the dedicated `/stories/create` Story Studio route and linked it from the existing Stories page without changing its publishing flow.
- Implemented the 1080 × 1920 (9:16) canvas, slide thumbnails below the canvas, add/remove/select navigation capped at 10 slides, touch swipe and keyboard arrow navigation, and the 250 px top/bottom safe-zone and story tap-area overlays.
- Added a preview transport that simulates 15 seconds per slide and advances through the story, plus visibility toggles for safe-zone and tap-area guides.
- Canvas/storyboard draft state is currently held in the editor session; durable editor persistence and media authoring are outside this phase.

### Phase 3 Implementation Notes

- Added browser-validated JPEG, PNG, WebP, GIF, and MP4 uploads (100 MB maximum), per-slide image transforms and CSS filters, video metadata validation and trim/speed/reverse preview, and live camera photo capture.
- Added solid, gradient, patterned, image, and video backgrounds; 1–4 image collage layouts; and configurable Gaussian background blur. Storyboard thumbnails now reflect uploaded slide media.
- Source files and edits remain in local editor state and browser object URLs; the editor revokes replaced/deleted assets and cleans up remaining URLs when unmounted. Video stabilization currently applies a small preview crop only; motion-analysis stabilization requires a rendering pipeline.
- Added unit coverage for media header validation, file size limits, trim bounds, collage grids, and filter construction.

### Phase 4 Implementation Notes

- Added a slide-scoped text overlay layer with 24 editable text styles, typography controls, animation selection (fade, slide, pop, typewriter, bounce), per-slide start time and animation duration, position presets, and auto-fit to the selected text area.
- Text animation is driven by the Story Studio preview clock. Text layout and style state remain in the current editor session, consistent with the existing Phase 2 draft-state boundary.

### Phase 6 Implementation Notes

- Added per-slide outgoing fade, slide, zoom, spin, wipe, and glitch transitions with a duration control clamped to 0.3–1.5 seconds. Transitions run during automatic preview advance and manual slide navigation, reversing direction when navigating backward.
- Added 3-, 5-, 10-, and 15-second auto-advance durations per slide; the preview clock, transport countdown, and progress bar follow each slide’s selected duration.
- Added an individual slide loop and a whole-story loop. A slide loop repeats the current slide; a story loop advances from the final slide back to the first. These editor settings remain session-scoped and introduce no schema or dependency changes.
- Added navigation-helper tests for per-slide progress and both loop behaviors.

### Phase 5 Implementation Notes

- Added slide-scoped poll, question, quiz, reaction slider, link, live countdown, music, mention, location, and hashtag stickers. Poll options/results and quiz options/correct answer are editable; polls, quizzes, sliders, and question replies can be tested in the canvas preview.
- Added a searchable, category-filtered library of more than 2,000 static and CSS-animated emoji stickers, plus PNG/SVG custom sticker upload with SVG script, event-handler, and external-resource sanitation.
- Added configurable logo positioning, size, and opacity plus an editable watermark overlay. Sticker positions, size, and rotation are configurable; custom asset object URLs are revoked on sticker deletion, slide deletion, logo replacement/removal, or editor unmount.
- Sticker and brand overlay edits are kept in the current editor session; Phase 5 does not change the database schema or add dependencies.

### Phase 8 Implementation Notes

- The Story Studio preview plays the full ordered story using slide durations, auto-advance, and each slide's configured outgoing transition. The horizontal storyboard strip remains directly below the preview; selecting a thumbnail jumps to that slide.
- Added simulated story platform chrome with a profile avatar/name, Sponsored label, segmented progress, close control, and reply field. Polls, quizzes, sliders, and safe HTTP(S) links can be exercised with the Test interactions toggle.
- Added a browser Fullscreen API immersive mode with in-preview pause/exit controls, a scoped dark theme, and an export estimate for total duration, slide count, and approximate H.264 file size. Size uses an explicit 1080 × 1920, 4.2 Mbps video + 192 kbps audio estimate and is not a rendered-file guarantee.

### Phase 9 Implementation Notes

- Added shared-project links, per-slide assignment and comments, approval status actions, per-slide/project version snapshots with restore, and configurable rule-based text color/font checks.
- Story state and collaboration events synchronize between tabs on the same browser origin using local storage and `BroadcastChannel`. Per-slide revisions merge independent slide edits; same-slide edits use last-write-wins ordering and deletion tombstones.
- Client preview opens the saved story in a read-only, autoplaying player view. This implementation is deliberately browser-local: links require the same browser profile and origin, and uploaded `blob:` media remains available only while its creating browser context stays alive. Cross-device collaboration, authenticated role enforcement, durable server versions/comments, and cloud-hosted media are not provided because database/schema and backend access-control changes were not authorized.

### Phase 10 Implementation Notes

- Added browser-canvas PNG export for each slide and a PNG highlight cover, plus a real-time canvas/MediaRecorder MP4 path for individual slides and the complete story at 720×1280 or 1080×1920. Export progress is shown, and files use actual generated size and descriptive names. MP4 is offered only when the current browser reports MP4 recording support; unsupported browsers are not given a mislabeled WebM fallback.
- Browser MP4 rendering reproduces slide media, transforms, collage, text, sticker labels, logo, and watermark. It does not mix configured audio tracks or encode configured transitions; those require a server-side compositor/FFmpeg story renderer, which is not configured for Story Studio.
- Added platform handoff buttons for Instagram, Facebook, WhatsApp, and Telegram. They use the native file share sheet when available or open the platform; publishing still requires the user to confirm there because this project has no authorized platform publishing integration or credentials.
- Added timezone-aware local reminder scheduling, highlight-cover metadata, and local draft archiving in the existing browser collaboration snapshot. Reminders are not durable server jobs and do not auto-publish; archive does not alter a published story.
- Added unit tests for supported output dimensions, timezone conversion and validation (including daylight-saving gaps), export filenames, and MP4 capability detection. No database schema or dependency changes were made.

### Phase 11 Implementation Notes

- Added current-slide story template presets for promos, behind-the-scenes, announcements, and poll campaigns. Applying a template replaces that slide's text and background color after confirmation, preserves its media and existing stickers, and adds a configurable two-option poll sticker for poll campaigns.
- Added a browser-local brand kit with a named primary/secondary/accent palette, font selection, explicit apply action, and auto-apply option for text and solid slide backgrounds. Existing uploaded logo and watermark are reused through the Brand Kit's existing logo overlay tools.
- Added persisted template locks for logo position and template/text colors. Locked logo position sliders and text/palette color controls are disabled; editor handlers also reject prohibited changes. Other colors can be changed by unlocking. Brand kit and lock settings synchronize and persist in the same browser-local Story Studio project snapshot.
- Added unit coverage for the four template types, brand-style application, color-lock preservation, and unsupported template errors. No database schema or dependency changes were made.

### Phase 12 Implementation Notes

- Added keyboard controls for previous/next and first/last slide, play/pause, deleting the selected text or sticker, and exiting immersive preview. Inputs, text fields, buttons, and modified shortcuts do not trigger editor commands; client preview remains read-only.
- Preview animation time now advances in a canvas-local `requestAnimationFrame` loop, while project-level timeline state updates at a lower cadence to avoid re-rendering the entire editor 60 times per second. Video synchronization is separately throttled.
- Added a dismissible global error/status alert and a first-run quick-start guide persisted in the local project snapshot. Existing camera, media, collaboration, export, and storage failures retain their specific messages and recovery guidance.
- Added keyboard shortcut tests. No database schema or dependency changes were made.
