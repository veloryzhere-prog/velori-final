# Reel Editor — Restructure Spec

## Current State

The current VELORI app already includes reel and story viewing flows in `src/app/social-media-pages.tsx`, plus shared media validation and signed upload logic in `src/lib/social-media.ts`. There is also a working post creation and publishing baseline in `src/app/views.tsx` and media helpers in `src/lib/post-media.ts`, which gives the project a functional social-content foundation. However, the current implementation is not a true professional reel editor: there is no multi-track timeline, no frame-accurate trimming or keyframing system, no color grading stack, no audio mix engine, and no dedicated export pipeline for platform-ready reels. The current code supports social browsing and upload-validation more than advanced creative editing, so the project needs a dedicated editor architecture rather than incremental UI tweaks.

## Target State

The reel editor must support:

- Multi-track timeline: 4 video + 4 audio + 2 text/overlay tracks
- Frame-accurate editing (1/30s or 1/60s), timecode display
- Edit types: ripple, roll, slip, slide
- Speed: 0.1x to 4x with smooth ramps
- Clip tools: trim, split, crop, reframe (9:16/1:1/16:9), rotate, flip, stabilize
- Keyframing: position, scale, rotation, opacity, crop
- Chroma key (green screen) with tolerance + edge softness
- Masking: rectangle, ellipse, polygon, bezier
- Picture-in-Picture layering
- Freeze frame, loop
- Transitions: 50+ (cut, fade, dissolve, slide, wipe, zoom, spin, glitch, morph)
- Video effects: blur, sharpen, noise, vignette, letterbox, color grade
- Color grading: wheels, curves, HSL, LUT (.cube)
- Text: 30+ animations, caption styling, SRT/VTT import, caption presets
- Sticker overlays: animated stickers, emojis, GIFs
- Audio: music library (10k+), SFX library (500+), voiceover recording, waveform display
- Audio controls: volume, fade, ducking, 5-band EQ, compressor, limiter, beat sync
- Markers & chapters
- Beat detection + snap to beat
- Preview: real-time playback (0.25x-2x), frame stepping, platform frame (IG/TikTok/Shorts UI), audio VU meters, safe area overlay, thumbnail selection
- Collaboration: shared project, real-time co-edit, timeline comments, annotation drawing, version compare, approval workflow, client review link
- Templates: 500+ pre-made reel templates
- Export: MP4 (H.264/H.265), MOV (ProRes), 720p/1080p/4K, 24/25/30/60fps, CBR/VBR
- Direct publish to IG Reels, TikTok, YouTube Shorts, FB Reels
- Scheduling with timezone

## Files to Create/Modify

- `src/app/social-media-pages.tsx` — existing reels/story viewer flows to be evolved into a dedicated editing and preview workflow
- `src/lib/social-media.ts` — media validation, upload, signing, and reel-specific processing hooks
- `src/lib/supabase.ts` — shared Supabase access for reel projects, clips, exports, and publish metadata
- `src/app/routes.tsx` — reel editor page routes and navigation to create/edit projects
- `src/index.css` — timeline, controls, preview, transport, and editor chrome styling
- `src/components/reel-editor/Timeline.tsx` — multi-track timeline and playhead interactions
- `src/components/reel-editor/TransportControls.tsx` — playback, scrub, marker, and preview controls
- `src/components/reel-editor/ClipInspector.tsx` — trim, crop, speed, effect, and keyframe settings
- `src/components/reel-editor/PreviewCanvas.tsx` — real-time player surface with safe area and platform frame
- `src/components/reel-editor/OverlayPanel.tsx` — text, stickers, captions, and overlay controls
- `src/components/reel-editor/AudioPanel.tsx` — waveform, music library, voiceover, mixing controls
- `src/components/reel-editor/ColorPanel.tsx` — grade wheels, LUT, curves, HSL adjustments
- `src/components/reel-editor/TemplateLibrary.tsx` — saved reel presets and starter templates
- `src/components/reel-editor/CollaborationPanel.tsx` — comments, version handling, review states
- `src/lib/reel-editor/types.ts` — project, track, clip, and keyframe schema contracts
- `src/lib/reel-editor/engine.ts` — time/audio/video state orchestration and playback logic
- `src/lib/reel-editor/keyframes.ts` — interpolation and animation curve handling
- `src/lib/reel-editor/effects.ts` — transitions, masking, filters, and LUT processing
- `src/lib/reel-editor/export.ts` — FFmpeg/MOV/MP4 export and publish pipeline
- `src/app/editor/reel/[id]/page.tsx` — dedicated reel editor page
- `prisma/schema.prisma` — relational data models for reel projects and editing assets
- `src/lib/reel-editor/api.mjs` — project, track, and clip CRUD request-handler adapter following the existing post-editor pattern
- `src/lib/reel-editor/api.test.mjs` — CRUD unit tests for reel editor data
- `src/components/reel-editor/Timeline.tsx` — multi-track timeline, playhead, frame stepping, scrubbing, zoom, and clip selection
- `src/components/reel-editor/TimelineTrack.tsx` — memoized track and clip thumbnail rendering
- `src/components/reel-editor/TimelineToolbar.tsx` — timecode, frame-step, zoom, and fit controls
- `src/components/reel-editor/TimelineRuler.tsx` — adaptive, bounded ruler ticks
- `src/components/reel-editor/useTimelineScrubbing.ts` — pointer scrubbing and keyboard frame-step handlers
- `src/components/reel-editor/Timeline.css` — responsive timeline styles
- `src/lib/reel-editor/engine.mjs` — timeline lane, ruler, timecode, snapping, zoom geometry, and frame stepping helpers
- `src/lib/reel-editor/engine.d.mts` — TypeScript declarations for the tested timeline engine
- `src/lib/reel-editor/engine.test.mjs` — timeline behavior and 100+ clip load tests
- `src/lib/reel-editor/clip-editing.mjs` — trim, split, ripple/roll/slip/slide, speed ramps, reframing, keyframes, and clip effect metadata operations
- `src/lib/reel-editor/clip-editing.d.mts` — TypeScript declarations for clip editing operations
- `src/lib/reel-editor/clip-editing.test.mjs` — unit tests for clip editing operations and source/media bounds
- `src/components/reel-editor/TimelineClip.tsx` — selectable clips with trim handles and slip/slide gestures
- `src/components/reel-editor/ClipInspector.tsx` — selected clip inspector with keyframe and stabilization controls
- `src/components/reel-editor/ClipInspectorTransform.tsx` — timing, speed/ramp, crop, reframe, and transform controls
- `src/components/reel-editor/ClipInspectorMotion.tsx` — position, scale, and opacity controls
- `src/components/reel-editor/ClipInspectorEffects.tsx` — chroma-key, mask, and PiP metadata controls
- `src/components/reel-editor/ClipInspector.css` — responsive clip inspector styles
- `src/lib/reel-editor/effects.mjs` — transition catalogue, timing/config normalization, scoped video effects, and effect lookup helpers
- `src/lib/reel-editor/effects.d.mts` — TypeScript contracts for transition/effect utilities
- `src/lib/reel-editor/effects.test.mjs` — transition catalogue, validation, effect scope, and parameter tests
- `src/components/reel-editor/TransitionEffectsPanel.tsx` — project transition/effect editor mounted through the clip inspector
- `src/components/reel-editor/TransitionControls.tsx` — adjacent-clip transition type, duration, direction, and easing controls
- `src/components/reel-editor/VideoEffectsControls.tsx` — blur, sharpen, noise, vignette, and letterbox controls with clip/project scope
- `src/lib/reel-editor/api.mjs` — in-memory project-scoped transition and effect CRUD
- `src/lib/reel-editor/api.test.mjs` — transition/effect CRUD and validation coverage
- `src/lib/reel-editor/color-grading.mjs` — grading defaults/normalization, clip/global grades, preset storage, and safe 1D/3D `.cube` LUT parsing
- `src/lib/reel-editor/color-grading.d.mts` — typed contracts for grading data, LUT parsing, and presets
- `src/lib/reel-editor/color-grading.test.mjs` — wheels/curves/HSL validation, LUT parsing, and preset tests
- `src/components/reel-editor/ColorGradingControls.tsx` — clip/project grading scope and coordination
- `src/components/reel-editor/ColorGradeWheels.tsx` — lift, gamma, and gain color balance and level controls
- `src/components/reel-editor/ColorGradeCurves.tsx` — master RGB and channel curve selection
- `src/components/reel-editor/ColorCurveEditor.tsx` — editable curve points with pointer and keyboard input
- `src/components/reel-editor/ColorGradeHsl.tsx` — per-range hue, saturation, and luminance controls
- `src/components/reel-editor/ColorGradeLutControls.tsx` — validated `.cube` import and LUT removal
- `src/components/reel-editor/ColorGradePresetControls.tsx` — project color-grade preset save/load
- `src/lib/reel-editor/captions-overlays.mjs` — 40+ animation choices, caption styling/timing normalization, SRT/VTT parsing, caption presets, overlay validation, and progress/callout helpers
- `src/lib/reel-editor/captions-overlays.d.mts` — TypeScript declarations for caption, preset, and overlay utilities
- `src/lib/reel-editor/captions-overlays.test.mjs` — animation, style, caption import, preset, overlay, and progress tests
- `src/components/reel-editor/CaptionsOverlaysPanel.tsx` — combined text/caption and overlay editing panels
- `src/components/reel-editor/CaptionsControls.tsx` — timed manual captions, SRT/VTT import, styling, animations, and presets
- `src/components/reel-editor/CaptionStyleControls.tsx` — typography, color, background, stroke, shadow, alignment, and placement controls
- `src/components/reel-editor/OverlayControls.tsx` — emoji/GIF/sticker metadata, position/timing, progress bars, and callout arrows
- `src/components/reel-editor/ClipInspector.tsx` — mounts caption and overlay controls when project state callbacks are provided
- `src/lib/reel-editor/api.mjs` — project-level caption, preset, and overlay validation/persistence
- `src/lib/reel-editor/api.test.mjs` — persistence and invalid-data coverage for text and overlay project state
- `src/lib/reel-editor/audio-engine.mjs` — validated audio track/library models, search filters, waveform peaks, transient beat detection, beat snapping, fades/crossfades, ducking/EQ/dynamics settings, and Web Audio processing chain
- `src/lib/reel-editor/audio-engine.d.mts` — TypeScript declarations for audio engine helpers
- `src/lib/reel-editor/audio-engine.test.mjs` — audio search, waveform, beat, crossfade, solo, fade, and noise-gate tests
- `src/components/reel-editor/AudioEnginePanel.tsx` — integrated music/SFX library, voiceover recorder, and per-track controls
- `src/components/reel-editor/AudioLibraryControls.tsx` — local audio import, mood/genre/tempo/duration filtering, waveform and beat analysis, and timeline insertion
- `src/components/reel-editor/VoiceoverRecorder.tsx` — microphone capture with browser noise suppression and echo cancellation
- `src/components/reel-editor/AudioTrackControls.tsx` — volume, fades, manual ducking, crossfades, mute/solo, and track selection
- `src/components/reel-editor/AudioProcessingControls.tsx` — 5-band EQ, noise gate, compressor, and limiter settings
- `src/components/reel-editor/AudioEngine.css` — responsive audio engine controls
- `src/components/reel-editor/TimelineClip.tsx` — audio waveform rendering in timeline clips
- `src/components/reel-editor/Timeline.tsx` and `src/components/reel-editor/useTimelineScrubbing.ts` — toggleable snap-to-beat while scrubbing
- `src/lib/reel-editor/api.mjs` and `src/lib/reel-editor/api.test.mjs` — project audio library persistence and audio-track CRUD

## Phases

1. Data model + types (Project, Track, Clip, Keyframe, AudioTrack)
2. Timeline engine (multi-track rendering, playhead, scrubbing)
3. Clip editing (trim, split, speed, crop, reframe)
4. Transitions + effects (transition catalogue, timing/direction/easing settings, project/clip-scoped effect settings; preview/export rendering remains in the later pipeline)
5. Color grading (lift/gamma/gain, RGB/channel curves, eight HSL ranges, 1D/3D `.cube` LUT import, and reusable project presets; pixel rendering remains a compositor responsibility)
6. Text + captions + overlays (40+ animation choices, manual and SRT/VTT captions, reusable caption styles, and timed sticker/emoji/GIF/progress/callout metadata; video compositing remains a renderer responsibility)
7. Audio engine (searchable project music/SFX libraries, voiceover capture, waveform/beat analysis, volume/fades, manual ducking, 5-band EQ, gate/compressor/limiter, crossfade and mute/solo controls; source media URLs are temporary until connected to persistent storage, and final mix rendering remains in the later playback/export pipeline)
8. Preview system (platform frames, VU meters, safe areas)
9. Collaboration (real-time session comments, annotations, assignments, review workflow, activity and media metadata; durable roles, project state and client reviews require a dedicated schema)
10. Export pipeline (FFmpeg server-side)
11. Templates + presets
12. Polish (keyboard shortcuts, preview performance, error recovery, onboarding)

## Acceptance Criteria

- [ ] Import 3 clips, arrange on timeline, add transition between each
- [ ] Add animated text with 3 keyframes
- [ ] Apply LUT + adjust wheels
- [ ] Export 1080x1920 MP4 at 30fps → correct file
- [ ] Two users on same project → no conflicts
- [ ] All existing tests pass

### Phase 8 Implementation Notes

- The reel creation studio mounts the preview monitor with Instagram Reels, TikTok, and YouTube Shorts frames, safe-area controls, A/B track comparison, 0.25×–2× playback, frame stepping, and a selectable timeline thumbnail time.
- Audio preview follows track timing, solo/mute, volume, fades, and crossfades. Its VU display is explicitly an estimate derived from analyzed waveform peaks, not a live Web Audio analyser; audio clipping is flagged from that estimate.
- The export panel reports estimated bitrate and file size and tracks preview position only. Encoding progress, rendered effects, and final export remain unavailable until the export/compositor pipeline is implemented.
- Selecting a preview frame in the reel creation flow captures a JPEG cover image for the existing publish path. The project API also validates and preserves selected-frame metadata when callers save editor projects.
- The export surface now submits the selected MP4 source clip (including its source trim) to an authenticated Supabase Edge Function and polls a separately deployable FFmpeg worker for real progress. The worker supports MP4/H.264 or H.265 and MOV/ProRes, 720p/1080p/4K, 24/25/30/60 fps, CBR/VBR for H.264/H.265, audio codec/sample-rate/channel choices, 9:16/1:1/16:9/4:5 framing, thumbnail frame extraction, and an optional text overlay. The rendered video and JPEG thumbnail stream back through the authenticated Edge Function; the temporary input uses a user-scoped signed upload in the existing private reel bucket.
- Phase 10 is a single-source-clip renderer, not a timeline compositor: source trim and audio are retained, but clip speed/transforms, multi-clip timelines, separate audio tracks, transitions, effects, captions, and editor overlays are not merged. The FFmpeg worker and its persistent output directory must be deployed separately and configured with `VELORI_FFMPEG_RENDERER_URL`, `VELORI_FFMPEG_RENDERER_TOKEN`, and `SUPABASE_URL`; without these, the UI reports export as unavailable rather than simulating progress. Worker job state is in memory and completed output files are retained for 24 hours.

### Phase 11 Implementation Notes

- Added 600 generated, categorized reel starter templates, each with title/caption defaults, duration, footage-slot count, and transition, color-grade, caption-style, and audio preset references. The studio browser supports search, category filtering, text customization, and replacement-footage/music selection.
- Added 32 built-in reusable preset configurations and validated save/load helpers for transition, color-grading, caption-style, and audio settings. User presets are capped at 100 per collection and can be replaced by name/category.
- No schema or dependency changes were made. The existing quick-publish path applies template text and one replacement video, but does not mix a selected replacement music file; the Phase 10 worker currently renders one video source and cannot compose the timeline or separate audio tracks.

### Phase 12 Implementation Notes

- The focused timeline supports ←/→ frame stepping, Ctrl/⌘+B split, Ctrl/⌘+plus/equal and minus zoom, and Ctrl/⌘+0 fit. The focused preview supports Space play/pause, ←/→ frame stepping, Shift+←/→ one-second seeking, and Home/End jumps. Shortcuts are ignored while focus is in form controls and are shown in the editor.
- Empty timelines display a getting-started guide; timeline edit errors and preview playback/media errors are announced accessibly, with dismiss or retry actions where recovery is meaningful.
- Preview media uses metadata-only preload, paint/layout containment, and a translated compositing layer with `will-change` as a GPU acceleration hint. Actual hardware acceleration remains controlled by the browser/device and is not guaranteed.
- No database schema or dependency changes were needed.

### Phase 9 Implementation Notes

- The reel creation studio supports live Supabase Broadcast/Presence sessions for participants with the same session link. Session events include timecode comments, preview drawing annotations, task assignments, review/approval state, version metadata, change activity and media-bin metadata. Event snapshots synchronize current session state; duplicate events are removed and conflicting mutable records use a deterministic last-write-wins rule.
- A shared URL can assign a UI role, and client/viewer roles receive read-only controls except client review comments. This role check is client-side workflow guidance, not authorization.
- In accordance with the project boundary against unapproved database changes, Phase 9 does not add collaboration tables, RLS or durable project storage. The session channel is temporary; roles, versions, comments, tasks, annotations and activity are not persisted. Shared media transfers metadata only, not media files. Version comparison is metadata with the same current playhead, not playback of archived media.
- A durable and permission-enforced shared project, reliable client review link, real-time project-state conflict resolution, and transferable shared media require a dedicated reel-collaboration storage/RLS design before those capabilities can be called production-ready.
