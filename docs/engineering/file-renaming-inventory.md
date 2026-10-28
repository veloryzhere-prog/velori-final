# File and folder naming inventory

## Scope and result

The repository scan used for the [IP inventory](../legal/intellectual-property-inventory.md) records meaningful paths and file types across the current worktree. This task made **no file or folder renames**: inspection found no isolated rename with a concrete maintenance benefit that outweighed compatibility and provenance risks. The existing checkout contains unrelated modifications and untracked project work; names were not changed merely to make them appear proprietary.

No compatibility-sensitive manifest, migration, workflow, generated file, or external entry point was renamed.

## Compatibility-sensitive names preserved

- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts`: toolchain entry points.
- `supabase/migrations/<timestamp>_*.sql`: applied migration identities must remain immutable.
- `.github/workflows/*.yml`: workflow paths are GitHub Actions entry points.
- `src/imports/` and `.figma/`: import/provenance paths; renaming would erase useful origin evidence.
- `reel-studio/`: nested Vite project boundary with its own application and asset paths.
- `src/pages/ReelStudio/`: referenced by three imports in `src/app/social-media-pages.tsx`, the local source allowlist, UI specifications, and implementation notes. Case-normalizing it would touch live import/tooling contracts without changing the feature boundary.
- `old files/velori check/`: archived checkout copy with spaces and duplicate source names. It is not part of the active application; its path is retained as provenance/archive evidence and is referenced in project history. It was not moved or treated as a current source tree.
- PascalCase component filenames such as `Canvas.tsx` and `DeviceSelect.tsx`: consistent with the repository's React component naming convention rather than accidental path inconsistencies.

## Changes and verification

- Renames: none.
- Imports/routes/configuration references changed for naming: none.
- Migration and external entry-point names preserved: yes.
- Verification: `pnpm typecheck`, `pnpm test`, `pnpm test:edge`, and `pnpm build` were run on the final changes; formatting was checked separately.

Re-evaluate individual candidates only when ownership and usage are established. Each future rename must record old path, new path, concrete reason, updated references, and test/build evidence. The machine inventory is a census, not an endorsement that every archived name follows one convention.
