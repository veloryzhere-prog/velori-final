# AGENTS.md

## Project

VELORI is a social media content creation platform for post, reel, and story publishing with feed, profile, messaging, moderation, and creator workflows.

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- React Router
- Supabase JS client + storage
- Feature flags, auth, profile, motion, and runtime config utilities
- PostgreSQL-backed data model via Supabase
- Media upload/validation utilities for stories, reels, posts, and drafts

## Folder structure

- `src/app` — app routes, view pages, social screens, admin screens
- `src/lib` — auth, feature flags, media, runtime, theme, settings, Supabase helpers
- `src/assets` and `src/imports` — static assets and images
- `src/index.css` — global styles and Tailwind entrypoint
- `supabase/` — Edge functions, SQL, and database/security logic
- `scripts/` — utility scripts and verification steps
- `utils/` — app utility/config files

## Conventions

- Keep code readable and explicit; prefer typed, small functions over hidden logic
- Keep components compact; stay under 150 lines when practical
- Reuse existing patterns from `src/app/views.tsx`, `src/app/social-media-pages.tsx`, and `src/lib/*`
- Use existing auth/media helpers instead of creating bespoke patterns
- Keep UI state consistent with current VELORI design system and motion behavior
- Favor clear naming and local helper extraction over large inline conditionals

## Commands

- `pnpm dev` — local development
- `pnpm build` — production build
- `pnpm typecheck` — TypeScript validation
- `pnpm test` — project test suite
- `pnpm format` / `pnpm format:check` — formatting
- `pnpm verify` — format + typecheck + tests + build

## Boundaries

- Never modify database schema without asking
- Never add new dependencies without asking
- Never hardcode secrets or API keys
- Keep changes scoped to the requested feature and preserve working flows
- Always run the existing tests before marking a task done

## Product design and delivery direction

- Follow the VELORI Motion Glass design direction and required phased workflow in [docs/VELORI_PERMANENT_AGENT_INSTRUCTIONS.md](docs/VELORI_PERMANENT_AGENT_INSTRUCTIONS.md).
- Preserve the existing product, routes, data, backend integrations, permissions, and working interactions while improving its interfaces.
- Use the progress tracker at [docs/VELORI_PROGRESS.md](docs/VELORI_PROGRESS.md); update status and evidence after each coherent task.
- Do not mark visual work verified without inspecting the running interface at relevant responsive sizes.
- Before an implementation phase, read this file, [VELORI_UI_MASTER.md](VELORI_UI_MASTER.md), the matching specification under `docs/ui-redesign/`, and the progress tracker. `AGENTS.md` remains the canonical agent rulebook; do not create competing copies of these rules.
