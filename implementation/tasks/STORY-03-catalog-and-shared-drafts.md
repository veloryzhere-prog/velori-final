# STORY-03 — Story soundtrack catalog and shared draft contract

## Task identification

- **Stage:** D — Individual screen implementation
- **Dependencies:** STORY-01; requires an approved licensed catalog and an authorized durable draft contract.
- **Specification:** `specs/03-story-editor.md`; `docs/VELORI_PROGRESS.md` story music blocker.
- **Status:** BLOCKED pending product/backend contracts.

## Objective

Integrate real music selection/playback and cross-device/shared story draft persistence if VELORYZ supplies approved catalog licensing, storage, publishing, and backend contracts.

## Repository inspection

Reconfirm no admin music management UI/catalog/read endpoint, licensed storage contract, or remote story draft endpoint exists. Inspect `AudioTrack`, story collaboration snapshot helpers, auth, RLS, media storage, and accepted music licensing requirements.

## Required changes after blocker resolution

- Use only approved track metadata/assets and enforce territory/availability/attribution restrictions.
- Add authenticated catalog access and actual preview/playback/mix behavior through the supplied contract.
- Persist/restore story scenes through an authorized server contract with conflict/version handling; preserve local recovery during outages.
- Do not add tables, API endpoints, dependencies, or licensing claims until authorized contracts are supplied.

## Acceptance criteria

Catalog tracks are real, licensed and searchable; playback and mix are audible and match preview/export. Shared drafts survive devices/sessions with conflict handling and RLS. Empty/error states remain truthful.

## Tests

Catalog contract tests, audio processing, authenticated privacy checks, two-session draft conflict tests, typecheck, full suite, build and browser verification.

## Completion report

Record contract owner/endpoint and licensing source, actual tested media, persistence evidence, privacy tests, and any remaining restriction.
