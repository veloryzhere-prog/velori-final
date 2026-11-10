# FINAL-01 — Specification and release verification

## Task identification

- **Stage:** F — Final verification
- **Dependencies:** INTEGRATION-01 complete; each blocked task has a specific documented blocker and owner/contract requirement.
- **Specifications:** All three `specs/0*.md`, `docs/ui-redesign/01–10`, `AGENTS.md`, and `VELORI_UI_MASTER.md`.
- **Status:** NOT STARTED.

## Objective

Compare actual implementation and evidence against every acceptance item and report verified, unverified, blocked, and remaining features accurately.

## Repository inspection

Review the final manifest and progress tracker, current package scripts, formatter baseline, test/build output, route inventory, E2E coverage, and retained visual/browser evidence.

## Required changes

- Run typecheck, lint if the repository defines it, relevant unit/integration tests, production build, formatter gate, and supported E2E suite.
- Run the application and inspect in-scope screens at desktop and mobile; exercise important controls, keyboard paths, auth/privacy and error/empty states where authorized.
- Fix regressions before marking tasks verified. Distinguish pre-existing baseline failures and environment limitations from new defects.
- Update manifest and `docs/VELORI_PROGRESS.md` with command results, routes, viewports, evidence, limitations, and remaining contract blockers.

## Acceptance criteria

No claimed check was skipped; every verified item has evidence; blocked items identify the missing contract/session; the overall platform is not called complete while required acceptance is outstanding.

## Tests

Run the project's actual configured commands, not assumed commands. Current package does not define lint; `pnpm verify` includes formatter, typecheck, tests, and build and may fail at the known formatting baseline.

## Completion report

Report verified tasks, exact checks/results, actual browser routes/viewports/interactions, known warnings/failures, blockers and recommended next task.
