# POST-01 — Recover unsynced post canvas scenes locally

## Task identification

- **Stage:** D — Individual screen implementation
- **Dependencies:** Stage A repository baseline, Stage B shared design system, and Stage C shell are recorded verified in `docs/VELORI_PROGRESS.md`.
- **Specification:** `specs/01-post-editor.md`; supporting `docs/ui-redesign/03-authentication-and-feed.md` and `docs/ui-redesign/10-testing-and-acceptance.md`.
- **Status:** VERIFIED. See manifest and tracker evidence (2026-10-17).

## Objective

Keep the current user's unsynced post canvas layer edits in the same device recovery record that already protects caption and audience edits. Restore that scene only when the corresponding local recovery copy is used. This closes the local data-loss gap without claiming cross-device persistence.

## Repository inspection

Inspect `CreatePost()` in `src/app/views.tsx`, `LocalPostDraftBackup`, `readLocalPostDraftBackup`, `backUpDraftLocally`, canvas layer callbacks, draft loading precedence, `src/components/post-editor/Canvas.tsx`, `types/post-editor.ts`, and the existing `post_drafts` / `post_draft_media` RLS contract. Do not change schema or the Supabase payload.

## Required changes

1. Serialize per-slide text, image, and shape layer scene snapshots into the existing user-keyed recovery record when canvas edits occur.
2. Validate stored containers and required layer geometry before restoring; ignore malformed layers without failing the rest of the draft.
3. Restore scene layers for the matching local recovery draft, including the branch where a newer local backup wins over the account copy. Leave account-only drafts and other users' backups untouched.
4. Preserve the current caption, media upload, audience, collaboration, keyboard save, autosave, and publish flows.
5. Add focused helper tests to the existing `pnpm test` script.

## Design and functional requirements

No visual redesign is needed. Local recovery remains keyed by the signed-in user. The UI must not imply that canvas scene changes sync to Supabase or another device. Existing `post_drafts` columns do not contain a scene payload; changing them requires a separate authorized backend/schema task.

## Files and integration

Current files: `src/app/views.tsx`, `src/components/post-editor/Canvas.tsx`, `src/lib/post-editor/draft-scene.mjs`, its declaration and test, `e2e/post-local-scene-recovery.spec.ts`, and `package.json`. Explain any additional file or contract changes before making them.

## Acceptance criteria

- Valid layers round-trip through the current local recovery record without shared mutable object references.
- Invalid layer records are ignored safely.
- A newer local backup restores its scene; an account draft with no winning local backup does not receive unrelated local scene data.
- Existing upload/publish and privacy logic is unchanged.
- No database schema, migration, dependency, authentication, or permission changes are introduced.
- Browser reload/restore works on `/create` at desktop and phone width without introducing overflow or console errors.

## Tests

Run focused helper tests, `pnpm test`, `pnpm run typecheck`, `pnpm run build`, focused formatting, and `pnpm e2e -- e2e/post-local-scene-recovery.spec.ts`. Use only the authorized QA owner session for the reload/restore interaction. Do not publish a post.

## Completion report

Record files changed, checks and results, exact browser widths/actions, known local-only limitation, and any blocker. Mark VERIFIED only after all acceptance criteria pass.
