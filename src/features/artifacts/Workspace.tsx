import { RuntimePanel } from "./runtime/RuntimePanel";
import type { ForgeLandingMode } from "./forge-landing-state";
import type { RuntimeEvent } from "./runtime/browser";
import { studioId } from "./identity.ts";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useBlocker } from "react-router";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import {
  ArrowLeft,
  Download,
  FileJson,
  Undo2,
  Play,
  Plus,
  X,
  FileCode2,
  Copy,
  FolderDown,
  Sparkles,
  HardDriveDownload,
  FolderTree,
  ShieldAlert,
  MonitorPlay,
  Settings2,
  Trash2,
  Search,
  Folder,
  Terminal as TerminalIcon,
  Activity,
  GitCompare,
  TriangleAlert,
  PanelLeftClose,
  PanelLeftOpen,
  Ellipsis,
} from "lucide-react";
import { Dialog } from "../../components/ui";
import { Assistant, useConnection } from "./Assistant";
import { Preview } from "./Preview";
import { downloadProject } from "./document";
import { validPath, type Code, type Project, type ForgeProjectSetup } from "./model.ts";
import {
  parseSourceFiles,
  safeSourcePath,
  reactStarterFiles,
  pythonApiStarterFiles,
} from "./multi-file.ts";
import { fileChanges } from "./runtime/policy.ts";
const mobileDestinations = [
  { id: "idea", label: "Chat" },
  { id: "files", label: "Files" },
  { id: "preview", label: "Preview" },
  { id: "code", label: "Code" },
  { id: "activity", label: "Activity" },
] as const;
const developmentTabs = [
  { id: "preview", label: "Preview", icon: MonitorPlay },
  { id: "code", label: "Code", icon: FileCode2 },
  { id: "terminal", label: "Terminal", icon: TerminalIcon },
  { id: "diagnostics", label: "Diagnostics", icon: TriangleAlert },
  { id: "changes", label: "Changes", icon: GitCompare },
  { id: "activity", label: "Activity", icon: Activity },
] as const;
type WorkspaceLayout = {
  view: "idea" | "files" | "preview" | "code" | "activity";
  devTab: "preview" | "code" | "terminal" | "diagnostics" | "changes" | "activity";
  showFiles: boolean;
  explorerWidth: number;
  chatWidth: number;
};
function readWorkspaceLayout(projectId: string): Partial<WorkspaceLayout> {
  try {
    const raw = JSON.parse(localStorage.getItem(`velori.forge.layout.v1.${projectId}`) ?? "null");
    if (!raw || typeof raw !== "object") return {};
    return {
      view: ["idea", "files", "preview", "code", "activity"].includes(raw.view)
        ? raw.view
        : undefined,
      devTab: ["preview", "code", "terminal", "diagnostics", "changes", "activity"].includes(
        raw.devTab,
      )
        ? raw.devTab
        : undefined,
      showFiles: typeof raw.showFiles === "boolean" ? raw.showFiles : undefined,
      explorerWidth: Number.isFinite(raw.explorerWidth)
        ? Math.min(340, Math.max(220, raw.explorerWidth))
        : undefined,
      chatWidth: Number.isFinite(raw.chatWidth)
        ? Math.min(520, Math.max(320, raw.chatWidth))
        : undefined,
    };
  } catch {
    return {};
  }
}
export function Workspace({
  initial,
  initialPrompt,
  initialMode = "build",
  signedIn,
  persist,
  onGuide,
  onDeleteProject,
}: {
  initial: Project;
  initialPrompt: string;
  initialMode?: ForgeLandingMode;
  signedIn: boolean;
  persist: (p: Project) => Promise<void>;
  onGuide: () => void;
  onDeleteProject: () => Promise<void>;
}) {
  const [layout] = useState(() => readWorkspaceLayout(initial.id));
  const [project, setProject] = useState(initial);
  const [runtimeEvents, setRuntimeEvents] = useState<RuntimeEvent[]>([]);
  const [running, setRunning] = useState(initial);
  const [path, setPath] = useState("index");
  const [previewPath, setPreviewPath] = useState("index");
  const [previewError, setPreviewError] = useState("");
  const [language, setLanguage] = useState<keyof Code>("html");
  const [view, setView] = useState<WorkspaceLayout["view"]>(layout.view ?? "idea");
  const [devTab, setDevTab] = useState<WorkspaceLayout["devTab"]>(layout.devTab ?? "preview");
  const [explorerWidth, setExplorerWidth] = useState(layout.explorerWidth ?? 250);
  const [chatWidth, setChatWidth] = useState(layout.chatWidth ?? 400);
  const [fileSearch, setFileSearch] = useState("");
  const [status, setStatus] = useState("Saved locally on this device");
  const [backedUp, setBackedUp] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [creatingFile, setCreatingFile] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [fileAction, setFileAction] = useState<{
    path: string;
    kind: "rename" | "duplicate" | "move";
  } | null>(null);
  const [fileActionValue, setFileActionValue] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [stackMessage, setStackMessage] = useState("");
  const [showFiles, setShowFiles] = useState(layout.showFiles ?? true);
  const [undo, setUndo] = useState<Project | null>(null);
  const [adding, setAdding] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [pageError, setPageError] = useState("");
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  const connection = useConnection(signedIn);
  const latest = useRef(project);
  const save = useRef(persist);
  latest.current = project;
  save.current = persist;
  useEffect(() => {
    try {
      localStorage.setItem(
        `velori.forge.layout.v1.${project.id}`,
        JSON.stringify({ view, devTab, showFiles, explorerWidth, chatWidth }),
      );
    } catch {
      // Layout preferences are optional; project data remains independently saved.
    }
  }, [project.id, view, devTab, showFiles, explorerWidth, chatWidth]);
  const activePage = project.pages.find((p) => p.path === path) ?? project.pages[0];
  // Local editing and exports are always available, irrespective of provider allowance.
  const locked = false;
  const navigation = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !backedUp &&
      currentLocation.pathname !== nextLocation.pathname &&
      !nextLocation.pathname.startsWith(`/studio/${project.id}`),
  );
  const changed =
    JSON.stringify(project.pages) !== JSON.stringify(running.pages) ||
    JSON.stringify(project.files ?? []) !== JSON.stringify(running.files ?? []) ||
    project.stack !== running.stack;
  const sourceChanges = fileChanges(running.files ?? [], project.files ?? []);
  const activeFile = selectedFile
    ? (project.files ?? []).find((p) => p.path === selectedFile)
    : undefined;
  const contentLabel =
    activeFile?.path ?? (language === "js" ? "JavaScript" : language.toUpperCase());
  const sourceFiles = project.files ?? [];
  const filteredFiles = sourceFiles.filter((file) =>
    file.path.toLocaleLowerCase().includes(fileSearch.trim().toLocaleLowerCase()),
  );
  const visibleFiles = filteredFiles.filter((file) => !file.path.endsWith("/.keep"));
  const explorerFolders = [
    ...new Set(
      sourceFiles.flatMap((file) => {
        const parts = file.path.split("/");
        return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"));
      }),
    ),
  ].sort();
  const hasNodeRuntime = sourceFiles.some((file) => file.path === "package.json");
  const hasPythonSource = sourceFiles.some((file) => file.path.endsWith(".py"));
  const extensions = useMemo(
    () => [
      activeFile
        ? /\.html?$/i.test(activeFile.path)
          ? html()
          : /\.css$/i.test(activeFile.path)
            ? css()
            : /\.(?:jsx|tsx|ts|mjs|js)$/i.test(activeFile.path)
              ? javascript({ jsx: true, typescript: /\.tsx?$/i.test(activeFile.path) })
              : []
        : language === "html"
          ? html()
          : language === "css"
            ? css()
            : javascript(),
      EditorView.lineWrapping,
    ],
    [language, activeFile?.path],
  );
  const edit = (patch: Partial<Project>) => {
    setBackedUp(false);
    setProject((p) => ({ ...p, ...patch, updatedAt: new Date().toISOString() }));
  };
  function updateSetup(patch: Partial<ForgeProjectSetup>) {
    const setup: ForgeProjectSetup = project.setup ?? {
      version: 1,
      description: "",
      category: "Website",
      platform: project.stack === "multi-file" ? "backend-api" : "website",
      framework:
        project.stack === "react"
          ? "react-vite"
          : project.stack === "multi-file"
            ? "python-fastapi"
            : "static-html",
      theme: "system",
      design: "Aurora Glass",
      color: "#8b6be6",
      animation: "subtle",
      responsive: "mobile-first",
      aiProvider: "gemini",
      defaultMode: "build",
      storage: "local",
      autosave: true,
      backupReminder: true,
      initialPrompt: "",
    };
    edit({ setup: { ...setup, ...patch } });
  }
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!backedUp) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [backedUp]);
  function addSource() {
    const name = newFileName.trim();
    if (
      !safeSourcePath(name) ||
      (project.files ?? []).some((f) => f.path.toLowerCase() === name.toLowerCase())
    ) {
      setFileError("Use a unique safe path, e.g. src/components/Button.tsx.");
      return;
    }
    try {
      const files = parseSourceFiles([
        ...(project.files ?? []),
        { path: name, content: "// Your source file\n" },
      ]);
      edit({ files, stack: project.stack === "static" ? "multi-file" : project.stack });
      setSelectedFile(name);
      setCreatingFile(false);
      setNewFileName("");
      setFileError("");
      setView("code");
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "Could not create file.");
    }
  }
  function addFolder() {
    const name = newFolderName.trim().replace(/\/+$/, "");
    const marker = `${name}/.keep`;
    if (!safeSourcePath(marker) || (project.files ?? []).some((file) => file.path === marker)) {
      setFileError("Use a safe folder path that does not already exist.");
      return;
    }
    try {
      edit({ files: parseSourceFiles([...(project.files ?? []), { path: marker, content: "" }]) });
      setNewFolderName("");
      setCreatingFolder(false);
      setFileError("");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Folder could not be created.");
    }
  }
  function commitFileAction() {
    if (!fileAction) return;
    const nextPath = fileActionValue.trim();
    const selected = project.files?.find((file) => file.path === fileAction.path);
    if (!selected || !safeSourcePath(nextPath)) {
      setFileError("Choose a safe source path.");
      return;
    }
    if ((project.files ?? []).some((file) => file.path.toLowerCase() === nextPath.toLowerCase())) {
      setFileError("A file already exists at that path. Nothing was overwritten.");
      return;
    }
    try {
      const next =
        fileAction.kind === "duplicate"
          ? [...(project.files ?? []), { ...selected, path: nextPath }]
          : (project.files ?? []).map((file) =>
              file.path === selected.path ? { ...file, path: nextPath } : file,
            );
      edit({ files: parseSourceFiles(next) });
      if (selectedFile === selected.path) setSelectedFile(nextPath);
      setFileAction(null);
      setFileActionValue("");
      setFileError("");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "File operation failed.");
    }
  }
  function enableReact() {
    try {
      const generated = reactStarterFiles(project.title);
      const current = project.files ?? [];
      const duplicates = generated.filter((f) =>
        current.some((existing) => existing.path === f.path),
      );
      if (duplicates.length) {
        setStackMessage("React starter files already exist. Open or edit them in Files.");
        return;
      }
      edit({ stack: "react", files: parseSourceFiles([...current, ...generated]) });
      setSelectedFile("src/App.tsx");
      setShowFiles(true);
      setView("code");
      setStackMessage(
        "React/Vite source is ready. Download source ZIP to build with npm. Use the application workspace to check browser execution support.",
      );
    } catch (e) {
      setStackMessage(e instanceof Error ? e.message : "React starter could not be created.");
    }
  }
  function enablePythonApi() {
    try {
      const generated = pythonApiStarterFiles(project.title);
      const current = project.files ?? [];
      if (generated.some((f) => current.some((existing) => existing.path === f.path))) {
        setStackMessage("Python API starter files already exist. Open them in Files to edit.");
        return;
      }
      edit({ stack: "multi-file", files: parseSourceFiles([...current, ...generated]) });
      setSelectedFile("main.py");
      setShowFiles(true);
      setView("code");
      setStackMessage(
        "Python API files are editable and included in the Source ZIP. The static preview cannot execute a Python server.",
      );
    } catch (e) {
      setStackMessage(e instanceof Error ? e.message : "Could not create Python API starter.");
    }
  }
  useEffect(() => {
    if (project.setup?.autosave === false) {
      setStatus("Autosave is off. Save Project or export a backup before leaving.");
      return;
    }
    setStatus("Saving…");
    let active = true;
    const timer = setTimeout(() => {
      void persist(project)
        .then(() => {
          if (active) setStatus("Saved locally on this device");
        })
        .catch((e) => {
          if (active) setStatus(e instanceof Error ? e.message : "Save failed. Export a backup.");
        });
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [project, persist]);
  useEffect(() => {
    const flush = () => {
      if (latest.current.setup?.autosave === false) return;
      try {
        void save.current(latest.current).catch(() => undefined);
      } catch {
        /* Save failure is shown and export remains available. */
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
  useEffect(() => {
    if (connection.caps.cloud) void connection.refresh();
  }, [project.cloudUpdatedAt]);
  function addPage() {
    const name = newPath.trim().toLowerCase();
    if (locked) return;
    if (!validPath(name) || project.pages.some((p) => p.path === name)) {
      setPageError(
        "Use a unique path: a letter, then letters, numbers or hyphens (40 characters maximum).",
      );
      return;
    }
    if (project.pages.length >= 8) {
      setPageError("Projects can contain up to eight pages.");
      return;
    }
    edit({
      pages: [
        ...project.pages,
        {
          path: name,
          html: `<main>\n<a href="#index">← Home</a>\n<h1>${name.replace(/-/g, " ")}</h1>\n<p>Your next page starts here.</p>\n</main>`,
          css: "body { padding:32px; font-family:system-ui,sans-serif; background:#fffdf6; color:#29251e; }",
          js: "// Add interactions for this page.",
        },
      ],
    });
    setPath(name);
    setSelectedFile(null);
    setAdding(false);
    setNewPath("");
    setPageError("");
    setView("code");
  }
  return (
    <>
      <h1 className="vf-sr">VELORI Forge AI project editor</h1>
      <div className="vf-workspace-heading vf-v3312-toolbar">
        <div>
          <Link aria-label="Your projects" title="Your projects" to="/artifacts">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <label className="vf-sr" htmlFor="vf-title">
              Project title
            </label>
            <input
              id="vf-title"
              value={project.title}
              maxLength={100}
              onChange={(e) => edit({ title: e.target.value })}
            />
            <p role="status">{status}</p>
          </div>
          <button
            type="button"
            aria-label="Project settings"
            title="Project settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={17} />
          </button>
          <div className="vf-usage-indicator" aria-live="polite">
            {connection.quota ? (
              <>
                <strong>{connection.quota.plan}</strong>
                <span>
                  {connection.quota.freeLeft} free · {connection.quota.tokens} bonus
                </span>
              </>
            ) : (
              <span>{connection.checking ? "Checking usage…" : "Usage unavailable"}</span>
            )}
          </div>
        </div>
        <div className="vf-export">
          {undo && (
            <button
              aria-label="Undo applied AI revision"
              title="Undo applied AI revision"
              onClick={() => {
                const p = { ...undo, updatedAt: new Date().toISOString() };
                setProject(p);
                setRunning(p);
                setPath("index");
                setPreviewPath("index");
                setUndo(null);
              }}
            >
              <Undo2 size={16} />
            </button>
          )}
          <Link
            className="vf-upgrade-link"
            to="/forge/pricing"
            title="Connected premium plans and credits"
          >
            <Sparkles size={15} /> Explore Premium
          </Link>
          <button
            aria-label="Export editable project JSON"
            title="Project backup"
            onClick={() => {
              downloadProject(project, "json");
              setBackedUp(true);
            }}
          >
            <FileJson size={16} />
            <span>Project backup</span>
          </button>
          <button
            aria-label="Download editable HTML CSS JavaScript source ZIP"
            title="Full static source archive"
            onClick={() => {
              downloadProject(project, "zip");
              setBackedUp(true);
            }}
          >
            <FolderDown size={16} />
            <span>Source ZIP</span>
          </button>
          <button
            className="vf-primary"
            aria-label="Download complete app HTML"
            onClick={() => {
              downloadProject(project, "html");
              if (project.stack !== "react" && !project.files?.length) setBackedUp(true);
              else
                setStackMessage(
                  "HTML preview downloaded, but React or extra source files need a Source ZIP backup before leaving.",
                );
            }}
          >
            <Download size={16} />
            <span>Download app</span>
          </button>
        </div>
      </div>
      <div className="vf-storage-banner" role="note">
        <HardDriveDownload size={17} />
        <p>
          <strong>Device-first project</strong> · Source stays in this browser, not your VELORI
          account database. Clearing site data may erase it. Export a ZIP backup before leaving.
        </p>
        <button
          type="button"
          onClick={() => {
            downloadProject(project, "zip");
            setBackedUp(true);
          }}
        >
          Save backup
        </button>
      </div>
      <div className="vf-workspace-stack" aria-label="Project framework and file tools">
        <span>
          <FolderTree size={15} />{" "}
          {project.stack === "react"
            ? "React / TypeScript"
            : project.stack === "multi-file"
              ? "Multi-file"
              : "Static project"}
        </span>
        <button type="button" onClick={() => setShowFiles((v) => !v)} aria-expanded={showFiles}>
          {showFiles ? "Hide files" : "Show files"}
        </button>
        {project.stack !== "react" && (
          <button type="button" onClick={enableReact}>
            + React starter
          </button>
        )}
        <button type="button" onClick={enablePythonApi}>
          + API starter
        </button>
        <Link to="/forge/pricing">
          <Sparkles size={14} /> Plans & credits
        </Link>
      </div>
      {stackMessage && (
        <p className="vf-stack-note" role="status">
          {stackMessage}
        </p>
      )}
      <nav className="vf-mobile-tabs" aria-label="Workspace views">
        {mobileDestinations.map(({ id, label }) => (
          <button
            key={id}
            aria-pressed={view === id}
            onClick={() => {
              setView(id);
              if (id === "preview" || id === "code" || id === "activity") setDevTab(id);
            }}
          >
            {label}
            {id === "code" && changed ? <i aria-label="Unapplied changes" /> : null}
          </button>
        ))}
      </nav>
      <div
        className={`vf-workspace vf-view-${view}`}
        style={
          {
            "--vf-explorer-width": `${explorerWidth}px`,
            "--vf-chat-width": `${chatWidth}px`,
          } as CSSProperties
        }
      >
        <aside className="vf-explorer" aria-label="Project explorer">
          <header className="vf-explorer-header">
            <span>
              <FolderTree size={16} /> Explorer
            </span>
            <button
              type="button"
              aria-label="Collapse project explorer"
              onClick={() => setShowFiles((open) => !open)}
            >
              {showFiles ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
          </header>
          {showFiles ? (
            <>
              <label className="vf-explorer-search">
                <Search size={15} />
                <input
                  aria-label="Search project files"
                  value={fileSearch}
                  onChange={(event) => setFileSearch(event.target.value)}
                  placeholder="Search files"
                />
              </label>
              <div className="vf-explorer-group">
                <div className="vf-explorer-group-heading">
                  <span>Pages</span>
                  <button
                    type="button"
                    aria-label="Add page"
                    onClick={() => setAdding((open) => !open)}
                  >
                    <Plus size={15} />
                  </button>
                </div>
                {project.pages.map((page) => (
                  <div
                    className={`vf-explorer-row${path === page.path && !selectedFile ? " is-selected" : ""}`}
                    key={page.path}
                  >
                    <button
                      type="button"
                      aria-pressed={path === page.path && !selectedFile}
                      onClick={() => {
                        setSelectedFile(null);
                        setPath(page.path);
                        setPreviewPath(page.path);
                        setView("preview");
                        setDevTab("preview");
                      }}
                    >
                      <FileCode2 size={15} />
                      <span>/{page.path}</span>
                    </button>
                    {page.path !== "index" && (
                      <button
                        type="button"
                        aria-label={`Remove page ${page.path}`}
                        onClick={() => setDeleting(page.path)}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))}
                {adding && !locked && (
                  <form
                    className="vf-explorer-create-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      addPage();
                    }}
                  >
                    <label htmlFor="vf-new-page">Page path</label>
                    <input
                      id="vf-new-page"
                      value={newPath}
                      onChange={(event) => setNewPath(event.target.value)}
                      maxLength={40}
                      placeholder="about-us"
                      autoFocus
                    />
                    <button type="submit">Create page</button>
                    {pageError && <p role="alert">{pageError}</p>}
                  </form>
                )}
              </div>
              <div className="vf-explorer-group">
                <div className="vf-explorer-group-heading">
                  <span>Source files</span>
                  <button
                    type="button"
                    aria-label="Create source file"
                    onClick={() => setCreatingFile((open) => !open)}
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <div className="vf-explorer-create-actions">
                  <button type="button" onClick={() => setCreatingFile(true)}>
                    <Plus size={13} /> File
                  </button>
                  <button type="button" onClick={() => setCreatingFolder(true)}>
                    <Folder size={13} /> Folder
                  </button>
                </div>
                {explorerFolders.map((folder) => (
                  <div
                    className="vf-explorer-folder"
                    key={folder}
                    style={{ paddingInlineStart: `${8 + (folder.split("/").length - 1) * 12}px` }}
                  >
                    <Folder size={14} />
                    <span>{folder.split("/").at(-1)}</span>
                  </div>
                ))}
                {visibleFiles.map((file) => (
                  <div
                    className={`vf-explorer-row${selectedFile === file.path ? " is-selected" : ""}`}
                    key={file.path}
                    style={{ paddingInlineStart: `${(file.path.split("/").length - 1) * 12}px` }}
                  >
                    <button
                      type="button"
                      aria-pressed={selectedFile === file.path}
                      title={file.path}
                      onClick={() => {
                        setSelectedFile(file.path);
                        setDevTab("code");
                        setView("code");
                      }}
                    >
                      <FileCode2 size={15} />
                      <span>{file.path}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${file.path}`}
                      onClick={() => setDeletingFile(file.path)}
                    >
                      <X size={13} />
                    </button>
                    <details className="vf-explorer-file-menu">
                      <summary aria-label={`File actions for ${file.path}`}>
                        <Ellipsis size={15} />
                      </summary>
                      <div>
                        {(["rename", "duplicate", "move"] as const).map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => {
                              setFileAction({ path: file.path, kind });
                              setFileActionValue(
                                kind === "duplicate"
                                  ? file.path.replace(/(\.[^./]+)?$/, "-copy$1")
                                  : file.path,
                              );
                            }}
                          >
                            {kind}
                          </button>
                        ))}
                      </div>
                    </details>
                  </div>
                ))}
                {!visibleFiles.length && (
                  <p className="vf-explorer-empty">
                    {fileSearch ? "No matching files." : "No source files yet."}
                  </p>
                )}
                {creatingFile && (
                  <form
                    className="vf-explorer-create-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      addSource();
                    }}
                  >
                    <label htmlFor="vf-new-source-path">File path</label>
                    <input
                      id="vf-new-source-path"
                      autoFocus
                      value={newFileName}
                      placeholder="src/components/Card.tsx"
                      onChange={(event) => setNewFileName(event.target.value)}
                      maxLength={140}
                    />
                    <button type="submit">Create file</button>
                    {fileError && <small role="alert">{fileError}</small>}
                  </form>
                )}
              </div>
              <div className="vf-explorer-actions">
                {project.stack !== "react" && (
                  <button type="button" onClick={enableReact}>
                    + React starter
                  </button>
                )}
                <button type="button" onClick={enablePythonApi}>
                  + API starter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadProject(project, "zip");
                    setBackedUp(true);
                  }}
                >
                  <FolderDown size={14} /> Export ZIP
                </button>
                <button type="button" onClick={() => setSettingsOpen(true)}>
                  <Settings2 size={14} /> Settings
                </button>
              </div>
            </>
          ) : null}
        </aside>
        <Assistant
          project={project}
          initialPrompt={initialPrompt}
          initialMode={initialMode}
          signedIn={signedIn}
          connection={connection}
          previewError={previewError}
          runtimeEvents={runtimeEvents}
          onGuide={onGuide}
          onApply={(code, prompt) => {
            setUndo(project);
            const next = {
              ...project,
              title: code.title,
              pages: code.pages,
              files: code.files?.length ? code.files : project.files,
              stack: code.stack ?? project.stack,
              history: [
                ...project.history,
                {
                  id: studioId(),
                  prompt,
                  result:
                    `Applied ${code.pages.length} pages: ${code.pages.map((p) => p.path).join(", ")}`.slice(
                      0,
                      500,
                    ),
                  createdAt: new Date().toISOString(),
                },
              ].slice(-20),
              updatedAt: new Date().toISOString(),
            };
            setProject(next);
            setRunning(next);
            setPath("index");
            setPreviewPath("index");
            setSelectedFile(null);
            setView("preview");
          }}
        />
        <section className="vf-development" aria-label="Development workspace">
          <nav className="vf-development-tabs" role="tablist" aria-label="Development panels">
            {developmentTabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={devTab === id}
                onClick={() => {
                  setDevTab(id);
                  if (id === "code" || id === "preview") setView(id);
                  else setView("activity");
                }}
              >
                <Icon size={15} />
                <span>{label}</span>
                {id === "code" && changed ? <i aria-label="Unapplied changes" /> : null}
              </button>
            ))}
            <details className="vf-layout-menu">
              <summary aria-label="Resize workspace panels" title="Resize workspace panels">
                <Settings2 size={15} />
              </summary>
              <label>
                Explorer width{" "}
                <input
                  type="range"
                  min="220"
                  max="340"
                  step="10"
                  value={explorerWidth}
                  onChange={(event) => setExplorerWidth(Number(event.target.value))}
                />
                <output>{explorerWidth}px</output>
              </label>
              <label>
                Chat width{" "}
                <input
                  type="range"
                  min="320"
                  max="520"
                  step="10"
                  value={chatWidth}
                  onChange={(event) => setChatWidth(Number(event.target.value))}
                />
                <output>{chatWidth}px</output>
              </label>
            </details>
          </nav>
          <div className="vf-development-panels">
            <section className="vf-code" aria-label="Code editor" hidden={devTab !== "code"}>
              <div className="vf-panel-bar">
                <span>
                  <FileCode2 size={14} />
                  {contentLabel} source
                </span>
                <div>
                  <button
                    aria-label="Copy current source"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          activeFile ? activeFile.content : activePage[language],
                        );
                        setStatus("Source copied");
                      } catch {
                        setStatus("Copy unavailable. Select code in the editor to copy.");
                      }
                    }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                  <button
                    onClick={() => {
                      if (project.stack === "react" && activeFile) {
                        setStackMessage(
                          "React/TSX source is editable and exportable. In-browser React/npm execution requires an isolated build runner; check compatibility in the application workspace.",
                        );
                      }
                      setRunning({ ...project });
                      setPreviewPath(path);
                      setView("preview");
                      setDevTab("preview");
                    }}
                  >
                    <Play size={13} /> Run{changed && <i aria-label="Unapplied changes" />}
                  </button>
                </div>
              </div>
              <div className="vf-code-tabs" role="tablist" aria-label="Code languages">
                {activeFile && (
                  <button
                    role="tab"
                    aria-selected="true"
                    onClick={() => setSelectedFile(null)}
                    title="Return to page HTML/CSS/JavaScript"
                  >
                    ← /{activeFile.path}
                  </button>
                )}
                {(["html", "css", "js"] as const).map((lang, index) => (
                  <button
                    role="tab"
                    id={`vf-tab-${lang}`}
                    aria-controls="vf-code-panel"
                    aria-selected={!activeFile && lang === language}
                    tabIndex={lang === language ? 0 : -1}
                    key={lang}
                    onClick={() => {
                      setSelectedFile(null);
                      setLanguage(lang);
                    }}
                    onKeyDown={(e) => {
                      const keys = ["html", "css", "js"] as const;
                      const next =
                        e.key === "ArrowRight"
                          ? (index + 1) % 3
                          : e.key === "ArrowLeft"
                            ? (index + 2) % 3
                            : e.key === "Home"
                              ? 0
                              : e.key === "End"
                                ? 2
                                : -1;
                      if (next < 0) return;
                      e.preventDefault();
                      setSelectedFile(null);
                      setLanguage(keys[next]);
                      document.getElementById(`vf-tab-${keys[next]}`)?.focus();
                    }}
                  >
                    <i className={`vf-file-${lang}`} />
                    {lang === "js" ? "JavaScript" : lang.toUpperCase()}
                  </button>
                ))}
              </div>
              <div
                className="vf-code-content"
                role="tabpanel"
                id="vf-code-panel"
                aria-labelledby={`vf-tab-${language}`}
              >
                <CodeMirror
                  key={activeFile ? `file-${activeFile.path}` : `${path}-${language}`}
                  value={activeFile?.content ?? activePage[language]}
                  extensions={extensions}
                  height="100%"
                  readOnly={locked}
                  editable={!locked}
                  aria-label={`${contentLabel} source code`}
                  onChange={(value) => {
                    if (!locked)
                      edit(
                        activeFile
                          ? {
                              files: (project.files ?? []).map((f) =>
                                f.path === activeFile.path ? { ...f, content: value } : f,
                              ),
                            }
                          : {
                              pages: project.pages.map((p) =>
                                p.path === activePage.path ? { ...p, [language]: value } : p,
                              ),
                            },
                      );
                  }}
                />
              </div>
              <small className="vf-code-foot">
                {project.stack === "react"
                  ? "React source is editable/exportable; use the application workspace to check runtime compatibility."
                  : "Edit freely. Run when you’re ready."}
              </small>
            </section>
            {hasNodeRuntime ? (
              <div
                className="vf-development-runtime"
                hidden={devTab !== "preview" && devTab !== "terminal"}
              >
                <RuntimePanel
                  files={sourceFiles}
                  onRepair={(before, after) => {
                    if (JSON.stringify(latest.current.files ?? []) !== JSON.stringify(before)) {
                      setPreviewError(
                        "Source changed during repair. The verified candidate was not applied; run repair again.",
                      );
                      return;
                    }
                    setUndo(latest.current);
                    edit({ files: after });
                  }}
                  activity={devTab === "terminal"}
                  onEvent={(event) => setRuntimeEvents((rows) => [...rows, event].slice(-120))}
                />
              </div>
            ) : hasPythonSource ? (
              <section
                className="vf-runtime-unavailable"
                aria-label="Python runtime unavailable"
                hidden={devTab !== "preview" && devTab !== "terminal"}
              >
                <div className="vf-panel-bar">
                  <span>
                    <TerminalIcon size={15} /> Python source · execution unavailable
                  </span>
                  <div>
                    <button
                      type="button"
                      aria-pressed={devTab === "preview"}
                      onClick={() => setDevTab("preview")}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      aria-pressed={devTab === "terminal"}
                      onClick={() => setDevTab("terminal")}
                    >
                      Terminal
                    </button>
                  </div>
                </div>
                {devTab === "terminal" ? (
                  <div className="vf-runtime-empty">
                    <h2>No Python process is running</h2>
                    <p>
                      No compatible isolated Python runtime is configured. FORGE has not executed
                      these files.
                    </p>
                    <pre className="vf-terminal">No commands have run.</pre>
                  </div>
                ) : (
                  <div className="vf-runtime-empty">
                    <TerminalIcon size={21} />
                    <h2>Python execution is unavailable</h2>
                    <p>
                      These Python files are editable and exportable. No compatible isolated Python
                      runtime is configured, so FORGE has not executed them.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        downloadProject(project, "zip");
                        setBackedUp(true);
                      }}
                    >
                      Export source ZIP
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <div className="vf-development-preview" hidden={devTab !== "preview"}>
                <Preview
                  project={running}
                  path={previewPath}
                  onNavigate={setPreviewPath}
                  onError={setPreviewError}
                />
              </div>
            )}
            <section
              className="vf-development-info"
              aria-label="Diagnostics"
              hidden={devTab !== "diagnostics"}
            >
              <div className="vf-panel-bar">
                <span>
                  <TriangleAlert size={15} /> Diagnostics
                </span>
              </div>
              {previewError ? (
                <p className="vf-diagnostic vf-diagnostic-error">{previewError}</p>
              ) : null}
              {runtimeEvents
                .filter((event) => event.kind === "error")
                .map((event, index) => (
                  <details
                    className="vf-diagnostic vf-diagnostic-error"
                    key={`${event.time}-${index}`}
                  >
                    <summary>{event.message.slice(0, 180)}</summary>
                    <pre>{event.message}</pre>
                    <time>{new Date(event.time).toLocaleString()}</time>
                  </details>
                ))}
              {!previewError && !runtimeEvents.some((event) => event.kind === "error") ? (
                <p className="vf-development-empty">
                  No preview or runtime diagnostics have been reported.
                </p>
              ) : null}
            </section>
            <section
              className="vf-development-info"
              aria-label="Project changes"
              hidden={devTab !== "changes"}
            >
              <div className="vf-panel-bar">
                <span>
                  <GitCompare size={15} /> Changes
                </span>
              </div>
              {undo ? (
                <article className="vf-change-card">
                  <strong>Previous local revision available</strong>
                  <p>Restore the project snapshot captured before the last approved AI change.</p>
                  <button
                    type="button"
                    onClick={() => {
                      const previous = { ...undo, updatedAt: new Date().toISOString() };
                      setProject(previous);
                      setRunning(previous);
                      setUndo(null);
                    }}
                  >
                    Restore previous revision
                  </button>
                </article>
              ) : null}
              {sourceChanges.map((change) => (
                <details className="vf-change-card" key={change.path}>
                  <summary>
                    {change.path} ·{" "}
                    {change.before === undefined
                      ? "Added"
                      : change.after === undefined
                        ? "Removed"
                        : "Modified"}
                  </summary>
                  <pre>
                    {change.before === undefined ? "" : `--- Before\n${change.before}`}
                    {change.after === undefined ? "" : `\n+++ After\n${change.after}`}
                  </pre>
                </details>
              ))}
              {[...project.history].reverse().map((turn) => (
                <article className="vf-change-card" key={turn.id}>
                  <strong>{turn.prompt}</strong>
                  <p>{turn.result}</p>
                  <time>{new Date(turn.createdAt).toLocaleString()}</time>
                </article>
              ))}
              {!undo && project.history.length === 0 && sourceChanges.length === 0 ? (
                <p className="vf-development-empty">
                  No source changes or accepted AI revisions are pending.
                </p>
              ) : null}
            </section>
            <section
              className="vf-development-info"
              aria-label="Project activity"
              hidden={devTab !== "activity"}
            >
              <div className="vf-panel-bar">
                <span>
                  <Activity size={15} /> Activity
                </span>
              </div>
              {[...project.history].reverse().map((turn) => (
                <article className="vf-activity-row" key={turn.id}>
                  <span className="vf-activity-dot" />
                  <div>
                    <strong>Revision accepted</strong>
                    <p>{turn.prompt}</p>
                    <small>{turn.result}</small>
                    <time>{new Date(turn.createdAt).toLocaleString()}</time>
                  </div>
                </article>
              ))}
              {[...runtimeEvents].reverse().map((event, index) => (
                <article className="vf-activity-row" key={`${event.time}-${index}`}>
                  <span className={`vf-activity-dot is-${event.kind}`} />
                  <div>
                    <strong>
                      {event.kind === "error"
                        ? "Runtime error"
                        : event.kind === "output"
                          ? "Runtime output"
                          : "Runtime event"}
                    </strong>
                    <p>{event.message}</p>
                    <time>{new Date(event.time).toLocaleString()}</time>
                  </div>
                </article>
              ))}
              {!project.history.length && !runtimeEvents.length ? (
                <p className="vf-development-empty">
                  No project or runtime activity has been recorded.
                </p>
              ) : null}
            </section>
          </div>
        </section>
      </div>
      <div className="vf-workspace-footer">
        <span>
          {project.pages.length} pages · {(project.files ?? []).length} source files · /
          {previewPath} {project.files?.length ? "application workspace" : "static preview"}
        </span>
        <button onClick={onGuide}>Studio guide ↗</button>
      </div>
      <Dialog
        open={!!fileAction}
        title={`${fileAction?.kind === "duplicate" ? "Duplicate" : fileAction?.kind === "move" ? "Move" : "Rename"} source file`}
        description="Choose a safe project-relative path. Existing files are never overwritten."
        onClose={() => {
          setFileAction(null);
          setFileError("");
        }}
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                setFileAction(null);
                setFileError("");
              }}
            >
              Cancel
            </button>
            <button type="button" className="button-primary" onClick={commitFileAction}>
              {fileAction?.kind === "duplicate"
                ? "Duplicate"
                : fileAction?.kind === "move"
                  ? "Move"
                  : "Rename"}
            </button>
          </>
        }
      >
        <label className="vf-file-action-input">
          Project-relative path
          <input
            autoFocus
            value={fileActionValue}
            onChange={(event) => setFileActionValue(event.target.value)}
            maxLength={140}
          />
        </label>
        {fileError && <p role="alert">{fileError}</p>}
      </Dialog>
      <Dialog
        open={creatingFolder}
        title="Create folder"
        description="Folders are stored as project-relative paths on this device."
        onClose={() => {
          setCreatingFolder(false);
          setFileError("");
        }}
        actions={
          <>
            <button type="button" onClick={() => setCreatingFolder(false)}>
              Cancel
            </button>
            <button type="button" className="button-primary" onClick={addFolder}>
              Create folder
            </button>
          </>
        }
      >
        <label className="vf-file-action-input">
          Folder path
          <input
            autoFocus
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            maxLength={140}
          />
        </label>
        {fileError && <p role="alert">{fileError}</p>}
      </Dialog>
      <Dialog
        open={settingsOpen}
        title={confirmProjectDelete ? "Delete this local project?" : "Project Settings"}
        description={
          confirmProjectDelete
            ? "This permanently removes this project's files and metadata from this browser. Export a backup first; this cannot be undone."
            : "Settings are saved with this project on this device."
        }
        onClose={() => {
          setConfirmProjectDelete(false);
          setSettingsOpen(false);
        }}
        actions={
          confirmProjectDelete ? (
            <>
              <button type="button" onClick={() => setConfirmProjectDelete(false)}>
                Keep Project
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  setBackedUp(true);
                  void onDeleteProject().catch(() => {
                    setBackedUp(false);
                    setStatus("Project deletion failed. Your local project is still available.");
                  });
                }}
              >
                Delete Local Project
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setSettingsOpen(false)}>
              Done
            </button>
          )
        }
      >
        {confirmProjectDelete ? null : (
          <div className="vf-project-settings">
            <fieldset>
              <legend>General</legend>
              <label>
                Project name
                <input
                  value={project.title}
                  maxLength={100}
                  onChange={(event) => edit({ title: event.target.value })}
                />
              </label>
              <label>
                Description
                <textarea
                  value={project.setup?.description ?? ""}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => updateSetup({ description: event.target.value })}
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>Appearance</legend>
              <label>
                Theme
                <select
                  value={project.setup?.theme ?? "system"}
                  onChange={(event) =>
                    updateSetup({ theme: event.target.value as ForgeProjectSetup["theme"] })
                  }
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label>
                Design style
                <select
                  value={project.setup?.design ?? "Aurora Glass"}
                  onChange={(event) => updateSetup({ design: event.target.value })}
                >
                  <option>Aurora Glass</option>
                  <option>Ivory Glass</option>
                  <option>Minimal</option>
                  <option>Editorial</option>
                  <option>Professional Dashboard</option>
                  <option>Modern Gradient</option>
                  <option>Soft Glass</option>
                  <option>Bold Contemporary</option>
                </select>
              </label>
              <label>
                Accent color
                <input
                  type="color"
                  value={project.setup?.color ?? "#8b6be6"}
                  onChange={(event) => updateSetup({ color: event.target.value })}
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>Framework and runtime</legend>
              <p>
                {project.setup?.framework ?? project.stack ?? "static"} ·{" "}
                {project.setup?.framework === "python-fastapi"
                  ? "Source and ZIP export only; no Python runtime"
                  : project.setup?.framework === "react-vite"
                    ? "Source and ZIP export only; no configured local runtime"
                    : "Static browser preview supported"}
              </p>
              <small>Changing frameworks does not rewrite project files.</small>
            </fieldset>
            <fieldset>
              <legend>AI preferences</legend>
              <p>
                FORGE uses the protected server-managed runtime after you consent in the editor.
              </p>
              <label>
                Default interaction
                <select
                  value={project.setup?.defaultMode ?? "build"}
                  onChange={(event) =>
                    updateSetup({ defaultMode: event.target.value as ForgeLandingMode })
                  }
                >
                  <option value="build">Build</option>
                  <option value="ask">Ask</option>
                </select>
              </label>
            </fieldset>
            <fieldset>
              <legend>Local storage</legend>
              <p>
                Source is stored in this browser, not uploaded to the account database. Browser data
                is not a permanent backup.
              </p>
              <label className="vf-settings-toggle">
                <input
                  type="checkbox"
                  checked={project.setup?.autosave ?? true}
                  onChange={(event) => updateSetup({ autosave: event.target.checked })}
                />
                Autosave edits
              </label>
              <button
                type="button"
                onClick={() => {
                  downloadProject(project, "zip");
                  setBackedUp(true);
                }}
              >
                Export source ZIP
              </button>
            </fieldset>
            <fieldset className="vf-settings-danger">
              <legend>Danger zone</legend>
              <p>Deleting removes only this local project from this device.</p>
              <button type="button" onClick={() => setConfirmProjectDelete(true)}>
                <Trash2 size={15} /> Delete local project
              </button>
            </fieldset>
          </div>
        )}
      </Dialog>
      <Dialog
        open={navigation.state === "blocked"}
        title="Before you leave"
        description="Your project source is stored on this device only. VELORI cannot recover work erased when browser data is cleared. Download a portable backup before you leave."
        onClose={() => navigation.reset?.()}
        actions={
          <>
            <button className="button" onClick={() => navigation.reset?.()}>
              Continue Editing
            </button>
            <button
              className="button"
              onClick={() => {
                void persist(project)
                  .then(() =>
                    setStatus("Saved on this device. Export a backup for device-loss protection."),
                  )
                  .catch(() => setStatus("Save failed. Export a backup."));
              }}
            >
              Save Project
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                try {
                  downloadProject(project, "zip"); // Portable backup succeeds independently of IndexedDB.
                  setBackedUp(true);
                  void persist(project).catch(() => undefined);
                  navigation.proceed?.();
                } catch {
                  setStatus("ZIP export failed. Stay here and retry the backup.");
                }
              }}
            >
              <HardDriveDownload size={15} /> Export Backup ZIP & leave
            </button>
            <button className="button" onClick={() => navigation.proceed?.()}>
              Leave Anyway
            </button>
          </>
        }
      />
      <Dialog
        open={!!deletingFile}
        title={`Remove ${deletingFile ?? "source file"}?`}
        description="This can break the application. The previous source remains available with Undo until another revision is applied."
        onClose={() => setDeletingFile(null)}
        actions={
          <>
            <button className="button" onClick={() => setDeletingFile(null)}>
              Keep file
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                setUndo(project);
                edit({ files: (project.files ?? []).filter((f) => f.path !== deletingFile) });
                if (selectedFile === deletingFile) setSelectedFile(null);
                setDeletingFile(null);
              }}
            >
              Remove file
            </button>
          </>
        }
      />
      <Dialog
        open={!!deleting}
        title={`Remove /${deleting ?? ""}?`}
        description="Export a project backup first if you need to keep this page."
        onClose={() => setDeleting(null)}
        actions={
          <>
            <button className="button" onClick={() => setDeleting(null)}>
              Keep page
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                edit({ pages: project.pages.filter((p) => p.path !== deleting) });
                if (path === deleting) {
                  setPath("index");
                  setPreviewPath("index");
                }
                setDeleting(null);
              }}
            >
              Remove page
            </button>
          </>
        }
      />
    </>
  );
}
