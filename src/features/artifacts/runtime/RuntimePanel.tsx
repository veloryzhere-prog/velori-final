import { repairBuild } from "./repair";
import { localConversation } from "./local-provider";
import { parseSourceFiles } from "../multi-file";
import { fileChanges } from "./policy";
import { Dialog } from "../../../components/ui";
import { companionRequest } from "./companion-client";
/* Copyright © 2026 VELORYZ. */
import { useEffect, useRef, useState } from "react";
import type { SourceFile } from "../multi-file.ts";
import { BrowserRuntime, type RuntimeEvent } from "./browser.ts";
import { runtimePreflight } from "./policy.ts";
export function RuntimePanel({
  files,
  onEvent,
  activity = false,
  onRepair,
}: {
  files: SourceFile[];
  onRepair: (before: SourceFile[], after: SourceFile[]) => void;
  activity?: boolean;
  onEvent: (event: RuntimeEvent) => void;
}) {
  const [busy, setBusy] = useState(false),
    [url, setUrl] = useState(""),
    [consent, setConsent] = useState(false);
  const [status, setStatus] = useState(
    "Check runtime compatibility before executing project code.",
  );
  const [device, setDevice] = useState("desktop"),
    [tab, setTab] = useState("preview");
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  useEffect(() => {
    setTab(activity ? "terminal" : "preview");
  }, [activity]);
  const [desktopEndpoint, setDesktopEndpoint] = useState("http://127.0.0.1:7331");
  const [pairing, setPairing] = useState("");
  const [repairEndpoint, setRepairEndpoint] = useState("http://127.0.0.1:11434");
  const [repairModel, setRepairModel] = useState("");
  const [approval, setApproval] = useState<{ before: SourceFile[]; next: SourceFile[] } | null>(
    null,
  );
  const approvalResolver = useRef<((value: boolean) => void) | null>(null);
  useEffect(() => () => approvalResolver.current?.(false), []);
  async function buildAndRepair() {
    if (busy || !consent || !repairModel.trim()) return;
    setBusy(true);
    controller.current = new AbortController();
    const signal = controller.current.signal;
    try {
      const result = await repairBuild({
        files,
        attempts: 2,
        signal,
        build: async (source) => {
          const response = await companionRequest(
            desktopEndpoint,
            pairing,
            { action: "build", files: source, allowRegistryNetwork: true },
            signal,
          );
          if (!Number.isInteger(response.exitCode))
            throw Error("Companion returned no build exit code.");
          return { exitCode: response.exitCode!, output: response.output ?? "" };
        },
        propose: async (source, diagnostic) => {
          const answer = await localConversation(
            { endpoint: repairEndpoint, model: repairModel },
            [
              {
                role: "system",
                content:
                  'Return only JSON {"files":[{"path":string,"content":string}]}. Repair the build diagnostic minimally. Preserve every unrelated file. Never request secrets or deletion.',
              },
              { role: "user", content: JSON.stringify({ files: source, diagnostic }) },
            ],
            signal,
          );
          return parseSourceFiles(JSON.parse(answer).files);
        },
        approve: async (before, next) => {
          setApproval({ before, next });
          return new Promise<boolean>((resolve) => {
            const onAbort = () => {
              setApproval(null);
              resolve(false);
            };
            signal.addEventListener("abort", onAbort, { once: true });
            approvalResolver.current = (value) => {
              signal.removeEventListener("abort", onAbort);
              approvalResolver.current = null;
              setApproval(null);
              resolve(value);
            };
          });
        },
        event: (text, result) => {
          message(result && result.exitCode !== 0 ? "error" : "status", text);
          if (result?.output) message("output", result.output);
        },
      });
      signal.throwIfAborted();
      if (result.result.exitCode === 0 && result.repaired) {
        onRepair(files, result.files);
        message(
          "status",
          "Verified repaired source offered to the workspace. The source commit is rejected if your original files changed.",
        );
      } else if (result.result.exitCode !== 0)
        message("error", "Repair stopped. The original source is preserved.");
    } catch (error) {
      message("error", error instanceof Error ? error.message : "Repair failed.");
    } finally {
      if (active.current) {
        setApproval(null);
        setBusy(false);
      }
    }
  }
  async function desktop(action: "preflight" | "build") {
    if (busy || (action === "build" && !consent)) return;
    setBusy(true);
    controller.current = new AbortController();
    try {
      const result = await companionRequest(
        desktopEndpoint,
        pairing,
        { action, ...(action === "build" ? { files, allowRegistryNetwork: consent } : {}) },
        controller.current.signal,
      );
      message(
        "status",
        action === "preflight"
          ? `Companion: rootless ${result.rootless ? "ready" : "unavailable"}, Node build ${result.nodeBuild ? "ready" : "unavailable"}, Python syntax ${result.pythonCompile ? "ready" : "unavailable"}. Persistent previews are unavailable.`
          : `Companion build finished with exit code ${result.exitCode}.`,
      );
      if (result.output) message(result.exitCode === 0 ? "output" : "error", result.output);
      if (result.note) message("status", result.note);
    } catch (error) {
      message("error", error instanceof Error ? error.message : "Companion unavailable.");
    } finally {
      if (active.current) setBusy(false);
    }
  }
  const runtime = useRef<BrowserRuntime | null>(null),
    controller = useRef<AbortController | null>(null);
  const active = useRef(true),
    callback = useRef(onEvent);
  callback.current = onEvent;
  const emit = (event: RuntimeEvent) => {
    if (!active.current) return;
    setEvents((rows) => [...rows, event].slice(-120));
    setStatus(event.kind === "output" ? "Command output received." : event.message);
    callback.current(event);
    if (event.kind === "preview") setUrl(event.message);
  };
  const message = (kind: RuntimeEvent["kind"], text: string) =>
    emit({ kind, message: text, time: new Date().toISOString() });
  function stop() {
    controller.current?.abort();
    runtime.current?.stop();
    runtime.current = null;
    setUrl("");
    setBusy(false);
    message("status", "Runtime stopped. Local source is preserved.");
  }
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
      runtime.current?.stop();
    };
  }, []);
  async function preflight() {
    const errors = runtimePreflight({
      secure: window.isSecureContext,
      isolated: window.crossOriginIsolated,
      sharedMemory: typeof SharedArrayBuffer !== "undefined",
      licensed: import.meta.env.VITE_FORGE_BROWSER_RUNTIME_LICENSED === "true",
    });
    try {
      if (!("indexedDB" in window))
        errors.push("IndexedDB is unavailable. Export a backup before running.");
      const quota = await navigator.storage?.estimate();
      if (quota?.quota && quota.usage && quota.usage / quota.quota > 0.9)
        errors.push("Browser storage is nearly full. Export a backup and free space.");
    } catch {
      errors.push("Browser storage could not be checked.");
    }
    errors.forEach((error) => message("error", error));
    if (!errors.length)
      message(
        "status",
        "Browser prerequisites passed. Runtime and package manager readiness will be verified during initialization.",
      );
    return errors.length === 0;
  }
  async function run() {
    if (busy || !consent) return;
    setBusy(true);
    try {
      if (!(await preflight())) return;
      runtime.current?.stop();
      setUrl("");
      controller.current = new AbortController();
      const runner = new BrowserRuntime(emit);
      runtime.current = runner;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          runner.boot(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  Error(
                    "Runtime initialization timed out. Stop and retry or use a supported browser.",
                  ),
                ),
              30000,
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      const plan = await runner.mount(files);
      message(
        "status",
        `Detected ${plan.manager}; ${plan.locked ? "lockfile integrity enforced" : "no lockfile: resolved packages may change on reinstall"}. Dependency lifecycle scripts are disabled.`,
      );
      const install = await runner.command(plan.install, true, controller.current.signal);
      if (install.exitCode !== 0)
        throw Error(
          `Dependency installation failed (${install.exitCode}). Review terminal output; no application was started.`,
        );
      message("status", "Installation completed.");
      if (plan.scripts.build) {
        const build = await runner.command(
          { executable: plan.manager, args: ["run", "build"] },
          true,
          controller.current.signal,
        );
        if (build.exitCode !== 0)
          throw Error(
            `Build failed (${build.exitCode}). Source is preserved. Review diagnostics before requesting a repair.`,
          );
        message("status", "Build succeeded.");
      }
      await runner.command(
        { executable: plan.manager, args: ["run", "dev"] },
        false,
        controller.current.signal,
      );
      message("status", "Development process started. Waiting for its server port.");
    } catch (error) {
      message("error", error instanceof Error ? error.message : "Runtime failed.");
      runtime.current?.stop();
      runtime.current = null;
      setUrl("");
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <section className="vf-preview vf-runtime" aria-label="Application runtime">
      <Dialog
        open={!!approval}
        title="Review repair before applying"
        onClose={() => approvalResolver.current?.(false)}
        actions={
          <>
            <button className="button" onClick={() => approvalResolver.current?.(false)}>
              Keep source
            </button>
            <button
              className="button button-primary"
              onClick={() => approvalResolver.current?.(true)}
            >
              Approve sandbox repair
            </button>
          </>
        }
      >
        <p>
          Each approved revision is rebuilt in a fresh sandbox. Your saved project updates only
          after a successful build.
        </p>
        {approval &&
          fileChanges(approval.before, approval.next).map((change) => (
            <details key={change.path}>
              <summary>{change.path}</summary>
              <pre className="vf-terminal">{`--- Before\n${change.before ?? ""}\n+++ After\n${change.after ?? ""}`}</pre>
            </details>
          ))}
      </Dialog>
      <div className="vf-panel-bar">
        <strong>Application workspace</strong>
        <div>
          <button onClick={() => setTab("preview")} aria-pressed={tab === "preview"}>
            Preview
          </button>
          <button onClick={() => setTab("terminal")} aria-pressed={tab === "terminal"}>
            Terminal
          </button>
        </div>
      </div>
      <div className="vf-runtime-tools">
        <button disabled={busy} onClick={() => void preflight()}>
          Check compatibility
        </button>
        <button disabled={busy || !consent} onClick={() => void run()}>
          {busy ? "Starting…" : "Install, build & run"}
        </button>
        <button onClick={stop}>Stop</button>
      </div>
      <details className="vf-provider-settings">
        <summary>Local desktop companion</summary>
        <label>
          Companion endpoint
          <input value={desktopEndpoint} onChange={(e) => setDesktopEndpoint(e.target.value)} />
        </label>
        <label>
          Temporary pairing token
          <input
            type="password"
            autoComplete="off"
            value={pairing}
            onChange={(e) => setPairing(e.target.value)}
          />
        </label>
        <p>
          The token stays in memory. Build sends this project's files to your explicitly chosen
          localhost companion. Rootless Docker and reviewed digest-pinned images are required.
        </p>
        <button disabled={busy} onClick={() => void desktop("preflight")}>
          Check companion
        </button>
        <button disabled={busy || !consent} onClick={() => void desktop("build")}>
          Build with companion
        </button>
      </details>
      <details className="vf-provider-settings">
        <summary>Build repair · local model</summary>
        <p>
          Up to two repairs through the paired desktop build sandbox. Each change requires approval.
          Source and diagnostics go only to the chosen localhost model.
        </p>
        <label>
          Local model server
          <input value={repairEndpoint} onChange={(e) => setRepairEndpoint(e.target.value)} />
        </label>
        <label>
          Installed model
          <input value={repairModel} onChange={(e) => setRepairModel(e.target.value)} />
        </label>
        <button
          disabled={busy || !consent || !repairModel.trim()}
          onClick={() => void buildAndRepair()}
        >
          Build and repair
        </button>
      </details>
      <label className="vf-runtime-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{" "}
        Allow runtime downloads and registry access. Run this project’s untrusted build/dev scripts
        inside the browser runtime. External requests from project code are possible. Source is
        mounted locally.
      </label>
      {tab === "terminal" ? (
        <pre className="vf-terminal" aria-label="Actual runtime output">
          {events.map((e) => `[${e.time}] ${e.message}`).join("\n") || "No commands have run."}
        </pre>
      ) : (
        <>
          <div className="vf-device-tools">
            {["phone", "tablet", "desktop"].map((name) => (
              <button key={name} aria-pressed={device === name} onClick={() => setDevice(name)}>
                {name}
              </button>
            ))}
            {url && (
              <a href={url} target="_blank" rel="noreferrer">
                Open preview ↗
              </a>
            )}
          </div>
          {url ? (
            <iframe
              className={`vf-runtime-frame vf-device-${device}`}
              title="Running application development server"
              src={url}
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="vf-runtime-empty">
              <h3>Run your application.</h3>
              <p>
                Execution starts only after compatibility and license checks pass. Python and native
                dependencies need a supported desktop adapter.
              </p>
            </div>
          )}
        </>
      )}
      <p className="vf-preview-status" role="status">
        {status}
      </p>
    </section>
  );
}
