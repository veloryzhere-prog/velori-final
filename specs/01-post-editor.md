# Post Editor — Restructure Spec

## Current State

The current VELORI project already has a functional post creation flow in `src/app/views.tsx` via `CreatePost()`, plus media upload and draft helpers in `src/lib/post-media.ts` and `src/lib/supabase.ts`. The app supports drafting, optimizing images, uploading to Supabase storage, and publishing a post with audience settings, comments, likes, and saved-state handling. However, the current implementation is still a simple composer rather than a true canvas editor: there is no multi-slide editor, no layer system, no timeline, no brand kit or export pipeline, and no real animation controls. The structure is workable as a baseline for a post editor, but it is not yet a design-tool workflow or a production-grade creative suite.

## Target State

The post editor must support:

- Multi-slide canvas (1-20 slides), aspect ratios: 1:1, 4:5, 9:16, 16:9
- Layers: text, image, shape, icon, GIF
- Text controls: font, size, weight, color, alignment, letter-spacing, line-height, stroke, shadow
- Image controls: crop, rotate, flip, brightness, contrast, saturation, blur, opacity
- Shape library: 50+ geometric shapes, arrows, badges
- Icon library: searchable, recolorable
- Background: solid, gradient (linear/radial), image, pattern
- Filters: 20+ presets, custom LUT
- Blend modes per layer, opacity slider
- Animation: fade, slide, zoom, rotate per element + page transitions
- Timeline view for animations
- Export: PNG (1x/2x/3x), PDF (carousel), MP4 (animated)
- Preview: platform-specific (IG, FB, LinkedIn, X), feed context, dark/light mode
- Collaboration: real-time co-edit, comments pinned to elements, version history, approval workflow
- Brand kit: auto-apply colors/fonts/logo
- Template library: save/load custom templates
- Undo/Redo: 50 steps
- Auto-save: every 30s

## Files to Create/Modify

- `src/app/views.tsx` — existing post composer to be replaced/expanded into advanced editor flow
- `src/lib/post-media.ts` — image optimization and upload handling for post asset pipeline
- `src/lib/supabase.ts` — Supabase client and entity access patterns for editor data
- `src/lib/social-media.ts` — story/reel shared media validation and signed URL flows
- `src/app/routes.tsx` — editor routes and navigation hooks for create/edit pages
- `src/index.css` — editor layout, canvas, toolbar, modal, and timeline styling
- `src/components/post-editor/Canvas.tsx` — multi-slide render surface and layer manager
- `src/components/post-editor/LayersPanel.tsx` — layer stack controls and hierarchy
- `src/components/post-editor/Toolbar.tsx` — object/tool selection toolbar
- `src/components/post-editor/PropertyPanel.tsx` — per-layer property controls
- `src/components/post-editor/Timeline.tsx` — animation timeline and keyframes
- `src/components/post-editor/ExportDialog.tsx` — export and publishing options
- `src/components/post-editor/TemplateLibrary.tsx` — saved templates and presets
- `src/lib/post-editor/types.ts` — editor data types and schema contracts
- `src/lib/post-editor/undo.ts` — command-based history manager
- `src/lib/post-editor/export.ts` — PNG/PDF/MP4 generation helpers
- `src/lib/post-editor/collab.ts` — sync and comments logic
- `src/lib/post-editor/brand-kit.ts` — color/font/logo token application
- `src/app/editor/post/[id]/page.tsx` — dedicated editor page

## Phases

1. Data model + types (Prisma schema, TS types, API routes)
2. Canvas engine (rendering, pan/zoom, selection, layers)
3. Tools (text, image, shape, icon, color)
4. Animation + timeline
5. Export (PNG client-side, PDF/MP4 server-side)
6. Preview (platform-specific frames)
7. Collaboration (real-time sync, comments, versions)
8. Brand kit + templates
9. Polish (shortcuts, auto-save, error states, empty states)

## Acceptance Criteria

- [ ] Create 5-slide carousel with mixed text/image/shape
- [ ] Export as 2x PNG → correct dimensions
- [ ] Two users edit simultaneously → no data loss
- [ ] Undo 10 steps → correct state restored
- [ ] All existing tests pass
