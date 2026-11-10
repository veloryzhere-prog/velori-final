# FORGE 33.1.3 runtime setup — engineering candidate

## Host application

Use the pinned package manager: `corepack pnpm install --frozen-lockfile`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`. Supply only the public Supabase URL/publishable configuration described by .env.example. Keep service-role and provider credentials in the existing protected backend. SDK version is exactly 1.6.4.

## Browser execution

Production use is disabled unless the operator has actually obtained the required runtime license and configured `VITE_FORGE_BROWSER_RUNTIME_LICENSED=true` before building. This boolean is an operator deployment gate, not proof or procurement of a license. Do not set it solely to bypass the check.

Host the runtime workspace on a reviewed HTTPS origin with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Serve every embedded resource with compatible policies. `VELORI_FORGE_ISOLATION_QA=true` enables these headers only for Vite QA; production hosting still needs explicit review. No global production social/auth headers were changed. Existing social media, OAuth popups and embeds need regression tests before isolation is deployed. The current `http://terminal.local` preview does not meet these browser prerequisites.

Open a project containing package.json. Check compatibility, review registry/execution consent, then select Install, build & run. The adapter mounts source locally, runs the manager install with scripts disabled, runs build if present, then dev. Only the SDK server-ready event provides a preview URL. Terminal displays real event output. Stop tears down processes. Device buttons change iframe width; they do not certify real mobile-browser compatibility. Initialization and commands are bounded, and failures appear in chat.

Supported policy: npm, pnpm, Yarn Classic. Modern Yarn, workspaces and custom package-manager hooks/config are refused. No lockfile means reproducibility is not guaranteed. Native packages and some frameworks may fail; diagnose actual output. Browser runtime network access is not a strict egress sandbox and can reach external endpoints; consent makes this explicit. Python is not executed by WebContainer.

## Rootless runtime decision (2026-10-27)

### Machine facts

The host has 5.85 GiB physical memory, 12 logical processors, and 158.73 GiB free on C:. Docker Desktop's WSL2 Linux engine reports 2.77 GiB total memory. WSL lists `Ubuntu` as stopped and `docker-desktop` as running; no user `.wslconfig` is present. Starting an interactive shell in Ubuntu previously timed out with `WSAETIMEDOUT`. Current resource and WSL evidence is in `evidence/rootless-runtime-host-20261027.log`.

### Option A: separate WSL2 Docker Engine

Docker's official rootless mode runs both daemon and containers in user namespaces. It requires `newuidmap`/`newgidmap`, subordinate UID/GID ranges in `/etc/subuid` and `/etc/subgid`, and a configured user daemon. Docker Desktop's WSL guide warns that installing another Docker Engine/CLI into an integrated distro can cause conflicts. A dedicated, non-integrated distro avoids changing Docker Desktop's daemon/configuration and is the lowest-adapter-risk candidate because the companion already speaks Docker CLI; it still needs a WSL transport adapter and port-forwarding tests. The existing Ubuntu distro is stopped and an interactive launch timed out. This is recommended in principle but not yet proven; do not install into the Docker Desktop-managed distro.

### Option B: Podman Machine on WSL

Podman documents Windows Podman Machine as a Linux WSL distribution; its default connection is rootless (`--rootful` defaults to false) and `podman info --format json` exposes `host.security.rootless`. However, upstream defaults `[machine].volumes` to `[$HOME:$HOME]`, and WSL auto-mounts Windows fixed drives below `/mnt`. Disabling the Podman host share requires `[machine] volumes=[]` in `%APPDATA%\containers\containers.conf`; disabling WSL drive automount requires machine-distro `/etc/wsl.conf`. Podman CLI CPU/memory/disk set controls are documented as QEMU-only; WSL resource limits use global `.wslconfig`, which would affect Docker Desktop too. Podman is a fallback requiring more adapter and boundary verification, not the current recommendation.

**Recommendation:** After approval, create a new, non-integrated WSL2 distro for Docker Engine Rootless. Disable Windows drive automount and Windows-process interop only in that distro. This avoids changing Docker Desktop or the existing Ubuntu distro, and minimizes companion adapter risk. WSL2 still shares the host kernel and global memory pool, so this is not equivalent to a separate Hyper-V VM.

### Approval-only setup

No runtime was installed, no WSL settings were changed, and no administrator command was run. After explicit approval, install a new Ubuntu 24.04 WSL2 distro; do not reuse `Ubuntu` or Docker Desktop's `docker-desktop`. Microsoft's documented install command is:

```powershell
wsl.exe --install --distribution Ubuntu-24.04
wsl.exe --list --verbose
```

Complete the new distro's initial user setup, then continue only inside `Ubuntu-24.04`. In that distro only, disable Windows mounts and interop and enable systemd:

```ini
# /etc/wsl.conf inside Ubuntu-24.04 only
[boot]
systemd=true

[automount]
enabled=false

[interop]
enabled=false
appendWindowsPath=false
```

Inside the approved distro, install Docker Engine's official rootless prerequisites (`uidmap`, `dbus-user-session`, `docker-ce-rootless-extras`, subordinate UID/GID mappings) and run `dockerd-rootless-setuptool.sh install` as the non-admin user. Verify `docker info` reports `name=rootless` and cgroup v2. Restart only this distro with `wsl.exe --terminate Ubuntu-24.04` after editing its `/etc/wsl.conf`. Do not integrate this distro with Docker Desktop. Only then add a WSL transport adapter and test `--network=none`, loopback-only published ports reachable from Windows, resource limits, cancellation, and cleanup. Keep Docker Desktop unchanged; stop it temporarily during the test to reduce contention in this 5.85 GiB host's shared WSL memory pool. Do not edit global `.wslconfig` without separate approval.

If the approved choice is instead Podman, first set `[machine] volumes=[]` in `%APPDATA%\containers\containers.conf`, disable automount in its machine distro, and confirm the resulting configuration before starting any generated project. Its WSL resource controls are global; do not change `.wslconfig` without separate approval.

Official references: [Microsoft WSL installation](https://learn.microsoft.com/en-us/windows/wsl/install), [Docker rootless mode](https://docs.docker.com/engine/security/rootless/), [Docker Desktop WSL2](https://docs.docker.com/desktop/features/wsl/), [Microsoft per-distro WSL config](https://learn.microsoft.com/en-us/windows/wsl/wsl-config), [Podman Machine initialization](https://docs.podman.io/en/latest/markdown/podman-machine-init.1.html), [Podman Machine settings](https://docs.podman.io/en/latest/markdown/podman-machine-set.1.html), and [Podman containers.conf](https://github.com/containers/common/blob/main/docs/containers.conf.5.md).

## Desktop companion

Requires Node 24, a daemon that reports rootless mode, and locally available reviewed Node/Python images pinned with `@sha256:...`. Configure `VELORI_FORGE_ORIGIN` to one exact UI origin, `VELORI_FORGE_NODE_IMAGE` and optionally `VELORI_FORGE_PYTHON_IMAGE`. Images must already be installed; the companion uses --pull=never. Docker Desktop 4.97.0 on the verified Windows laptop runs a WSL2 Linux engine, but reports only seccomp and cgroupns security options; it does not satisfy this companion's rootless requirement. `hello-world` is only a daemon smoke test, not an approved project runtime image.

The companion resolves Docker Desktop's per-user Windows CLI path and exposes its directory only to Docker child processes for credential-helper discovery. First run `pnpm forge:companion:verify` to check Node, exact origin, rootless Docker, and the locally available digest-pinned Node image. This preflight does not run generated code or certify sandbox escape resistance. On the verified Docker Desktop daemon it fails closed because rootless mode is not reported. Run `pnpm forge:companion` only after a rootless daemon and reviewed runtime image pass preflight. It binds only 127.0.0.1:7331 by default (`VELORI_FORGE_PORT` overrides the port) and prints a temporary pairing token for that session. Enter its endpoint/token in the workspace's Local desktop companion section. Token stays in UI memory; never place it in project source. Check companion before submitting source. The browser may require local-network permission or block HTTPS-to-loopback access; errors must be resolved by supported browser configuration, not disabled protections.

Build submits project files only after an explicit user action. Node builds install dependencies in an ephemeral, constrained container after registry network approval, disconnect network, run build, return bounded logs, then remove the container. Projects have no host bind mounts or administrative environment. Python action is syntax compilation only. Persistent development-server previews, Python pip installation, FastAPI startup, desktop packaging, cross-platform installers and long-running sessions remain incomplete.

## Local AI and repair

Select Local model in Inference, enter a localhost HTTP endpoint and an installed model identifier. Ollama/LM Studio must expose an OpenAI-compatible /v1/chat/completions route and explicitly permit the UI origin. No model identifier is hardcoded. Local inference has no remote fallback. Gemini requires explicit remote source-context consent. Account readiness/billing checks still use the existing service, so strict offline mode is not fully implemented.

For repair, pair a desktop companion, configure the local model in Build repair, approve network/execution, then Build and repair. Each proposed source change is reviewed before the next sandbox build. Two attempts maximum; repeated errors stop. Saved source updates only after a successful build and only if the original files have not changed. Stop cancels the client operation; the companion also enforces job timeouts and cleanup. This path still requires real Docker/model E2E verification.

## Storage, export and security limits

IndexedDB is local working storage, not permanent backup. Keep ZIP/JSON backups. Existing source-path limits remain. No generated project code is newly stored in Supabase. Dependencies and project code are untrusted; do not enable unrestricted host-shell execution. Container limits are implemented but escape resistance and network enforcement have not been audited on a real daemon. No production security certification is implied.

## Verification state (2026-10-27)

The companion default port matches the workspace endpoint, Windows Docker Desktop CLI/helper resolution works, and eight focused tests pass. Docker Desktop is active through WSL2 and `hello-world` passed with automatic container cleanup. Its daemon does not report rootless mode; the preflight refuses it, so no project code ran. React/Vite live previews, Python servers, persistent sessions, and container escape resistance remain unverified. The current companion endpoint only runs ephemeral install/build actions.
