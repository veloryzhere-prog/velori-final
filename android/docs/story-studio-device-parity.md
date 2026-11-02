# Story Studio device parity

Story Studio has one editor state and engine with two selectable presentations. Keep that boundary when changing tools.

## Component boundaries

- `/stories/create` remains the only Story Studio route. `StoryEditorPage` owns the active project, selection, text/sticker/shape objects, history, media settings, draft snapshot, export and the existing share handoff.
- `StoryStudioDeviceSelector` is shown at a fresh editor entry. Its `computer` or `mobile` choice is page-session presentation state, not project data, so re-entering the route asks again.
- The computer view retains the existing header, workspace, contextual sidebar, storyboard, tool rail and export/share handoff.
- The mobile view prioritizes Media, Text, Stickers and Shapes; Music, Layout, Brand Kit, collaboration and Export & share stay in secondary/contextual panels. Its storyboard collapses to a count until expanded, and its Next action opens the audience-aware native publish review.
- Both views render the same `StoryCanvas`, use the same tool panels and callbacks, and mutate the same `StoryEditorSceneState`. Do not create a mobile-specific object store, renderer, history or publishing path.
- Native publication goes through `src/lib/story-publishing.ts`, shared with the existing `/stories` composer. Never duplicate its upload, preference, ownership, cleanup or audience logic. Mobile publication renders the slide sequence through the existing Canvas2D/exporter path; MP4 is capability-dependent and does not include source audio.
- Read-only client previews bypass the device choice because they are not an editor entry.

## Adding a shared editing feature

1. Define or extend the typed scene data in `src/lib/story-editor/types.ts`. Keep stable IDs and normalized scene coordinates where applicable.
2. Add the operation once in `src/app/story-editor-page.tsx` or the existing shared helper under `src/lib/story-editor/`. Update the shared snapshot, undo/redo and export serialization if the new data must persist or render.
3. Render the object once through `StoryCanvas` and wire its selection/manipulation to the existing shared callbacks.
4. Add controls to the existing contextual tool panel. Register the tool once in `studioTools`; both device presentations consume that same list.
5. Keep computer and mobile controls presentation-specific only. Mobile controls must call the same state operations and panel components, not reimplement tool logic.
6. Add helper tests and authenticated browser assertions for both device choices. Cover create/update/delete, selection, history, export where relevant, and at least one mobile viewport/rotation case.
7. Do not advertise a tool until its behavior exists. Do not change routes, publishing/auth/privacy behavior, database schema or storage policies as part of a presentation-only feature.

## Verification expectations

- Opening `/stories/create` presents the chooser; cancel/backdrop-close/Escape returns to `/stories` without writing a blank project.
- Computer choice keeps the desktop controls and their existing interaction tests.
- Mobile choice remains mobile when the viewport changes orientation or size. Test normalized object positions before and after resize.
- Both layouts exercise the same scene operations; verify controls do not create duplicated state or routes.
- Run `pnpm typecheck`, `pnpm test`, the production build, formatting checks and focused authenticated Story Studio E2E tests.
- Browser viewport testing is not physical Android testing. Report emulator/device coverage only when it was actually run.
