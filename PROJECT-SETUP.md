# VELORI — Complete source project

This export contains the React/Vite application, public assets, creator studios, admin console, Supabase functions/migrations/tests, package lockfile and project documentation.

## Run locally

1. Install Node.js 22.12 or newer and pnpm 10.34.3 (the version in package.json).
2. Run pnpm install --frozen-lockfile from the project directory.
3. The private ZIP includes available project-local environment files. Review .env.local for the Supabase connection. If configuring another project, copy .env.example and supply that project’s values.
4. Run pnpm dev --host 127.0.0.1 --port 5173, then open the local URL printed by Vite.

Only public browser configuration belongs in VITE_ variables. Keep privileged service keys, admin credentials and deployment tokens in protected server configuration.

## Verify and build

- pnpm typecheck
- pnpm test
- pnpm build
- pnpm preview (serves the built dist directory locally)

Vite generates dist for static hosting. Keep SPA fallback routing enabled on the host. The existing .openai/hosting.json identifies the original Sites project; it is not a credential.

## Backend

The site connects to a separate Supabase backend. Hosting the frontend does not apply migrations or deploy functions. Use the existing Supabase configuration, migration files, server sources and project documentation for the target you control. Administrator account initialization is documented in the repository. Supabase-hosted server secrets are stored separately from the application checkout and are not retrievable through frontend configuration.

The source-management integration needs the matching server deployment. SMTP delivery must be configured and verified separately. Existing user data and uploaded storage objects belong to the backend and are not copied into this source archive.

## Included / excluded

All tracked project source and static assets are included. At the owner’s explicit request, available project-local environment files are added to this private download separately from the Git source. Installed dependencies, build caches, Git history, temporary QA pages, ChatGPT/Sites authorization and audit-session credentials are excluded. Keep the ZIP private; remove environment files before sharing. Run pnpm install to restore dependencies.

See docs/audits/2026-10-23-responsive-motion-audit.md for this update’s evidence and visual-verification limits.
