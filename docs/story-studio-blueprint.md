# VELORI Story Studio — Implementation Blueprint

**Stage:** 1 — proposed design and implementation sequence  
**Status:** Blueprint only. Do not treat this document as implementation approval or as evidence that proposed behavior already exists.

**Implementation addendum:** Stage 2 supplies shared text/sticker/shape manipulation, layer ordering and undo/redo. The device-selector stage retained the single Story Studio route and shared `StoryEditorPage` state while preserving Computer Studio and adding a phone-first mobile presentation. The Android UX follow-up reduces primary tools, collapses the storyboard by default and adds a mobile review/publish step that reuses the existing Stories publisher. Freehand drawing, durable local media drafts, preview/export filter parity and audio-preserving video export remain future work; this work does not authorize Stage 3.

## Product and engineering boundaries

- Improve the existing Story creation and editing experience only. Keep `/stories/create`, `/stories`, `/stories/archive`, the existing application shell, and the story viewer.
- Keep the current Stories page's Supabase publisher as the only native publishing path. The richer Studio must call or share that existing path; do not create a parallel story service or route.
- Preserve authentication, story ownership, audience checks, expiration, moderation, RLS and private storage behavior. A client-side audience selection is not authorization.
- Keep the original media separate from editable overlays. Do not overwrite the source asset while editing.
- Do not upload each edit or intermediate preview. Upload only the final validated publish asset through the existing flow after an explicit publish action.
- Do not add a canvas/media dependency until a concrete compatibility gap is demonstrated. The current DOM preview and Canvas2D export are sufficient starting points if they consume the same scene description.
- Do not modify database schema or storage policies in this plan. If later evidence shows server-side draft persistence is required, document its privacy and migration design and ask for approval before changing schema.
- Reels and Posts are out of scope.

## Proposed interface

### Shared editor shell

- **Top bar:** Back to the existing stories destination; project title and clear saved/unsaved state; undo and redo; Preview; and a prominent, clearly named Publish action. On small screens, keep title and primary actions visible without horizontal scrolling.
- **Main stage:** Large central 9:16 media canvas with safe-zone guides, selected-object handles, loading/error/empty states and a clear media-add affordance. The preview remains the visual priority.
- **Tool rail:** Compact, labeled Media, Text, Draw, Stickers, Adjust, and Layers actions. Music/Timing and templates remain contextual secondary tools, rather than displacing core editing controls.
- **Contextual properties:** One selected tool/object at a time. Desktop uses a compact side panel beside the canvas; phone uses a bottom sheet that can be dismissed without losing selection. Avoid permanently reserving canvas width for empty panels.
- **Layer manager:** A compact ordered list of scene objects with type icon, label, visibility, lock and reorder affordances. Selecting a row selects and scrolls the corresponding canvas object into view.
- **Slide strip:** A horizontally scrollable, accessible storyboard with add, select, reorder and delete actions. Keep the active slide and total count clear.
- **Preview/publish:** Preview is a non-editing playback mode with close, pause and slide navigation. Publish is a separate confirmation/progress flow that shows the existing audience choices, final preview, upload progress and actionable errors.

### Responsive behavior

- **Desktop/tablet:** Use a centered workspace with a flexible canvas column and a bounded contextual panel. Keep the slide strip below the canvas and preserve the existing shell/navigation behavior.
- **Phone:** Use a compact top bar, a canvas sized to the available viewport height and width, bottom tool rail, bottom-sheet properties and a horizontally scrollable slide strip. Do not force fixed minimum widths larger than the viewport. Prevent the shell/header and tool strip from increasing document `scrollWidth`.
- Editing handles must meet touch-target requirements; all canvas gestures also need keyboard-accessible alternatives in the properties/layer list.
- Respect `prefers-reduced-motion`; editing must not depend on an animation to communicate selection, saving or errors.

## Tool behavior

| Tool               | Selection behavior                                                                                                                                                                      | Contextual controls                                                                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Media              | Choose an image/video or create a supported collage; preserve the original source reference. Replacing media is explicit and confirms whether existing crop settings should carry over. | Add/replace, crop, rotate, flip, zoom, fit/fill, source details, and validation feedback.                                                                        |
| Text               | Create an editable text object and focus its text entry; direct selection on canvas activates transform handles.                                                                        | Content, font/style, size, color, alignment, background/stroke/shadow, animation, timing and deletion.                                                           |
| Draw               | Enter a drawing mode that captures pointer/touch paths on the canvas. A visible mode indicator prevents accidental slide swipes.                                                        | Pen/highlighter, color, width, opacity, eraser, clear-with-confirmation and undo/redo.                                                                           |
| Stickers           | Open the existing sticker catalogue; selecting a decorative sticker creates a scene object. Interactive poll/question/etc. stickers remain interactive only in Preview.                 | Type-specific values, size/rotation, timing, visibility, ordering and removal. Preserve current SVG/image sanitization.                                          |
| Adjust             | Keep transforms attached to the original media object rather than baking them into the source.                                                                                          | Crop/position/zoom, rotation/flip, brightness/contrast/saturation, blur and supported filter presets.                                                            |
| Layers             | Show every editable text, sticker, drawing and other overlay in z-order. Selecting a row selects its object on canvas.                                                                  | Reorder, hide/show, lock/unlock, rename where applicable and delete.                                                                                             |
| Timing / Music     | Edit slide duration and existing clip controls without leaving the canvas.                                                                                                              | Video trim/speed/reverse only when supported; display the existing duration limits and explicit export support. Audio mixing is not promised until verified.     |
| Layout / templates | Apply a template as editable scene objects rather than flattening the composition.                                                                                                      | Choose template, manage brand styles and edit/lock template-provided objects.                                                                                    |
| Preview            | Enter a read-only playback state. Gestures change slides, not object transforms.                                                                                                        | Play/pause, previous/next, exit; show media and export errors without hiding them.                                                                               |
| Publish            | Confirm final composition and existing audience before uploading.                                                                                                                       | Existing audience options, progress, cancel where safe, retryable errors and success navigation into the existing story viewer. No alternate publishing backend. |

## Editable scene model

Use a versioned scene model as the single source of truth for editing. Preserve `Slide` compatibility while migrating its current text/sticker fields into a unified ordered overlay list.

```ts
type StoryObjectKind = "text" | "sticker" | "drawing" | "shape";

interface StoryScene {
  version: 1;
  id: string;
  canvas: { aspectRatio: number };
  source: {
    assetId: string;
    kind: "image" | "video";
    mimeType: string;
    originalRef: string;
    width: number;
    height: number;
    durationMs?: number;
    crop: { x: number; y: number; zoom: number; rotation: number; flipX: boolean; flipY: boolean };
  };
  objects: StoryObject[];
  durationMs: number;
  background?: { color?: string; effect?: string };
}

interface StoryObjectBase {
  id: string;
  kind: StoryObjectKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  startMs: number;
  endMs: number;
}

type StoryObject =
  | (StoryObjectBase & { kind: "text"; content: string; style: StoryTextStyle })
  | (StoryObjectBase & {
      kind: "sticker";
      stickerType: string;
      config: StoryStickerConfig;
      assetRef?: string;
    })
  | (StoryObjectBase & { kind: "drawing"; strokes: StoryStroke[] })
  | (StoryObjectBase & { kind: "shape"; shape: string; style: StoryShapeStyle });

interface StoryTextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
}

interface StoryStickerConfig {
  text?: string;
  options?: string[];
  selectedOption?: number;
}

interface StoryStroke {
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  opacity: number;
}

interface StoryShapeStyle {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}
```

`x`, `y`, `width` and `height` are normalized to the 9:16 scene: `x` and `y` are the object's top-left position; dimensions are fractions of scene width and height; positions are clamped so an object's defined bounds remain addressable. Store rotation in degrees around the object center. Preserve aspect ratio for stickers unless the object type explicitly permits distortion. A drawing stores normalized path points and width relative to scene width.

Use a discriminated union with concrete property types when implementing; the illustrative properties above must be reconciled with existing typed text/sticker configuration rather than used to weaken type safety. Add stable migration/serialization tests for existing projects.

### Coordinate mapping

For a canvas whose visible content exactly matches the scene aspect ratio, obtain its `getBoundingClientRect()` and map a pointer location `(clientX, clientY)` to:

```text
u = (clientX - rect.left) / rect.width
v = (clientY - rect.top) / rect.height
```

Clamp values according to the operation (for example, pointer selection versus object movement). Convert back to export pixels using `pixelX = u * outputWidth`, `pixelY = v * outputHeight`, and the same scaling for width and height. If the canvas is letterboxed, first compute the displayed content rectangle inside the outer frame and use that rectangle for both pointer and export mapping. Test rotation around the object's center and use pointer capture so a drag remains stable outside the original bounds.

Store source crop/rotation separately from overlay transforms. This prevents overlay geometry from changing when the source is reframed and makes the original media recoverable.

## Preview and export architecture

1. Keep one typed scene as the authority for media transforms, overlays, ordering, timing and supported visual adjustments.
2. Keep the live editor/preview DOM-based initially for native video playback, accessible text and interactive controls. Make the scene renderer—not duplicated component state—the source of each visible property.
3. Keep Canvas2D as the initial still-image/video-frame export path. Add a renderer adapter that consumes the same scene and effect values; load required images/fonts before rendering and surface unavailable resources as explicit errors.
4. Represent filters as a shared, typed set of values. Test CSS preview and Canvas2D export parity for each supported effect. Do not expose a preset in the editor if export silently drops or changes it.
5. For video, retain the existing feature limits and use `MediaRecorder` only when the browser explicitly supports the requested output. Report unsupported formats and failures. Audio mixing and true motion stabilization remain out of scope until a verified implementation and product contract exist.
6. Preserve the source asset and make edits reversible. Do not upload each filter, crop or text change.

## Draft persistence and recovery

- Keep draft scene metadata separate from published story rows.
- For browser-local editable drafts, persist versioned scene data and source `Blob`s using browser-local durable storage (IndexedDB is a candidate built-in API, not a new package). Store stable asset IDs in the scene, never an ephemeral object URL as the only reference.
- Recreate object URLs when a draft is opened and revoke them when no longer in use. Handle missing assets, quota exhaustion, corrupted versions and user deletion with visible recoverable states.
- Add a draft list/reopen action on the existing Story Studio entry path. Keep any existing same-origin multi-tab collaboration behavior, but define conflict resolution and ensure asset bytes are available before displaying a shared snapshot.
- Do not introduce account-wide/cloud draft storage or new database tables without a separate privacy, retention and migration decision.

## Existing publisher integration

The Studio's final Publish action should invoke the current story creation/upload service used by `/stories?create=1`; extract a focused reusable application service only if the current inline publisher logic cannot be called safely. Keep the same authentication requirements, audience enumeration, private bucket path, signed media behavior, cleanup behavior, moderation rules, RLS and expiration semantics. Publishing success must lead to an existing story/viewer state; external-share handoff must remain clearly distinct from VELORI publishing.

The mobile presentation now follows this contract via `story-publishing.ts`, shared by the existing `/stories` composer and Story Studio. The mobile review sheet applies the existing four audience values and publishes each slide as an existing story record in sequence. Partial sequence failure attempts to remove earlier records through the existing owner-scoped deletion function. Video slides use the existing Canvas2D/MediaRecorder export path: browser MP4 support is required, and the existing exporter does not mix audio. Do not describe these limitations as solved.

No schema, storage bucket policy, or RLS modification is part of this blueprint. Confirm the existing GIF/MIME mismatch before enabling GIF publication.

## Implementation sequence and gates

1. **Scene-model compatibility:** Define typed scene serialization and migration from existing slide/text/sticker state. Add round-trip tests; no UI or backend change.
2. **Selection and transforms:** Add pointer/touch select, move, resize, rotate and keyboard alternatives for text and stickers. Test gesture boundaries and preview-mode separation.
3. **Unified layers and history:** Add layer order/visibility/locking and bounded undo/redo for scene operations. Avoid including large media blobs in history entries.
4. **Drawing and adjustment parity:** Add reversible drawing/eraser and align the listed image transforms/filters across the DOM preview and Canvas2D output.
5. **Durable local drafts:** Persist versioned scene metadata and media bytes locally, add recovery/reopen/error states, and test reload and multi-tab cases.
6. **Export robustness:** Add deterministic image fixtures, browser capability feedback, video limit/error tests and performance measurements. Do not claim audio or stabilization without verified behavior.
7. **Native publish integration:** Reuse the existing Stories publisher and audience/privacy contract. Run approved Supabase-backed tests only in the configured QA environment; verify cleanup and viewer visibility.
8. **Responsive/accessibility acceptance:** Resolve the observed 390px horizontal overflow, then verify 320/390/768/1440px, keyboard/screen-reader paths, reduced motion and touch editing. Re-run the existing focused E2E test.

Each stage should be independently reviewable, keep the progress tracker current, and leave Reels and Posts unchanged.

## Acceptance tests

- **Scene and recovery:** Existing projects deserialize; edits round-trip; original media remains untouched; drafts reopen after refresh; missing media, unsupported versions and quota errors are explicit.
- **Direct manipulation:** Pointer and touch select/move/resize/rotate objects; clamping and rotation are correct; keyboard alternatives work; preview gestures never accidentally alter objects.
- **Layers/history:** Selection, order, visibility, locking and deletion are reflected in both renderers; undo/redo restores operations and invalidates redo after a new branch.
- **Text/stickers/drawing:** Text styling and timing serialize; stickers validate/sanitize as today; drawing/eraser remain reversible and scale correctly at device pixel ratios.
- **Visual consistency:** Each supported adjustment/filter, crop, rotation, flip and overlay yields matching preview/export geometry and expected appearance on fixed fixtures. Unsupported export features produce a clear error.
- **Video:** Trim limits, playback, speed/reverse, supported MIME types, canceled/failed exports and duration are verified in a browser matrix. Audio behavior is stated truthfully.
- **Publish/privacy:** Cancel does not upload; publish uses the existing authenticated upload and story records; failed upload cleans up or exposes a retry; public/follower/close-friend/private visibility matches existing RLS; no unauthorized viewer or storage access is introduced.
- **Responsive/accessibility/performance:** No horizontal overflow at 320, 390, 768 or 1440px; usable touch targets; keyboard and accessible names; reduced-motion behavior; measured memory and export times on representative image/video sizes.

## Risks requiring explicit attention

- The editor preview and Canvas2D export currently differ; correctness requires measurable parity, not merely a successful download.
- Object URLs are temporary and are not a draft storage format.
- Story Studio export/share is currently separate from native publishing; the label and action must not imply a server-side VELORI story exists.
- The mobile test currently reports 432px document width at a 390px viewport, despite an earlier recorded pass. Isolate and fix the overflow before claiming mobile acceptance.
- Browser codec support, export performance, audio and large media handling vary by device.
- Existing story audience/RLS/storage behavior is security-sensitive; no client-only shortcut or policy weakening is acceptable.
- GIF is accepted by some editor validation paths but is not listed among the current story bucket's permitted media MIME types; verify before publish integration.
- The richer tool set is extensive, so progressive disclosure and a canvas-first layout are necessary to keep the phone workflow usable.
