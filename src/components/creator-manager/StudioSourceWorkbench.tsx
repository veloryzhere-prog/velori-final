import CodeMirror from "@uiw/react-codemirror";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  AlertTriangle,
  Check,
  Code2,
  Eye,
  FileCode2,
  GitBranch,
  Play,
  Save,
  Settings2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  AdminApiError,
  adminCreateCreatorSourcePullRequest,
  adminCreatorSourceFile,
  adminCreatorSourceFiles,
} from "../../lib/admin-api";
import { useScreenReauth } from "../../app/admin-console/frame";
import { usePermission } from "../../app/admin-console/session";
import { useGuardedAction } from "../../app/admin-console/widgets";
import type { StudioTarget } from "./CreatorManager.types";

type SourceFile = { path: string; bytes: number; version: string; baseSha?: string };
type LoadedFile = SourceFile & { content: string; savedContent: string; baseSha?: string };
type SourceMode = "visual" | "source";
type SyncResult = {
  state: "success" | "failed" | "unchanged";
  committed?: boolean;
  pushed?: boolean;
  retryAvailable?: boolean;
  path?: string;
  branch?: string;
  commit?: string;
  message?: string;
  timestamp?: string;
  error?: string;
  deployment?: { state: string; message: string };
};
type RunResult = {
  action?: string;
  code: number | null;
  output: string;
  deployed: false;
  url?: string;
  sync?: SyncResult;
};
type GitReview = {
  branch: string;
  detached: boolean;
  remoteConfigured: boolean;
  remoteName?: string;
  upstreamBranch?: string;
  upstreamConfigured?: boolean;
  stagedChanges: boolean;
  otherChanges: number;
  changes: Array<{ path: string; status: string; eligible: boolean; reason: string; diff: string }>;
  fingerprint: string;
  deployment: { state: string; message: string };
};
type PendingSync = { path: string; branch: string; commit: string; message: string };

const studioLabels: Record<StudioTarget, string> = { story: "Story", reel: "Reel", post: "Post" };
const studioRoutes: Record<StudioTarget, string> = {
  story: "/stories/create",
  reel: "/reels/create",
  post: "/create",
};

function extension(path: string) {
  const match = path.match(/\.[^.]+$/);
  return match?.[0].toLowerCase() ?? "";
}

function editorExtensions(path: string) {
  const ext = extension(path);
  if (ext === ".css") return [css()];
  if (ext === ".html") return [html()];
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".json"].includes(ext))
    return [
      javascript({
        jsx: [".tsx", ".jsx"].includes(ext),
        typescript: [".ts", ".tsx"].includes(ext),
      }),
    ];
  return [];
}

function changedLines(before: string, after: string) {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const rows: Array<{ kind: "same" | "removed" | "added"; text: string }> = [];
  let left = 0;
  let right = 0;
  while (left < oldLines.length || right < newLines.length) {
    if (oldLines[left] === newLines[right]) {
      rows.push({ kind: "same", text: `  ${oldLines[left] ?? ""}` });
      left += 1;
      right += 1;
    } else {
      if (left < oldLines.length) rows.push({ kind: "removed", text: `- ${oldLines[left++]}` });
      if (right < newLines.length) rows.push({ kind: "added", text: `+ ${newLines[right++]}` });
    }
    if (rows.length > 500) {
      rows.push({ kind: "same", text: "… diff truncated after 500 lines" });
      break;
    }
  }
  return rows;
}

export function StudioSourceWorkbench({
  studio,
  mode,
  onModeChange,
  onStudioChange,
}: {
  studio: StudioTarget;
  mode: SourceMode;
  onModeChange: (mode: SourceMode) => void;
  onStudioChange: (studio: StudioTarget) => void;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [activePath, setActivePath] = useState("");
  const [loaded, setLoaded] = useState<Record<string, LoadedFile>>({});
  const [fileSearch, setFileSearch] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [action, setAction] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");
  const [deploymentStatus, setDeploymentStatus] = useState("Not connected");
  const [gitReview, setGitReview] = useState<GitReview | null>(null);
  const [showGitReview, setShowGitReview] = useState(false);
  const [pendingSync, setPendingSync] = useState<PendingSync | null>(null);
  const [pullRequestDialog, setPullRequestDialog] = useState(false);
  const [pullRequestTitle, setPullRequestTitle] = useState("Creator studio source update");
  const [pullRequestBody, setPullRequestBody] = useState("");
  const [pullRequestReviewed, setPullRequestReviewed] = useState(false);
  const canWrite = usePermission("motion.write");
  const reauth = useScreenReauth();
  const { guarded, busy: reauthBusy } = useGuardedAction(reauth);
  const localMode = import.meta.env.DEV;

  const activeFile = loaded[activePath];
  const dirty = Boolean(activeFile && activeFile.content !== activeFile.savedContent);
  const hasDirtyFiles = Object.values(loaded).some((file) => file.content !== file.savedContent);
  const filteredFiles = useMemo(
    () => files.filter((file) => file.path.toLowerCase().includes(fileSearch.toLowerCase())),
    [files, fileSearch],
  );
  const tabs = openPaths
    .map((path) => loaded[path])
    .filter((file): file is LoadedFile => Boolean(file));

  async function loadFiles(target: StudioTarget) {
    setError("");
    setAvailable(null);
    setLoaded({});
    setOpenPaths([]);
    setActivePath("");
    setGitReview(null);
    setShowGitReview(false);
    setPendingSync(null);
    try {
      if (localMode) {
        const response = await fetch(`/__velori_source/files?studio=${target}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as {
          files?: SourceFile[];
          error?: string;
        };
        if (!response.ok || !Array.isArray(payload.files))
          throw new Error(
            payload.error || "The trusted local source integration is not available.",
          );
        setFiles(payload.files);
        const status = await fetch("/__velori_source/status", { cache: "no-store" });
        const statusPayload = (await status.json().catch(() => ({}))) as {
          deployment?: { state?: string; message?: string };
        };
        setDeploymentStatus(
          statusPayload.deployment?.message ?? "No deployment provider connected.",
        );
        try {
          const pendingResponse = await fetch(`/__velori_source/git/pending?studio=${target}`, {
            cache: "no-store",
          });
          const pendingPayload = (await pendingResponse.json().catch(() => ({}))) as {
            pending?: PendingSync | null;
          };
          setPendingSync(pendingPayload.pending ?? null);
        } catch {
          setPendingSync(null);
        }
      } else {
        const manifest = await adminCreatorSourceFiles();
        setFiles(
          manifest.files.map((file) => ({
            path: file.path,
            bytes: file.bytes,
            version: file.sha,
            baseSha: manifest.baseSha,
          })),
        );
        setDeploymentStatus(manifest.deployment.message);
      }
      setAvailable(true);
    } catch (cause) {
      setFiles([]);
      setAvailable(false);
      setError(
        cause instanceof AdminApiError && cause.status === 404
          ? "The source-management service is not deployed on this server. Visual studio controls remain available. Deploy the matching server integration to browse files and create pull requests."
          : cause instanceof Error
            ? cause.message
            : "Source files could not be loaded.",
      );
    }
  }

  useEffect(() => {
    void loadFiles(studio);
  }, [studio]);

  async function openFile(file: SourceFile) {
    if (loaded[file.path]) {
      setActivePath(file.path);
      setShowDiff(false);
      return;
    }
    setError("");
    try {
      let payload: {
        path?: string;
        content?: string;
        version?: string;
        baseSha?: string;
        error?: string;
      };
      let ok = false;
      if (localMode) {
        const response = await fetch(
          `/__velori_source/file?studio=${studio}&path=${encodeURIComponent(file.path)}`,
          { cache: "no-store" },
        );
        payload = (await response.json()) as typeof payload;
        ok = response.ok;
      } else {
        const loadedSource = await adminCreatorSourceFile(file.path);
        payload = { ...loadedSource, version: loadedSource.sha };
        ok = true;
      }
      if (!ok || typeof payload.content !== "string" || !payload.version)
        throw new Error(payload.error || "The source file could not be opened.");
      const entry: LoadedFile = {
        ...file,
        content: payload.content,
        savedContent: payload.content,
        version: payload.version,
        baseSha: payload.baseSha ?? file.baseSha,
      };
      setLoaded((current) => ({ ...current, [file.path]: entry }));
      setOpenPaths((current) => [...current, file.path]);
      setActivePath(file.path);
      setShowDiff(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The source file could not be opened.");
    }
  }

  async function saveFile() {
    if (!localMode || !activeFile || !dirty) return;
    setAction("save");
    setError("");
    try {
      const response = await fetch("/__velori_source/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studio,
          path: activeFile.path,
          content: activeFile.content,
          expectedVersion: activeFile.version,
        }),
      });
      const payload = (await response.json()) as {
        path?: string;
        version?: string;
        saved?: boolean;
        changed?: boolean;
        sync?: SyncResult;
        error?: string;
      };
      if (!response.ok || !payload.version)
        throw new Error(payload.error || "Source could not be saved.");
      setLoaded((current) => ({
        ...current,
        [activePath]: {
          ...current[activePath],
          version: payload.version!,
          savedContent: current[activePath].content,
          bytes: new Blob([current[activePath].content]).size,
        },
      }));
      setResult({
        action: "save",
        code: 0,
        output:
          payload.changed === false
            ? `${activeFile.path} already matches the saved local file. No commit was created.`
            : payload.sync?.pushed
              ? `Saved, committed, and verified ${activeFile.path} on GitHub. ${payload.sync.deployment?.message ?? ""}`
              : `Saved ${activeFile.path} locally. Git synchronization did not complete.`,
        deployed: false,
        sync: payload.sync,
      });
      if (payload.sync?.deployment) setDeploymentStatus(payload.sync.deployment.message);
      if (payload.sync?.state === "success") setPendingSync(null);
      else if (payload.sync?.retryAvailable && payload.sync.commit)
        setPendingSync({
          path: payload.sync.path ?? activeFile.path,
          branch: payload.sync.branch ?? "",
          commit: payload.sync.commit,
          message: payload.sync.message ?? "Source workbench commit",
        });
      if (localMode)
        void fetch(`/__velori_source/git/pending?studio=${studio}`, { cache: "no-store" })
          .then((pendingResponse) => pendingResponse.json())
          .then((pendingPayload: { pending?: PendingSync | null }) =>
            setPendingSync(pendingPayload.pending ?? null),
          )
          .catch(() => {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Source could not be saved.");
    } finally {
      setAction("");
    }
  }

  async function refreshGitReview() {
    setError("");
    setAction("git-status");
    try {
      const response = await fetch(`/__velori_source/git/status?studio=${studio}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as GitReview & { error?: string };
      if (!response.ok || !Array.isArray(payload.changes))
        throw new Error(payload.error || "The local Git status could not be read.");
      setGitReview(payload);
      setShowGitReview(true);
      setDeploymentStatus(payload.deployment.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The local Git status could not be read.");
    } finally {
      setAction("");
    }
  }

  async function retryGitHubSync() {
    if (!pendingSync || action) return;
    setAction("retry-push");
    setError("");
    try {
      const response = await fetch("/__velori_source/git/retry-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studio, commit: pendingSync.commit }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        sync?: SyncResult;
        error?: string;
      };
      const sync = payload.sync;
      setResult({
        action: "retry-push",
        code: sync?.pushed ? 0 : 1,
        output: sync?.pushed
          ? `Verified ${sync.commit?.slice(0, 12) ?? "the source commit"} on GitHub.`
          : (sync?.error ?? payload.error ?? "GitHub did not confirm the retry."),
        deployed: false,
        sync: sync ? { ...sync, state: sync.pushed ? "success" : "failed" } : undefined,
      });
      if (sync?.deployment) setDeploymentStatus(sync.deployment.message);
      if (sync?.pushed) setPendingSync(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "GitHub retry failed.");
    } finally {
      setAction("");
    }
  }

  async function retryNetlifyDeployment() {
    const commit = result?.sync?.commit;
    if (!commit || action) return;
    setAction("deploy");
    setError("");
    try {
      const response = await fetch("/__velori_source/deploy/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studio, commit }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        deployment?: { state: string; message: string };
        error?: string;
      };
      if (!payload.deployment)
        throw new Error(payload.error || "Netlify deployment could not be retried.");
      setDeploymentStatus(payload.deployment.message);
      setResult((current) =>
        current?.sync
          ? {
              ...current,
              sync: { ...current.sync, deployment: payload.deployment },
            }
          : current,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Netlify deployment could not be retried.");
    } finally {
      setAction("");
    }
  }

  const hostedDirtyFiles = Object.values(loaded).filter(
    (file) => file.content !== file.savedContent,
  );

  async function createPullRequest() {
    if (!hostedDirtyFiles.length || !hostedDirtyFiles.every((file) => file.baseSha)) return;
    const baseSha = hostedDirtyFiles[0].baseSha!;
    if (!hostedDirtyFiles.every((file) => file.baseSha === baseSha)) {
      setError(
        "These files came from different GitHub revisions. Reload them before creating a review.",
      );
      return;
    }
    setError("");
    try {
      await guarded(async () => {
        const result = await adminCreateCreatorSourcePullRequest({
          title: pullRequestTitle,
          body: pullRequestBody,
          baseSha,
          files: hostedDirtyFiles.map((file) => ({
            path: file.path,
            content: file.content,
            sha: file.version,
          })),
        });
        setResult({
          action: "pull-request",
          code: 0,
          output: result.reused
            ? `Reused existing review pull request #${result.pullRequest.number}. The hosted website has not been deployed.`
            : `Review pull request #${result.pullRequest.number} is open. The hosted website has not been deployed.`,
          deployed: false,
          url: result.pullRequest.url,
        });
        setDeploymentStatus(result.deployment.message);
        setPullRequestDialog(false);
        setPullRequestReviewed(false);
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The GitHub review request failed.");
    }
  }

  async function run(actionName: "typecheck" | "test" | "build" | "format") {
    if (hasDirtyFiles) {
      setError("Save or discard every changed file before running a project check.");
      return;
    }
    if (actionName === "format" && !activeFile) return;
    setAction(actionName);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/__velori_source/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionName,
          studio,
          path: actionName === "format" ? activePath : undefined,
        }),
      });
      const payload = (await response.json()) as RunResult & { error?: string };
      if (!response.ok && typeof payload.output !== "string")
        throw new Error(payload.error || `${actionName} could not run.`);
      setResult(payload);
      if (actionName === "format" && payload.code === 0 && activeFile) {
        const fileResponse = await fetch(
          `/__velori_source/file?studio=${studio}&path=${encodeURIComponent(activePath)}`,
          { cache: "no-store" },
        );
        const filePayload = (await fileResponse.json()) as { content?: string; version?: string };
        if (fileResponse.ok && typeof filePayload.content === "string" && filePayload.version) {
          setLoaded((current) => ({
            ...current,
            [activePath]: {
              ...current[activePath],
              content: filePayload.content!,
              savedContent: filePayload.content!,
              version: filePayload.version!,
              bytes: new Blob([filePayload.content!]).size,
            },
          }));
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `${actionName} could not run.`);
    } finally {
      setAction("");
    }
  }

  function closeTab(
    event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>,
    path: string,
  ) {
    event.stopPropagation();
    if (
      loaded[path]?.content !== loaded[path]?.savedContent &&
      !window.confirm("Discard unsaved changes in this tab?")
    )
      return;
    setOpenPaths((current) => current.filter((item) => item !== path));
    setLoaded((current) => {
      const next = { ...current };
      delete next[path];
      return next;
    });
    if (activePath === path) setActivePath(openPaths.find((item) => item !== path) ?? "");
  }

  function handleEditorKey(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (localMode) void saveFile();
      else
        setError(
          "Hosted changes are sent to the GitHub review workflow; they are not saved to this server's filesystem.",
        );
    }
  }

  return (
    <div className="cm-source-workbench">
      <div className="cm-studio-modebar">
        <div className="cm-mode-tabs">
          <button
            className={`cm-button${mode === "visual" ? " cm-button-blue" : ""}`}
            onClick={() => onModeChange("visual")}
          >
            <Eye size={14} /> Visual Design
          </button>
          <button
            className={`cm-button${mode === "source" ? " cm-button-blue" : ""}`}
            onClick={() => onModeChange("source")}
          >
            <Code2 size={14} /> Full Source Code
          </button>
        </div>
        <div className="cm-target-tabs" aria-label="Source target">
          {(["story", "reel", "post"] as const).map((target) => (
            <button
              key={target}
              className={`cm-target-tab${studio === target ? " active" : ""}`}
              onClick={() => onStudioChange(target)}
            >
              {studioLabels[target]}
            </button>
          ))}
        </div>
      </div>
      {mode === "visual" ? (
        <section className="cm-design-preview">
          <div className="cm-preview-toolbar">
            <strong>Actual {studioLabels[studio]} Studio</strong>
            <span>Existing editor route</span>
            <a className="cm-button" href={studioRoutes[studio]} target="_blank" rel="noreferrer">
              Open editor ↗
            </a>
          </div>
          <iframe
            className="cm-preview-device"
            src={studioRoutes[studio]}
            title={`${studioLabels[studio]} Studio visual design`}
          />
        </section>
      ) : (
        <>
          <div className="cm-workbench-actions cm-workbench-top-actions">
            <label className="cm-source-target">
              <span>Source target</span>
              <select
                className="cm-select"
                value={studio}
                onChange={(event) => onStudioChange(event.target.value as StudioTarget)}
              >
                {(["story", "reel", "post"] as const).map((target) => (
                  <option key={target} value={target}>
                    {studioLabels[target]}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="cm-button cm-button-primary"
              onClick={() => void saveFile()}
              disabled={!localMode || !available || !dirty || action !== ""}
              title={
                localMode
                  ? "Save this file locally, then attempt a scoped Git commit and GitHub push"
                  : "Local file saving is available only in development; create a GitHub review pull request here"
              }
            >
              <Save size={14} />
              {action === "save" ? "Saving and syncing..." : "Save File"}
            </button>
            <button
              className="cm-button"
              onClick={() => {
                setShowDiff((value) => !value);
              }}
              disabled={!activeFile}
            >
              <FileCode2 size={14} />
              {showDiff ? "Editor" : "Diff"}
            </button>
            {localMode ? (
              <button
                className="cm-button"
                onClick={() => void refreshGitReview()}
                disabled={!available || hasDirtyFiles || action !== ""}
              >
                <GitBranch size={14} /> {action === "git-status" ? "Loading diff…" : "View Diff"}
              </button>
            ) : (
              <button
                className="cm-button cm-button-primary"
                onClick={() => setPullRequestDialog(true)}
                disabled={!available || !canWrite || !hostedDirtyFiles.length || reauthBusy}
              >
                <UploadCloud size={14} /> Create Pull Request
              </button>
            )}
            <button
              className="cm-button"
              onClick={() => void run("format")}
              disabled={!localMode || !available || !activeFile || hasDirtyFiles || action !== ""}
            >
              <Settings2 size={14} />
              {action === "format" ? "Formatting…" : "Format"}
            </button>
            <button
              className="cm-button"
              onClick={() => void run("typecheck")}
              disabled={!localMode || !available || hasDirtyFiles || action !== ""}
            >
              <Check size={14} />
              {action === "typecheck" ? "Checking…" : "Validate"}
            </button>
            <button
              className="cm-button"
              onClick={() => void run("test")}
              disabled={!localMode || !available || hasDirtyFiles || action !== ""}
            >
              <Play size={14} />
              {action === "test" ? "Testing…" : "Test"}
            </button>
            <button
              className="cm-button"
              onClick={() => void run("build")}
              disabled={!localMode || !available || hasDirtyFiles || action !== ""}
            >
              <Settings2 size={14} />
              {action === "build" ? "Building…" : "Check Build"}
            </button>
          </div>
          <div className="cm-source-operation-note" role="status">
            <strong>
              {localMode ? "Local development workflow" : "Hosted GitHub review workflow"}
            </strong>
            <span>
              {localMode
                ? action === "save"
                  ? "Saving updates this local development site immediately. After a verified GitHub push to the configured Netlify branch, Creator Studio requests a hosted deploy."
                  : "Save File updates this local development site immediately. After a verified GitHub push to the configured Netlify branch, Creator Studio requests a hosted deploy."
                : "Source edits are sent to the server-side GitHub App to create a review branch and pull request. They do not write to this server's filesystem or deploy the website."}
            </span>
            <span>
              <b>Deployment:</b> {deploymentStatus}
            </span>
          </div>
          {localMode && pendingSync ? (
            <section className="cm-sync-result is-warning" aria-live="polite">
              <strong>Local commit waiting for GitHub</strong>
              <p>
                {pendingSync.path} · {pendingSync.branch} · {pendingSync.commit.slice(0, 12)}
              </p>
              <button
                className="cm-button cm-button-primary"
                type="button"
                onClick={() => void retryGitHubSync()}
                disabled={action !== ""}
              >
                {action === "retry-push" ? "Retrying GitHub push…" : "Retry GitHub Sync"}
              </button>
            </section>
          ) : null}
          {result?.sync ? (
            <section
              className={`cm-sync-result${result.sync.state === "failed" ? " is-warning" : ""}`}
              aria-live="polite"
              aria-label="Source save and GitHub synchronization result"
            >
              <strong>
                {result.sync.state === "success"
                  ? "GitHub synchronization successful"
                  : result.sync.state === "unchanged"
                    ? "No source changes to synchronize"
                    : "GitHub synchronization failed"}
              </strong>
              <div className="cm-sync-status-grid">
                <span>
                  <b>Saved locally</b>
                  {result.action === "retry-push" || result.sync.state !== "unchanged"
                    ? "Yes"
                    : "No change"}
                </span>
                <span>
                  <b>Committed locally</b>
                  {result.sync.committed ? "Yes" : "No"}
                </span>
                <span>
                  <b>Pushed to GitHub</b>
                  {result.sync.pushed ? "Confirmed" : "Not confirmed"}
                </span>
              </div>
              {result.sync.path ? (
                <p>
                  File: <code>{result.sync.path}</code>
                </p>
              ) : null}
              {result.sync.branch ? (
                <p>
                  Branch: <code>{result.sync.branch}</code>
                </p>
              ) : null}
              {result.sync.commit ? (
                <p>
                  Commit: <code>{result.sync.commit}</code>
                  {result.sync.message ? ` · ${result.sync.message}` : ""}
                </p>
              ) : null}
              {result.sync.timestamp ? (
                <p>
                  GitHub confirmation:{" "}
                  <time dateTime={result.sync.timestamp}>
                    {new Date(result.sync.timestamp).toLocaleString()}
                  </time>
                </p>
              ) : null}
              {result.sync.deployment ? (
                <p>
                  <b>Hosted deployment:</b> {result.sync.deployment.message}
                </p>
              ) : null}
              {result.sync.deployment?.state === "failed" && result.sync.pushed ? (
                <button
                  className="cm-button cm-button-primary"
                  type="button"
                  onClick={() => void retryNetlifyDeployment()}
                  disabled={action !== ""}
                >
                  {action === "deploy" ? "Queueing Netlify deploy…" : "Retry Netlify Deploy"}
                </button>
              ) : null}
              {result.sync.error ? <p role="alert">{result.sync.error}</p> : null}
            </section>
          ) : null}
          {error ? (
            <div className="cm-unsupported" role="alert">
              <AlertTriangle size={15} /> {error}
            </div>
          ) : null}
          {available === null ? (
            <div className="cm-unsupported">
              Loading the actual {studioLabels[studio]} source tree…
            </div>
          ) : null}
          {!available && available !== null ? (
            <div className="cm-unsupported">
              <strong>
                {localMode
                  ? "Trusted local source service unavailable"
                  : "Hosted GitHub source service unavailable"}
              </strong>
              <br />
              {localMode
                ? "Source files can be edited only while this app is running through the local Vite development server."
                : "The server-side GitHub App must be configured before hosted source files can be browsed. The browser does not receive repository credentials or filesystem access."}
            </div>
          ) : null}
          {localMode && showGitReview && gitReview ? (
            <section className="cm-git-review" aria-label="Local Git change review">
              <header>
                <div>
                  <strong>Local Git review</strong>
                  <span>Branch: {gitReview.branch || "detached HEAD"}</span>
                </div>
                <button className="cm-button" type="button" onClick={() => setShowGitReview(false)}>
                  Close review
                </button>
              </header>
              {!gitReview.remoteConfigured ? (
                <p role="alert">
                  The configured upstream is not an available GitHub push remote. Files can be
                  reviewed, but automatic synchronization is unavailable.
                </p>
              ) : null}
              {!gitReview.upstreamConfigured ? (
                <p role="alert">
                  This branch has no configured upstream. Automatic sync will not guess a
                  destination.
                </p>
              ) : null}
              {gitReview.detached ? (
                <p role="alert">
                  This checkout is detached. Switch to a named branch before syncing.
                </p>
              ) : null}
              {gitReview.stagedChanges ? (
                <p>
                  Existing staged paths are preserved. Automatic sync commits only the saved source
                  file.
                </p>
              ) : null}
              {gitReview.otherChanges > 0 ? (
                <p>
                  {gitReview.otherChanges} changed file(s) outside this studio review are excluded
                  and will remain untouched.
                </p>
              ) : null}
              {gitReview.changes.length === 0 ? (
                <p>No changed source files are available for this studio target.</p>
              ) : null}
              {gitReview.changes.map((change) => (
                <article className="cm-git-change" key={change.path}>
                  <div className="cm-git-change-heading">
                    <code>{change.path}</code>
                    <span>{change.status}</span>
                  </div>
                  {!change.eligible ? <p role="note">Excluded: {change.reason}</p> : null}
                  <details>
                    <summary>Review diff</summary>
                    <pre>{change.diff || "No textual diff is available."}</pre>
                  </details>
                </article>
              ))}
            </section>
          ) : null}
          {!localMode && pullRequestDialog ? (
            <div className="cm-source-dialog-backdrop">
              <section
                className="cm-source-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="cm-pr-title"
              >
                <h2 id="cm-pr-title">Create a GitHub review pull request</h2>
                <p>
                  The server-side GitHub App creates a branch and review request. This does not
                  merge or deploy.
                </p>
                <ul>
                  {hostedDirtyFiles.map((file) => (
                    <li key={file.path}>
                      <code>{file.path}</code>
                    </li>
                  ))}
                </ul>
                <label>
                  Review title
                  <input
                    value={pullRequestTitle}
                    maxLength={120}
                    onChange={(event) => setPullRequestTitle(event.target.value)}
                  />
                </label>
                <label>
                  Review description
                  <textarea
                    value={pullRequestBody}
                    maxLength={4000}
                    onChange={(event) => setPullRequestBody(event.target.value)}
                    rows={4}
                  />
                </label>
                <label className="cm-source-confirm">
                  <input
                    type="checkbox"
                    checked={pullRequestReviewed}
                    onChange={(event) => setPullRequestReviewed(event.target.checked)}
                  />{" "}
                  I reviewed the listed file changes and want a pull request created.
                </label>
                {error ? <p role="alert">{error}</p> : null}
                <div className="cm-dialog-actions">
                  <button
                    className="cm-button"
                    type="button"
                    onClick={() => setPullRequestDialog(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="cm-button cm-button-primary"
                    type="button"
                    onClick={() => void createPullRequest()}
                    disabled={
                      !canWrite ||
                      !pullRequestReviewed ||
                      pullRequestTitle.trim().length < 5 ||
                      reauthBusy
                    }
                  >
                    {reauthBusy ? "Waiting for confirmation…" : "Create Review Pull Request"}
                  </button>
                </div>
              </section>
            </div>
          ) : null}
          <div className="cm-workbench">
            <aside className="cm-file-tree">
              <div className="cm-file-tree-header">
                <span>REAL SOURCE FILES</span>
                <span>{files.length}</span>
              </div>
              <label className="cm-file-search">
                <input
                  value={fileSearch}
                  onChange={(event) => setFileSearch(event.target.value)}
                  placeholder="Search files"
                  aria-label="Search source files"
                />
              </label>
              <div className="cm-file-list">
                {filteredFiles.map((file) => (
                  <button
                    key={file.path}
                    className={`cm-file-button${activePath === file.path ? " active" : ""}`}
                    onClick={() => void openFile(file)}
                    title={`${file.path} · ${file.bytes.toLocaleString()} bytes`}
                  >
                    {loaded[file.path]?.content !== loaded[file.path]?.savedContent ? "● " : ""}
                    {file.path}
                  </button>
                ))}
              </div>
            </aside>
            <section className="cm-editor-column" onKeyDownCapture={handleEditorKey}>
              <div className="cm-editor-tabs">
                {tabs.map((file) => (
                  <div
                    key={file.path}
                    className={`cm-editor-tab${activePath === file.path ? " active" : ""}`}
                    role="tab"
                    aria-selected={activePath === file.path}
                  >
                    <button
                      type="button"
                      onClick={() => setActivePath(file.path)}
                      title={file.path}
                    >
                      {file.path.split("/").at(-1)}{" "}
                      {file.content !== file.savedContent ? (
                        <span className="cm-dirty-dot" title="Unsaved changes" />
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="cm-tab-close"
                      aria-label={`Close ${file.path}`}
                      onClick={(event) => closeTab(event, file.path)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              {activeFile ? (
                showDiff ? (
                  <div className="cm-diff-view">
                    {changedLines(activeFile.savedContent, activeFile.content).map(
                      (line, index) => (
                        <div key={index} className={`cm-diff-line ${line.kind}`}>
                          {line.text}
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <CodeMirror
                    className="cm-code-editor"
                    value={activeFile.content}
                    height="480px"
                    theme={oneDark}
                    extensions={editorExtensions(activePath)}
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                      highlightActiveLine: true,
                      searchKeymap: true,
                      bracketMatching: true,
                      autocompletion: true,
                    }}
                    onChange={(value) =>
                      setLoaded((current) => ({
                        ...current,
                        [activePath]: { ...current[activePath], content: value },
                      }))
                    }
                  />
                )
              ) : (
                <div className="cm-code-empty">
                  <FileCode2 size={24} />
                  <strong>Open a real source file</strong>
                  <span>Pick a file from the {studioLabels[studio]} Studio source tree.</span>
                </div>
              )}
              <div className="cm-editor-status">
                <span>{activePath || "No file selected"}</span>
                <span>
                  {dirty ? "Unsaved changes" : activeFile ? "Saved in working tree" : "Ready"}
                </span>
                <span>
                  {localMode
                    ? "Ctrl/⌘+S saves the local file"
                    : "Changes remain a browser draft until you create a pull request"}{" "}
                  · Ctrl/⌘+F find/replace · Ctrl/⌘+Z undo
                </span>
              </div>
            </section>
            <aside className="cm-inspector">
              <div className="cm-inspector-header">
                <span>PREVIEW & BUILD</span>
                <a
                  href={studioRoutes[studio]}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${studioLabels[studio]} Studio`}
                >
                  <Eye size={14} />
                </a>
              </div>
              <div className="cm-target-tabs">
                {(["story", "reel", "post"] as const).map((target) => (
                  <button
                    key={target}
                    className={`cm-target-tab${studio === target ? " active" : ""}`}
                    onClick={() => onStudioChange(target)}
                  >
                    {studioLabels[target]}
                  </button>
                ))}
              </div>
              <iframe
                className="cm-inspector-preview"
                src={studioRoutes[studio]}
                title={`Actual ${studioLabels[studio]} Studio preview`}
              />
              <div className="cm-inspector-body">
                <p>
                  {activeFile
                    ? `${activeFile.bytes.toLocaleString()} bytes · ${extension(activePath).toUpperCase().replace(".", "")}`
                    : "Choose an actual file to inspect its source and validation state."}
                </p>
                <p>
                  Save writes only to the local working tree. Build and test run the fixed
                  repository scripts. These operations do not publish or deploy.
                </p>
                {result ? (
                  <>
                    <strong>
                      {result.action === "save" ? "Local save" : `${result.action} result`}:{" "}
                      {result.code === 0 ? "Passed" : "Failed"}
                    </strong>
                    <pre className="cm-check-output">
                      {result.output || "The operation completed without additional output."}
                    </pre>
                    {result.url ? (
                      <a href={result.url} target="_blank" rel="noreferrer">
                        Open GitHub pull request
                      </a>
                    ) : null}
                  </>
                ) : null}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
