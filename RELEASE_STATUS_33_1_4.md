# VELORI V33.1.4 — replacement source candidate

This archive contains an updated source candidate with improvements to the messaging inbox presentation, public review showcase, creator music preview recovery, and Supabase Management API diagnostics.

## Release status

**QA REQUIRED — not certified as production-ready.** The supplied source archive did not contain `.env`, `.env.local`, a Git remote, or project access credentials. The included environment files contain placeholders only. This package cannot be verified against the live Supabase project or its media catalog from this environment.

## What changed

- Redesigned the messaging inbox hierarchy, conversation rows, thread canvas, composer, mobile spacing, and empty states without replacing the existing message, realtime, privacy, attachment, or notification logic.
- Validates message attachments immediately after selection instead of waiting for Send.
- Added a moving strip of approved member reviews under the landing-page review cards. It pauses on hover/focus and respects reduced-motion preferences.
- Refined the review cards and statistics presentation.
- Added music preview recovery: failed track previews can request a fresh catalog record/audio URL, with a visible in-progress state, instead of leaving the creator stuck with a broken preview.
- Refined the existing help, FAQ and contact surfaces with readable search, expandable answers, mobile-friendly contact form styling and keyboard focus states. The contact form still prepares a mail draft; it is not represented as a backend ticket system.
- Replaced the generic environment-status failure with safe, status-specific Management API diagnostics for expired/invalid credentials, permission issues, missing project/endpoint, rate limits, service outages, and network failures. No tokens or provider response bodies are returned.
- Added tests for the Management API diagnostic mapping.
- Added `.env` and `.env.local` templates with placeholders; these are ignored by Git.

## Mandatory release gates

1. Fill `.env.local` with the correct `VITE_SUPABASE_URL` and Supabase publishable key for the intended VELORI project.
2. Confirm privileged values remain in Supabase/hosting secrets, not in `.env.local` or Git. In particular, rotate or replace `VELORI_ENVIRONMENT_MANAGEMENT_TOKEN` from the Supabase dashboard if the new diagnostic reports HTTP 401.
3. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
4. Deploy the `velori-environment` Edge Function only after its tests pass and verify `/admin/environment` while signed in as an authorized super administrator.
5. Run live smoke tests for login, conversations, realtime messages, attachments, notifications, review submissions/moderation, all editor music previews/selections/exports, and support links.
6. Confirm hosting deployment and inspect the production browser console/network requests.

No database migrations, destructive SQL, user-data resets, or automatic Git pushes are included in this update.
