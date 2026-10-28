# Phase 3: Project Setup Architecture

## Entry And Auth

- Landing Build submits to `/forge/projects/new`; Ask retains the existing `/artifacts` behavior.
- The signed-out landing submission stores the bounded prompt locally. Authentication returns through `/forge`; the landing page restores the prompt and routes Build to setup.
- Direct signed-out setup navigation redirects to `/login`. Setup is rendered after `StudioPage` has resolved the existing Supabase session.
- The actual handoff parser accepts only a bounded prompt and `build`/`ask` mode. No generation request is made by project setup.

## Setup And Manifest

`ProjectSetup.tsx` implements six focused steps: identity, platform/framework, design, AI preferences, storage, and review. Supported options reflect current code: static HTML/CSS/JavaScript has the built-in browser preview; React/Vite and Python/FastAPI are editable source/ZIP starters without an available local runtime. Unsupported frameworks are not advertised.

`Project.setup` is a validated schema-version-1 `ForgeProjectSetup`. It records the description, category, platform, framework, theme/design/accent, animation intent, responsive priority, provider/default interaction, local storage/autosave preferences, and initial prompt. It contains no provider secrets or filesystem paths. Legacy projects remain readable without a setup manifest; the first settings edit adds conservative metadata based on their existing stack.

## Persistence And Idempotency

- Setup drafts are scoped by the current visitor/account key (`velori.forge.setup.v1.<scope>`) and carry a stable draft ID, step, name, and validated manifest.
- Draft edits are stored locally; returning users can Resume or Start Fresh. The landing prompt is removed only after the setup copy is persisted.
- Create uses an in-memory duplicate guard, a fresh `studioId()`, existing starter generators, and `persistDeviceProject` before editor navigation.
- The device store uses IndexedDB transactions and its existing bounded localStorage fallback. A failed save prevents navigation.
- Creating a project does not call generation, quota reservation, checkout, or credit APIs. The editor restores prompt/provider/default mode; later generation continues through the existing server-authoritative flow.
- Project Settings edits persist through the existing editor save. Deletion is confirmed and scoped to the current account/device project ID.

## Known Scope Limits

Project Settings is an editor dialog rather than a dedicated route. The setup currently exposes the genuinely available static, React/Vite, and FastAPI starters, not every framework mentioned in the request. Runtime execution, real Supabase auth, account quota, and provider execution are not simulated as production capabilities. A full beforeunload/reload recovery audit and real-account ownership test remain outstanding.