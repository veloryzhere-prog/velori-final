import { studioId } from "./identity.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { Aperture, ArrowUpRight, Plus, Upload, Trash2, Code2, Layers3, Image } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { Dialog } from "../../components/ui";
import { readProjects, importProject, type Project, type ForgeProjectSetup } from "./model";
import { loadDeviceProjects, persistDeviceProject, deleteDeviceProject } from "./device-store";
import { Workspace } from "./Workspace";
import { ForgeLandingPage } from "./ForgeLandingPage";
import { ProjectSetup } from "./ProjectSetup";
import { LegacyPrivacy } from "./LegacyPrivacy";
import { starters } from "./templates";
import { ForgeHeader } from "./Header";
import {
  clearForgeLandingDraft,
  parseForgeLandingHandoff,
  readForgeLandingDraft,
  type ForgeLandingMode,
} from "./forge-landing-state";
import { pythonApiStarterFiles, reactStarterFiles } from "./multi-file";
import "./studio.css";
export function StudioPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const setupRoute = location.pathname === "/forge/projects/new";
  return loading ? (
    <div className="vf-boot" role="status">
      Opening your creative space…
    </div>
  ) : location.pathname === "/forge" || location.pathname === "/forge/" ? (
    <ForgeLandingPage signedIn={!!user} />
  ) : setupRoute && !user ? (
    <Navigate to="/login" replace state={{ from: "/forge" }} />
  ) : (
    <StudioSession key={user?.id ?? "visitor"} scope={user?.id ?? "visitor"} signedIn={!!user} />
  );
}

function StudioSession({ scope, signedIn }: { scope: string; signedIn: boolean }) {
  const key = `velori.artifacts.v1.${scope}`;
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const setupRoute = location.pathname === "/forge/projects/new";
  const file = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState(() => {
    try {
      return readProjects(localStorage, key);
    } catch {
      return [];
    }
  });
  const [guide, setGuide] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [landingHandoffFailed, setLandingHandoffFailed] = useState(false);
  const creatingProject = useRef(false);
  useEffect(() => {
    let active = true;
    void loadDeviceProjects(scope, key).then((rows) => {
      if (active) {
        setProjects(rows);
        setLoadingProjects(false);
      }
    });
    return () => {
      active = false;
    };
  }, [scope, key]);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<Project | null>(null);
  const landingHandoff = parseForgeLandingHandoff(
    (location.state as { forgeLandingDraft?: unknown } | null)?.forgeLandingDraft,
  );
  const landingHandoffStarted = useRef(false);
  const persist = useCallback(
    async (p: Project) => {
      await persistDeviceProject(scope, p, key);
      setProjects((prev) => [p, ...prev.filter((item) => item.id !== p.id)].slice(0, 40));
    },
    [scope, key],
  );
  const deleteCurrentProject = useCallback(async () => {
    if (!projectId) return;
    await deleteDeviceProject(scope, projectId, key);
    setProjects((current) => current.filter((item) => item.id !== projectId));
    navigate("/artifacts", { replace: true });
  }, [key, navigate, projectId, scope]);
  useEffect(() => {
    if (
      !signedIn ||
      projectId ||
      setupRoute ||
      loadingProjects ||
      !landingHandoff ||
      landingHandoffStarted.current
    )
      return;
    if (landingHandoff.mode === "build") {
      navigate("/forge/projects/new", {
        replace: true,
        state: { forgeLandingDraft: landingHandoff },
      });
      return;
    }
    landingHandoffStarted.current = true;
    setLandingHandoffFailed(false);
    const starter = starters[0];
    const project: Project = {
      id: studioId(),
      title: "A new idea",
      pages: structuredClone(starter.pages),
      history: [],
      updatedAt: new Date().toISOString(),
    };
    void persist(project)
      .then(() => {
        try {
          clearForgeLandingDraft(window.localStorage);
        } catch {
          // The route state still carries the draft into the editor.
        }
        setError("");
        navigate(`/studio/${project.id}`, {
          replace: true,
          state: { initialPrompt: landingHandoff.prompt, initialMode: landingHandoff.mode },
        });
      })
      .catch((cause) => {
        setLandingHandoffFailed(true);
        setError(
          cause instanceof Error
            ? cause.message
            : "Browser storage is unavailable. Your prompt is still saved in this tab.",
        );
      });
  }, [landingHandoff, loadingProjects, navigate, persist, projectId, setupRoute, signedIn]);
  useEffect(() => {
    const prior = document.title;
    document.title = "Forge AI · VELORI";
    return () => {
      document.title = prior;
    };
  }, []);
  async function start(index: number, prompt = "") {
    const starter = starters[index];
    const p: Project = {
      id: studioId(),
      title: prompt ? "A new idea" : starter.title,
      pages: structuredClone(starter.pages),
      history: [],
      updatedAt: new Date().toISOString(),
    };
    try {
      await persist(p);
      setError("");
      navigate(`/studio/${p.id}`, { state: { initialPrompt: prompt } });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Browser storage is unavailable. Export older projects before starting another.",
      );
    }
  }
  const createConfiguredProject = useCallback(
    async (title: string, setup: ForgeProjectSetup) => {
      if (creatingProject.current) return;
      creatingProject.current = true;
      const starter = starters[0];
      const files =
        setup.framework === "react-vite"
          ? reactStarterFiles(title)
          : setup.framework === "python-fastapi"
            ? pythonApiStarterFiles(title)
            : [];
      const project: Project = {
        id: studioId(),
        title: title.trim(),
        pages: structuredClone(starter.pages),
        ...(files.length ? { files } : {}),
        ...(setup.framework === "react-vite"
          ? { stack: "react" as const }
          : setup.framework === "python-fastapi"
            ? { stack: "multi-file" as const }
            : { stack: "static" as const }),
        setup,
        history: [],
        updatedAt: new Date().toISOString(),
      };
      try {
        await persist(project);
        try {
          clearForgeLandingDraft(window.localStorage);
        } catch {
          // The setup manifest contains the prompt if browser storage is restricted.
        }
        navigate(`/studio/${project.id}`, {
          replace: true,
          state: { initialPrompt: setup.initialPrompt, initialMode: setup.defaultMode },
        });
      } finally {
        creatingProject.current = false;
      }
    },
    [navigate, persist],
  );
  async function importFile(selected?: File) {
    if (!selected) return;
    try {
      if (selected.size > 5000000) throw new Error("Choose a project JSON smaller than 5 MB.");
      const p = importProject(await selected.text());
      await persist(p);
      setError("");
      navigate(`/studio/${p.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This project could not be imported.");
    } finally {
      if (file.current) file.current.value = "";
    }
  }
  const project = projects.find((p) => p.id === projectId);
  let visitor: Project | undefined;
  if (signedIn && projectId && !project) {
    try {
      visitor = readProjects(localStorage, "velori.artifacts.v1.visitor").find(
        (p) => p.id === projectId,
      );
    } catch {
      /* Import remains available. */
    }
  }
  if (location.pathname === "/studio" || location.pathname === "/studio/")
    return <Navigate to="/artifacts" replace />;
  if (setupRoute) {
    let savedPrompt = "";
    let savedMode: ForgeLandingMode = "build";
    try {
      const draft = readForgeLandingDraft(window.localStorage);
      savedPrompt = draft?.prompt ?? "";
      savedMode = draft?.mode ?? "build";
    } catch {
      // Route state remains available when local storage is blocked.
    }
    return (
      <ProjectSetup
        scope={scope}
        initialPrompt={landingHandoff?.prompt ?? savedPrompt}
        initialMode={landingHandoff?.mode ?? savedMode}
        onCreate={createConfiguredProject}
        onBack={() => navigate("/forge")}
      />
    );
  }
  if (projectId && loadingProjects)
    return (
      <main className="vf-root vf-boot" role="status">
        Restoring your project from this device…
      </main>
    );
  return (
    <main className="vf-root">
      <ForgeHeader onImport={() => file.current?.click()} onGuide={() => setGuide(true)} />
      <input
        hidden
        type="file"
        ref={file}
        accept=".json,application/json"
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      {error && (
        <p className="vf-error" role="alert">
          {error}
          {landingHandoffFailed && (
            <button
              type="button"
              onClick={() => {
                landingHandoffStarted.current = false;
                setLandingHandoffFailed(false);
                setError("");
              }}
            >
              Retry prompt
            </button>
          )}
          <button onClick={() => setError("")}>Dismiss</button>
        </p>
      )}
      {projectId ? (
        project ? (
          <Workspace
            key={project.id}
            initial={project}
            signedIn={signedIn}
            persist={persist}
            onGuide={() => setGuide(true)}
            onDeleteProject={deleteCurrentProject}
            initialPrompt={
              typeof location.state?.initialPrompt === "string"
                ? location.state.initialPrompt.slice(0, 4000)
                : ""
            }
            initialMode={
              location.state?.initialMode === "ask"
                ? "ask"
                : (project.setup?.defaultMode ?? "build")
            }
          />
        ) : (
          <section className="vf-empty">
            <h1>This project isn’t in this browser.</h1>
            <p>Open it where you saved it, import its backup, or restore your account copy.</p>
            <Link to="/artifacts">Your projects ↗</Link>
            {visitor && (
              <button
                className="vf-primary"
                onClick={() => {
                  try {
                    void persist(visitor!).catch(() =>
                      setError("Could not save this local draft."),
                    );
                  } catch {
                    setError("The visitor draft could not be copied. Export it first.");
                  }
                }}
              >
                Continue your visitor draft
              </button>
            )}
          </section>
        )
      ) : (
        <>
          <Welcome onStart={(p) => void start(0, p)} />
          <section className="vf-library">
            <div className="vf-section-heading">
              <div>
                <p className="vf-eyebrow">YOUR CREATIVE CORNER</p>
                <h2>Ideas worth keeping.</h2>
                <p className="vf-muted">
                  Local-first · Your source stays on this device. Export a ZIP backup.
                </p>
              </div>
              <button className="vf-primary" onClick={() => void start(0)}>
                <Plus size={16} />
                New canvas
              </button>
            </div>
            {loadingProjects && <p role="status">Restoring local projects…</p>}
            {!loadingProjects && !projects.length && (
              <div className="vf-empty">
                <h3>A fresh page, just for you.</h3>
                <p>Your saved projects will appear here. Try a hand-written starter below.</p>
              </div>
            )}
            <div className="vf-projects">
              {projects.map((p) => (
                <article className="vf-project-card" key={p.id}>
                  <Link to={`/studio/${p.id}`}>
                    <div className="vf-project-art" aria-hidden="true">
                      v
                    </div>
                    <h3>{p.title}</h3>
                    <p>
                      {p.pages.length} pages · Edited {new Date(p.updatedAt).toLocaleDateString()}
                    </p>
                    <span>Open project ↗</span>
                  </Link>
                  <button
                    className="vf-delete"
                    aria-label={`Delete ${p.title}`}
                    onClick={() => setDeleting(p)}
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>
            <h3 className="vf-starter-title">A little head start</h3>
            <div className="vf-starters">
              {starters.map((s, i) => (
                <button key={s.title} onClick={() => void start(i)}>
                  <span>0{i + 1}</span>
                  <strong>{s.title}</strong>
                  <small>{s.description}</small>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            </div>
          </section>
          <LegacyPrivacy signedIn={signedIn} />
        </>
      )}
      <Dialog
        open={!!deleting}
        title="Remove this browser copy?"
        description="This will remove the project from this device. Export a ZIP backup first. Any old legacy cloud copies are managed separately."
        onClose={() => setDeleting(null)}
        actions={
          <>
            <button className="button" onClick={() => setDeleting(null)}>
              Keep project
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                try {
                  if (deleting) {
                    void deleteDeviceProject(scope, deleting.id, key)
                      .then(() => {
                        setProjects((rows) => rows.filter((p) => p.id !== deleting.id));
                        setDeleting(null);
                      })
                      .catch(() => setError("Could not delete this local project."));
                  }
                } catch {
                  setError("The browser copy could not be removed.");
                  setDeleting(null);
                }
              }}
            >
              Remove copy
            </button>
          </>
        }
      />
      <Dialog
        open={guide}
        title="Your guide to VELORI Forge AI"
        onClose={() => setGuide(false)}
        className="vf-guide"
      >
        <section>
          <h3>01 · Imagine it</h3>
          <p>
            Describe your website, React app, or project. Attach a JPG, PNG or WebP screenshot in
            the Build panel as a design reference. Starters are hand-written examples, never
            simulated AI results.
          </p>
        </section>
        <section>
          <h3>02 · Make it yours</h3>
          <p>
            Add up to eight pages. Use #index and #page-name for static preview navigation. Edit
            HTML, CSS and JavaScript, or create React/TypeScript source files. Static previews work
            on desktop and phone; React npm builds require an external runner. Review generated
            changes before applying them; one-step undo keeps the previous draft.
          </p>
        </section>
        <section>
          <h3>03 · Keep what you create</h3>
          <p>
            Browser drafts are saved on this device using IndexedDB, with a legacy browser-storage
            fallback. Export source ZIP or project JSON regularly. Clearing browser data removes
            local drafts and VELORI cannot recover them.
          </p>
        </section>
        <section>
          <h3>Account connection and credits</h3>
          <p>
            AI and billing require the reviewed Studio database and protected server configuration.
            Open Connection & setup in the workspace to check live readiness. Connected accounts
            receive server-verified generation allowances; the actual allowance comes from the
            server. Credit packs and Premium unlock only after verified payment.
          </p>
        </section>
        <section>
          <h3>Owner setup</h3>
          <p>
            Approve the six-table Studio schema, then configure the Edge Function's protected
            secrets: VELORI_STUDIO_ENCRYPTION_KEY (32 random bytes in base64), GEMINI_API_KEY, a
            supported VELORI_GEMINI_MODEL, VELORI_STUDIO_ENABLED=true, and
            VELORI_STUDIO_GENERATION_ENABLED=true. Set VELORI_STUDIO_ORIGINS to your exact site
            origin. Payment keys and actual Stripe price IDs are optional until billing is
            activated. The source's docs/forge/DEPLOYMENT.md contains the complete acceptance steps.
            Return to the workspace and check the connection again.
          </p>
        </section>
        <section>
          <h3>Thoughtful previews and sharing</h3>
          <p>
            Code runs in an opaque-origin sandbox without access to your VELORI account. External
            libraries, network fetches and forms are blocked. A browser frame is not CPU/memory
            isolation. FORGE does not upload local project source as an account backup in
            local-first mode. Existing legacy cloud copies require separate deletion through the
            account data controls. Public sharing needs an explicitly chosen publishing service;
            downloads remain local.
          </p>
        </section>
        <Link to="/help" onClick={() => setGuide(false)}>
          Visit VELORI Help ↗
        </Link>
      </Dialog>
    </main>
  );
}
function Welcome({ onStart }: { onStart: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    let visible = true;
    const update = () => {
      if (root.current) root.current.dataset.paused = String(document.hidden || !visible);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        update();
      },
      { rootMargin: "80px" },
    );
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <section ref={root} className="vf-welcome">
      <div>
        <p className="vf-eyebrow">IMAGINATION, WITH A RUN BUTTON.</p>
        <h1>
          What if
          <br />
          <em>you built it?</em>
        </h1>
        <p className="vf-muted">
          Plan an idea, explore code, or generate editable project files.
          <br />
          React and TypeScript source can be exported for local building.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (prompt.trim()) onStart(prompt.trim());
          }}
        >
          <label className="vf-sr" htmlFor="vf-start-prompt">
            Describe the app you want to build
          </label>
          <textarea
            id="vf-start-prompt"
            rows={3}
            maxLength={4000}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Build a portfolio for my photography, with a gallery and an about page…"
          />
          <div>
            <span>VELORI Forge AI</span>
            <button disabled={!prompt.trim()} type="submit">
              Start building <ArrowUpRight size={16} />
            </button>
          </div>
        </form>
        <div className="vf-chips">
          {["A focus timer", "My creative portfolio", "An interactive invitation"].map((idea) => (
            <button
              key={idea}
              onClick={() =>
                setPrompt(
                  `Build ${idea.toLowerCase()} with thoughtful animation and a responsive layout.`,
                )
              }
            >
              {idea} ↗
            </button>
          ))}
        </div>
        <small>
          AI uses the selected local runtime or the server-managed protected runtime. Your project
          files stay on this device; download backups regularly.
        </small>
      </div>
      <div className="vf-art" aria-hidden="true">
        <div className="vf-art-grid" />
        <div className="vf-art-card vf-art-code">
          <Code2 size={22} />
          <span>One curious thought.</span>
          <i />
          <i />
          <i />
        </div>
        <div className="vf-art-orbit">
          <span>v</span>
        </div>
        <div className="vf-art-card vf-art-pages">
          <Layers3 size={22} />
          <strong>A world of possibilities.</strong>
          <small>index / about / something new</small>
        </div>
        <div className="vf-art-card vf-art-image">
          <Image size={22} />
          <span>Bring your inspiration.</span>
        </div>
        <span className="vf-art-note">A little idea. A real beginning.</span>
      </div>
      <Link className="vf-welcome-plans" to="/forge/pricing">
        Explore credits & plans ↗
      </Link>
    </section>
  );
}

import "./runtime/workspace.css";
