# Build and test results

All paths below are relative to evidence/. Commands ran from the complete VELORI checkout with Node 24 and the pinned pnpm 10.34.3.

| Command | Actual result | Evidence |
|---|---|---|
| baseline `corepack pnpm test` | 332 passed, 1 skipped | baseline-tests.log |
| `corepack pnpm install --frozen-lockfile` | Clean Linux install passed, 49.8 s; dependency script warnings retained | clean-install.log |
| `corepack pnpm add --save-exact @webcontainer/api` | Added 1.6.4; lockfile updated; 1m33 s | runtime-dependency.log |
| first runtime TypeScript check | FAILED: candidate possibly null; duplicate block corrected | full audit records failure; initial log was superseded on retry |
| `node --test src/features/artifacts/runtime/runtime.test.ts services/forge-companion/companion.test.mjs` | Initial focused suite: 12 passed | runtime-tests.log |
| final `corepack pnpm typecheck` | PASS, 0 errors | typecheck-v3313.log |
| final `corepack pnpm test` | PASS: 346 passed, 1 existing skip, 0 failures; 347 total | all-tests-v3313.log |
| final `corepack pnpm build` | PASS: complete Vite output, 1.23 s; bundle warnings | final-production-build.log |
| `corepack pnpm format:check` | FAILED: baseline formatting debt; not a clean global gate | format-check-v3313.log |
| focused `corepack pnpm exec oxfmt --check` changed feature paths | PASS: all 11 matched files formatted | command output observed; format-changed.log retains formatter run |
| `corepack pnpm audit --prod --audit-level=high` | PASS: no known vulnerabilities reported | audit-v3313.log |
| `corepack pnpm copyright:check` before regeneration | FAILED: stale inventory hashes | copyright-v3313.log |
| `bwrap ... /usr/bin/true` | FAILED: /proc namespace unavailable | audit; environment probe output retained in conversation |
| Browser local preview | PASS for listed manual desktop checks; runtime execution blocked | desktop-workspace.jpg, FULL_AUDIT.md |

No lint script is configured. No Stripe test payments or production provider generation were executed. No actual Docker/WebContainer execution, Python server, mobile browser matrix or generated-app E2E is claimed. The controlled repair uses Node's real syntax parser with an authored fix; it is not an AI repair acceptance test. Earlier build-v3313.log has incomplete output and is not the authoritative build proof; use final-production-build.log.

Final `copyright:inventory` and `copyright:check` passed after regeneration: 950 meaningful files at that checkpoint; 947 origins unresolved. Added release/manifest files are included in the final regenerated inventory. This is a consistency check, not a rights clearance.

## Windows re-verification (2026-10-27)

Environment: Node 26.7.0, pnpm 10.34.3, Windows; fresh `pnpm install --frozen-lockfile` completed successfully. pnpm reported ignored dependency build scripts. The first `pnpm build` correctly failed because the public Supabase URL was not configured. The normal guarded build then passed with local-only test URL/key values and an isolated temporary output directory; Vite built 2,780 modules in 8.49 seconds and emitted the existing >500 kB chunk warning. The temporary output directory was removed. This is compilation evidence, not a production-config build.

| Check | Result | Detail |
|---|---|---|
| `pnpm typecheck` | PASS | No TypeScript diagnostics. |
| `pnpm test` | PASS | 351 passed, 0 failed, 0 skipped. The earlier Linux report recorded 346 passed and 1 skipped; those prior results are retained as a distinct run. |
| `node --test services/forge-companion/companion.test.mjs` | PASS | 8 passed, including Windows CLI resolution and Docker Desktop non-rootless refusal before container creation. |
| `pnpm forge:companion:verify` | Expected FAILED diagnostic | With test origin/image configured, resolved the per-user Docker Desktop CLI and refused it because `name=rootless` is absent. |
| Companion Docker runner `info` call | PASS | Invoked Docker Desktop through the companion wrapper; returned actual `seccomp` and `cgroupns` options without creating a container. |
| `pnpm exec oxfmt --check` on the four changed companion/preflight files | PASS | All touched runtime files formatted. Global format debt was not rechecked. |
| `pnpm security:audit` | PASS | No known production dependency vulnerabilities found; captured in `evidence/windows-security-audit-20261027.log`. |
| Guarded `pnpm run build` with local-only test configuration | PASS | Vite 8.1.6; 2,780 modules, 8.49 seconds; temporary output removed. |
| Docker Desktop daemon | PASS | Client/server 29.9.2; `desktop-linux`; Linux/WSL2 kernel. Harmless `hello-world` and automatic cleanup passed. Security options only report seccomp and cgroupns, not rootless. |
| Real project container/runtime execution | BLOCKED | Companion refuses this daemon because rootless mode is not reported. No React preview, Python server, AI repair E2E, or project isolation result is claimed. |

The final inventory pass after adding the Windows evidence covered 952 meaningful files and reported 949 origins unresolved. Hash consistency passed; this does not verify copyright ownership or license rights.

## Rootless runtime assessment (2026-10-27)

Dedicated Docker Rootless Engine in a new WSL distro is recommended after approval because its CLI contract matches the existing companion. It needs official `uidmap`/rootless packages, subordinate UID/GID ranges, a user systemd service, disabled per-distro Windows drive automount/interop, and a WSL transport adapter. Docker Desktop docs warn against installing into an integrated distro. The existing Ubuntu distro is stopped and an interactive start timed out.

Podman Machine is a fallback: although rootless by default, upstream `machine.volumes` defaults to `$HOME:$HOME`, WSL auto-mounts Windows drives, and WSL CPU/memory/disk limits are global rather than per-machine. `[machine] volumes=[]` and per-distro automount controls require approval and verification; the companion also needs Podman CLI adaptation. With 5.85 GiB host RAM, stop Docker Desktop while acceptance runs. Host facts are captured in `evidence/rootless-runtime-host-20261027.log`.
