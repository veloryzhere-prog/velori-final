# V33.1 Integration Notes

## Breaking-change policy

Changes are additive and scoped. The existing `pages[{path,html,css,js}]` Gemini contract remains supported. No new dependencies were added. No database or production Edge Function was mutated by the construction of this ZIP.

## New files

- `src/features/stories/author-session.mjs` / `.d.mts` and `.test.mjs`: author-scoped navigation
- `src/features/artifacts/zip-store.mjs` / `.d.mts` and `.test.mjs`: local ZIP writer
- `supabase/migrations/20261106000000_velori_forge_run_events.sql`: owner-only run-event storage
- `supabase/tests/v331_forge_events_rls.sql`: RLS privilege assertions for staging
- `docs/v33_1/*`: blueprint, release gates and audit record

## Modified files

- `src/features/stories/StoryExperience.tsx`
- `src/features/artifacts/Assistant.tsx`, `Workspace.tsx`, `Preview.tsx`, `PublicPages.tsx`, `document.ts`, `studio.css`
- `src/features/creator-studios/components/PostPreviewActions.tsx`
- `supabase/functions/velori-studio/index.ts`, `policy.ts`, `core.test.ts`
- `package.json`

## Supported features

- Static project source ZIP export, independent of React/Vite runner.
- Runtime event polling based on verified server events after the new migration and Edge Function are deployed together.
- Existing cloud shares/quotas preserved; no changes to provider secrets or user entitlements.

## Not yet supported

- Arbitrary npm/Python package execution, full-stack build and test runner, git file tools, licensed WebContainer, durable background jobs, rich diff merging, browser-wide music transcoding on unsupported devices.

## Security

- `velori_studio_run_events` RLS permits authenticated owner reads only; clients cannot insert/update/delete event records.
- All event messages written by the server are fixed and sanitized; no API keys, project source, prompts or logs are stored in the events table.
- Migration must be verified with authenticated and anonymous actors on staging before any live rollout.
- Never expose `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to Vite/browser code.

## Copyright and source rights

Hosted preview attribution is controlled by the existing backend account entitlement. Source archives are editable; forcing a non-removable copyright claim into exported source is technically and legally inappropriate. Ownership and downstream rights require the current VELORI terms and third-party licenses to be reviewed and approved.
