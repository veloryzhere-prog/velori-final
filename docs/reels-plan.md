# Reels Studio UI Rebuild Plan

Plan based on the existing Reels Studio rules in `.github/instructions/reels-studio.instructions.md` (the requested `.cursor/rules/reels-studio.md` path is not present in this workspace). Keep `/reels` as the viewer and `/reels/create` as the studio; preserve existing auth, data, upload, publishing, permissions, and backend behavior.

- [x] **Build the mobile-first VideoPreview component**
  - **Files:** `src/features/reels/components/VideoPreview.tsx`; reuse `src/lib/social-media.ts`.
  - **Build:** Provide a full-bleed 9:16-oriented video preview for the upper 60% of the viewport, with play/pause feedback and a bottom sheet that accepts one validated MP4 for replacement.
  - **Verify:** Typecheck/build pass; the existing shared validator rejects non-MP4, empty, malformed, or oversized video files, and controls expose accessible labels and 44px minimum touch targets.

- [x] **Build the mobile-first template picker components**
  - **Files:** `src/features/reels/components/TemplateChip.tsx`; `src/features/reels/components/TemplateSheet.tsx`; reuse `src/lib/reel-editor/templates.mjs`.
  - **Build:** Provide a 44px template chip and an accessible, horizontally scrollable bottom sheet with For You, Trending, and All collections drawn from the existing template catalog.
  - **Verify:** Typecheck/build pass; selecting a catalog entry calls the parent state-update callback and closes the sheet, Escape/backdrop/close restore focus, tabs support arrow-key navigation, and controls meet 44px touch sizing. The Trending collection is a deterministic catalog subset, not usage-ranked analytics.

- [ ] **Create the mobile-first Quick Publish entry**
  - **Files:** `src/app/social-media-pages.tsx`; add `src/components/reel-editor/QuickPublishStudio.tsx` and `src/components/reel-editor/QuickPublishStudio.css`.
  - **Build:** Make Quick Publish the default studio experience, with a focused preview-led screen and no permanent sidebar or advanced collaboration controls.
  - **Verify:** An authenticated visit to `/reels/create` opens Quick Publish by default; `/reels` remains the independent viewer and signed-out/feature-disabled behavior is unchanged.

- [ ] **Integrate VideoPreview into Quick Publish**
  - **Files:** `src/components/reel-editor/QuickPublishStudio.tsx`; `src/app/social-media-pages.tsx`; reuse `src/features/reels/components/VideoPreview.tsx` and existing reel media helpers.
  - **Build:** Connect the reusable preview to Quick Publish's existing controlled file state and real media validation, preserving the current upload/publish flow.
  - **Verify:** In the studio, selecting a valid MP4 updates the preview and eventual publish input; invalid or failed media retains explicit error handling without duplicating or bypassing existing validation.

- [ ] **Integrate the preview and template picker**
  - **Files:** `src/components/reel-editor/QuickPublishStudio.tsx`; `src/app/social-media-pages.tsx`; reuse `src/features/reels/components/VideoPreview.tsx`, `TemplateChip.tsx`, `TemplateSheet.tsx`, and existing reel media helpers.
  - **Build:** Connect the controlled preview and template selection to Quick Publish state and the existing media/publish flow.
  - **Verify:** A selected template updates the visible chip and preview-led workflow; a selected valid MP4 reaches the existing publish input, while invalid media retains existing explicit error handling.

- [ ] **Add inline caption, music, and cover controls**
  - **Files:** `src/components/reel-editor/QuickPublishStudio.tsx`; `src/app/social-media-pages.tsx`; `src/lib/reel-editor/api.mjs`.
  - **Build:** Provide inline caption editing, cover selection or frame capture, and a music affordance only for capabilities the current quick-publish pipeline actually supports.
  - **Verify:** Caption and selected/captured cover flow into the existing publish call; music UI does not claim to mix replacement audio when quick-publish does not support it.

- [ ] **Make publishing the single primary action**
  - **Files:** `src/components/reel-editor/QuickPublishStudio.tsx`; `src/app/social-media-pages.tsx`.
  - **Build:** Use one clear Publish CTA with existing validation, progress, success, and retryable error feedback while retaining the current publish API and audience/interaction settings.
  - **Verify:** Safe authorized non-production tests cover disabled/invalid input, upload and publish progress, successful response, and failure recovery without creating or publishing production content.

- [ ] **Put advanced editing and collaboration behind opt-in sheets**
  - **Files:** `src/components/reel-editor/QuickPublishStudio.tsx`; `src/components/reel-editor/ReelCollaborationPanel.tsx`; `src/components/reel-editor/ReelCollaborationPanel.css`; reuse `src/components/reel-editor/Timeline.tsx` and `src/components/reel-editor/PreviewSystem.tsx`.
  - **Build:** Hide advanced review and collaboration by default, expose them through the overflow/share affordance, and present them in accessible responsive bottom sheets using existing collaboration permissions and data.
  - **Verify:** No advanced or collaboration UI is visible until explicitly opened; role-restricted actions remain restricted and sheet focus, dismissal, and touch behavior work.

- [ ] **Verify the complete responsive Quick Publish flow**
  - **Files:** `e2e/qa-matrix.spec.ts`; relevant tests under `src/lib/reel-editor/`; `docs/ui-redesign/05-reels.md`; `docs/VELORI_PROGRESS.md`.
  - **Build:** Add regression coverage and record evidence for the default/advanced separation, publishing states, accessibility, and Motion Glass responsive presentation.
  - **Verify:** Run focused reel-editor tests, authenticated browser checks at 375px and desktop, `pnpm run typecheck`, `pnpm test`, `pnpm run build`, and formatting checks; inspect screenshots and leave any unsupported or unsafe cases explicitly unverified.
