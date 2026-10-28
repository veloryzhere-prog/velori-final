# 10 — Testing and acceptance

Status: Phase 0 baseline captured on 2026-10-16. No production UI changes were made for Task 0.

## Commands and baseline

| Check                        | Result                       | Evidence / caveat                                                                                                                                                  |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify`                | FAILED at first step         | `pnpm format:check` found formatting differences in 22 existing `src` files. Pipeline stops there; it did not run later stages.                                    |
| `pnpm typecheck`             | PASS                         | `tsc --noEmit`, exit code 0.                                                                                                                                       |
| `pnpm test`                  | PASS                         | 203 tests passed, 0 failed.                                                                                                                                        |
| `pnpm build`                 | PASS                         | Vite production build completed. Node emitted a `module.register()` deprecation warning.                                                                           |
| `pnpm e2e`                   | NOT RUN in this baseline     | Playwright config and E2E specs exist; existing screenshots/failure artifacts in `test-results/` are historical and are not treated as current test results.       |
| `node scripts/_ui-audit.mjs` | AVAILABLE, NOT RUN in Task 0 | Signs in using local QA owner credentials and captures public/authenticated main routes at 1440×900 and 390×844; use only in a suitable authorized QA environment. |
| Visual browser inspection    | NOT PERFORMED                | Do not claim responsive visual verification from build or route HTTP status.                                                                                       |

Formatting differences listed by `oxfmt --check src`: `src/app/social-media-pages.tsx`, `src/components/post-editor/BrandTemplates.tsx`, `LayersPanel.tsx`, `canvas-engine.ts`, several reel-editor components/CSS, `src/index.css`, and multiple post-editor/story-editor library modules/tests. Exact full output is available from the baseline command. Treat as pre-existing baseline until files are intentionally formatted and rechecked.

## Tools actually available

- Unit/integration: Node built-in test runner via `pnpm test`; dedicated story/reel/post editor tests.
- E2E: `@playwright/test`, `playwright.config.ts`, `e2e/*.spec.ts`.
- UI route/screenshot audit: `scripts/_ui-audit.mjs`, outputs to `test-results/ui-audit-<tag>/`.
- Supabase tests/scripts: `pnpm test:privacy`, `pnpm test:edge`, `pnpm supabase:verify`, messaging privacy/security commands. These may contact a configured backend; read the script and scope before running.
- Build/static: `pnpm typecheck`, `pnpm build`, `pnpm format:check`; combined `pnpm verify`.

## Per-phase test plan

1. Run relevant focused unit tests first; then typecheck/build.
2. Run E2E route/auth/interaction specs with the appropriate QA account and a clean test-data state. Do not expose or print credentials.
3. Run `scripts/_ui-audit.mjs` at its documented sizes or equivalent browser inspection. Record route, viewport, screenshot path, console/page errors, failed requests and overflow.
4. For each phase, manually inspect loading, empty, error, permission, success, dialog, keyboard, touch and reduced-motion states relevant to the changed screen.
5. Run full `pnpm verify` before phase completion; pre-existing formatter failures must be resolved or explicitly separated from newly introduced ones.

## Objective acceptance criteria

- No unrequested route, feature, backend contract, permission, or data behavior is removed or mocked.
- Changed route works signed out and authenticated as appropriate, including direct URL/query/hash entry.
- Loading/empty/error/retry/disabled/permission states render and actions do not dead-end.
- No page error/uncaught exception, unexpected failed API request, horizontal overflow, or inaccessible interactive control at tested widths.
- Tests/typecheck/build pass; formatter status is recorded honestly.
- Reduced-motion setting works, theme overrides remain functional, and colors/typography stay consistent with Motion Glass.
- Evidence is recorded in `docs/VELORI_PROGRESS.md`; untested routes remain unverified.
