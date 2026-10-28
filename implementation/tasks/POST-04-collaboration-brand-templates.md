# POST-04 — Post collaboration, brand kit and templates

## Task identification

- **Stage:** D — Individual screen implementation
- **Dependencies:** POST-02 verified; scene payload stability; any persistence change must use an inspected authorized backend contract.
- **Specification:** `specs/01-post-editor.md`; project auth/privacy requirements in `AGENTS.md` and `VELORI_UI_MASTER.md`.
- **Status:** NOT STARTED.

## Objective

Close verified gaps in real-time collaboration, pinned comments, version history, approvals, reusable templates, brand application, and 50-step undo while keeping current authorization and RLS.

## Repository inspection

Inspect `src/lib/post-editor/collab.*`, `CollaborationPanel`, `post_drafts` RPCs/tables/policies, Supabase realtime setup, current brand/template modules and local storage, undo behavior, and authorization checks. Distinguish deployed server support from client-only adapters.

## Required changes

- Reuse existing protected collaboration tables/channel and workflows; test ownership/editor/viewer permissions.
- Identify missing pinned comment/version/approval backend contracts. Implement only with existing authorized data contracts; otherwise mark the dependent feature BLOCKED in the manifest.
- Verify brand colors/fonts/logo apply without overriding locked user choices; verify templates save/load actual editable documents.
- Confirm history limit is 50 and restores scene content, not caption alone.

## Design requirements

Keep presence, comments, workflow state, template empty/loading/error states accessible and responsive. Do not show fabricated collaborators, comments, templates, or approvals.

## Files and integration

Likely post collaboration/brand/template modules, panel components, and `CreatePost`. Database changes remain out of scope under `AGENTS.md`.

## Acceptance criteria

- Authorized collaborators see consistent edits without overwriting unsaved local changes.
- Unauthorized users cannot read/write another draft; RLS and route guards remain active.
- Actual available version/approval/comment systems are used, with missing backend contracts accurately recorded.
- Brand kit/template and 50-step undo acceptance passes for the canvas scene.

## Tests

Collaboration, templates, brand-kit and history tests; full suite, typecheck, build, formatting; use two authorized non-production accounts only if available.

## Completion report

State tested roles and sessions, backend contract inspected, features genuinely connected, evidence, and blocked contracts.
