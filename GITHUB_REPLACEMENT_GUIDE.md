# VELORI V33.1.4 — GitHub replacement guide

This is a source replacement package for the existing VELORI repository. It does not contain `.git`, installed dependencies, a production build, or live secrets. It does not run database migrations or deploy Edge Functions automatically.

## Before replacing the repository contents

1. Open your existing VELORI Git repository in VS Code. Verify `git remote -v` points to the intended `velory netlify` repository and `git branch --show-current` is `main`. Do not initialize a new Git repository.
2. Check `git status`. Commit or back up any work you want to keep. Create a safety branch with `git branch backup/pre-33-1-4` (choose another name if that branch already exists).
3. Keep your current `.env.local` and `.env` somewhere safe. The copies inside this archive are **placeholder templates**, because the supplied ZIP did not contain the live values. They will not connect to your Supabase project until you replace the placeholders locally. Never commit these files.
4. Extract this ZIP to a separate staging folder. Copy the contents of its `velori-final/` folder into the root of your existing Git checkout, overwriting matching source files. Do not remove the existing `.git` folder. Do not overwrite a working `.env.local` or `.env` with placeholder values.

## Install, verify, and push

Run from the existing repository root in the VS Code terminal:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
```

The current release gates require all four commands to pass and the live smoke tests listed in `RELEASE_STATUS_33_1_4.md`. The package was prepared without network access to the package registry, so the full install, typecheck and production build were not verified during this archive preparation.

When checks pass, inspect the change set and push it to the existing `main` branch:

```bash
git status
git diff --stat
git add -A
git diff --cached --stat
git commit -m "Release VELORI 33.1.4 source update"
git pull --rebase origin main
git push origin main
```

Confirm that `.env` and `.env.local` are ignored (`git check-ignore .env .env.local`). Never use `git add -f` on environment files and never use `git push --force` to resolve a rejected push. If a rebase conflict occurs, stop and resolve it before pushing.

## Backend and production deployment

- The `velori-environment` Edge Function source changed. Deploy it separately only after Edge Function tests pass and after confirming the correct Supabase project reference.
- If the admin screen reports Management API HTTP 401, rotate `VELORI_ENVIRONMENT_MANAGEMENT_TOKEN` in Supabase **Edge Functions → Secrets**; do not put this credential into Vite environment files or GitHub.
- No SQL migration or destructive data operation is included in this release. Do not reset the project or run migrations just to publish the frontend.
- If Netlify or another host is connected to the existing GitHub `main` branch, its configured build pipeline can deploy after the push. Verify the deployment and inspect browser console/network errors before calling it production-ready.
