# VELORI Developers — Quickstart

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

## Work on the current project

Use PROJECT-SETUP.md for environment setup. pnpm 10.34.3 and pnpm-lock.yaml are authoritative. Configure only the public Supabase URL and publishable key in the frontend. Privileged values belong to the Edge Function environment. Use pnpm install --frozen-lockfile on a new compatible platform; the dependency-inclusive Windows edition also supplies a local link-restoration launcher.

Run pnpm run typecheck, pnpm test and pnpm run build. This release passed the full suite on Linux. The Windows full-suite rerun encountered sandbox denial of temporary Git fixture configuration; the focused document/GIF tests and production build are checked separately. Do not describe a failed combined command as passing.

## Integrations

There is no public developer-registration quickstart yet. Read the current source contract before using internal first-party calls. Proposed endpoints in api-reference.md are implementation targets, not live service promises. Application review, constrained scopes and authorization tests must precede issuing integration credentials.
