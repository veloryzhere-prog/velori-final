import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router";
import { ArrowLeft, ArrowRight, Check, HardDrive, Sparkles } from "lucide-react";
import { Dialog } from "../../components/ui";
import { studioId } from "./identity";
import { clearForgeLandingDraft } from "./forge-landing-state";
import { parseForgeProjectSetup, type ForgeProjectSetup } from "./model";
import type { ForgeLandingMode } from "./forge-landing-state";

const steps = [
  "Project identity",
  "Platform & framework",
  "Design & experience",
  "AI preferences",
  "Storage & advanced",
  "Review & create",
];
const categories = [
  "Website",
  "Web Application",
  "Dashboard",
  "Portfolio",
  "Storefront",
  "Presentation",
  "Business Tool",
  "API / Backend",
  "Full-Stack Application",
  "Custom",
];
const designs = [
  "Aurora Glass",
  "Ivory Glass",
  "Minimal",
  "Editorial",
  "Professional Dashboard",
  "Modern Gradient",
  "Soft Glass",
  "Bold Contemporary",
];
const frameworks: Array<{
  id: "static-html" | "react-vite" | "python-fastapi";
  name: string;
  detail: string;
  capability: string;
  platforms: ForgeProjectSetup["platform"][];
}> = [
  {
    id: "static-html",
    name: "HTML, CSS & JavaScript",
    detail: "A lightweight browser project with editable source.",
    capability: "Built-in browser preview",
    platforms: ["website", "web-app", "presentation", "custom"],
  },
  {
    id: "react-vite",
    name: "React + TypeScript",
    detail: "A typed Vite starter, ready to edit and export.",
    capability: "Source and ZIP export; no local runtime in this workspace",
    platforms: ["website", "web-app", "custom"],
  },
  {
    id: "python-fastapi",
    name: "Python + FastAPI",
    detail: "A small API starter with a health route and test scaffold.",
    capability: "Source and ZIP export; Python server execution unavailable",
    platforms: ["backend-api", "custom"],
  },
] as const;
type Framework = (typeof frameworks)[number]["id"];
type SetupValues = ForgeProjectSetup & { title: string };
type SetupDraft = { id: string; step: number; title: string; setup: ForgeProjectSetup };

function defaults(prompt: string, mode: ForgeLandingMode): SetupValues {
  return {
    title: "",
    version: 1,
    description: "",
    category: "Website",
    platform: "website",
    framework: "static-html",
    theme: "system",
    design: "Aurora Glass",
    color: "#8b6be6",
    animation: "subtle",
    responsive: "mobile-first",
    aiProvider: "gemini",
    defaultMode: mode,
    storage: "local",
    autosave: true,
    backupReminder: true,
    initialPrompt: prompt.slice(0, 4000),
  };
}

function readSetupDraft(key: string): SetupDraft | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null") as Record<string, unknown> | null;
    if (
      !raw ||
      typeof raw.id !== "string" ||
      typeof raw.title !== "string" ||
      raw.title.length > 80 ||
      !Number.isInteger(raw.step) ||
      Number(raw.step) < 0 ||
      Number(raw.step) >= steps.length
    )
      return null;
    return {
      id: raw.id,
      step: Number(raw.step),
      title: raw.title,
      setup: parseForgeProjectSetup(raw.setup),
    };
  } catch {
    return null;
  }
}

export function ProjectSetup({
  scope,
  initialPrompt,
  initialMode,
  onCreate,
  onBack,
}: {
  scope: string;
  initialPrompt: string;
  initialMode: ForgeLandingMode;
  onCreate: (title: string, setup: ForgeProjectSetup) => Promise<void>;
  onBack: () => void;
}) {
  const draftKey = `velori.forge.setup.v1.${scope}`;
  const savedDraft = useRef(readSetupDraft(draftKey));
  const draftId = useRef(savedDraft.current?.id ?? studioId());
  const [values, setValues] = useState(() => defaults(initialPrompt, initialMode));
  const latestValues = useRef(values);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [showRecovery, setShowRecovery] = useState(Boolean(savedDraft.current));
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const navigation = useBlocker(() => dirtyRef.current);
  const availableFrameworks = frameworks.filter((item) => item.platforms.includes(values.platform));

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function update(patch: Partial<SetupValues>) {
    const next = { ...latestValues.current, ...patch };
    latestValues.current = next;
    setValues(next);
    setDirty(true);
    setError("");
    setDraftNotice("");
    persistSetupDraft(next, step);
  }

  function persistSetupDraft(current: SetupValues, currentStep: number) {
    try {
      const setup = parseForgeProjectSetup({ ...current, title: undefined });
      localStorage.setItem(
        draftKey,
        JSON.stringify({ id: draftId.current, step: currentStep, title: current.title, setup }),
      );
    } catch {
      setDraftNotice("Browser storage is unavailable. Use Save Draft or export any existing work.");
    }
  }

  function currentSetupValues() {
    const saved = readSetupDraft(draftKey);
    if (saved?.id === draftId.current) return { ...saved.setup, title: saved.title };
    return latestValues.current;
  }

  function resumeDraft() {
    const saved = savedDraft.current;
    if (!saved) return;
    const next = { ...saved.setup, title: saved.title };
    latestValues.current = next;
    setValues(next);
    setStep(saved.step);
    draftId.current = saved.id;
    setDirty(false);
    setShowRecovery(false);
  }

  function startFresh() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      setDraftNotice("The saved setup could not be removed from browser storage.");
    }
    draftId.current = studioId();
    savedDraft.current = null;
    setShowRecovery(false);
  }

  function saveDraft() {
    try {
      persistSetupDraft(currentSetupValues(), step);
      clearForgeLandingDraft(localStorage);
      setDirty(false);
      setDraftNotice("Draft saved on this device.");
      return true;
    } catch (cause) {
      setDraftNotice(cause instanceof Error ? cause.message : "Draft could not be saved.");
      return false;
    }
  }

  function saveDraftAndLeave() {
    if (!saveDraft()) return;
    if (navigation.state === "blocked") navigation.proceed?.();
    else onBack();
  }

  function leaveWithoutSaving() {
    try {
      localStorage.removeItem(draftKey);
      clearForgeLandingDraft(localStorage);
    } catch {
      setDraftNotice("The saved setup could not be removed. Stay here and retry.");
      return;
    }
    setDirty(false);
    navigation.proceed?.();
    onBack();
  }

  function continueStep() {
    if (step === 0 && !values.title.trim()) {
      setError("Add a project name to continue.");
      return;
    }
    if (step < steps.length - 1) {
      const next = step + 1;
      setStep(next);
      persistSetupDraft(latestValues.current, next);
    }
  }

  async function createProject() {
    const current = currentSetupValues();
    const title = current.title.trim();
    if (!title) {
      setStep(0);
      setError("Add a project name before creating the project.");
      return;
    }
    if (creating) return;
    setCreating(true);
    setError("");
    dirtyRef.current = false;
    setDirty(false);
    try {
      const setup = parseForgeProjectSetup({ ...current, title: undefined });
      await onCreate(title, setup);
      localStorage.removeItem(draftKey);
      setDirty(false);
    } catch (cause) {
      dirtyRef.current = true;
      setDirty(true);
      setError(
        cause instanceof Error ? cause.message : "Project could not be saved on this device.",
      );
      setCreating(false);
    }
  }

  const selectedFramework = frameworks.find((item) => item.id === values.framework);
  return (
    <main className="vf-root vf-setup-root">
      <header className="vf-setup-topbar">
        <button type="button" className="vf-setup-back" onClick={onBack} aria-label="Back to FORGE">
          <ArrowLeft size={18} />
          <span>FORGE</span>
        </button>
        <div>
          <p className="vf-eyebrow">PROJECT SETUP</p>
          <h1>Create a project</h1>
        </div>
        <span className="vf-setup-count">
          {step + 1} / {steps.length}
        </span>
      </header>

      <div
        className="vf-setup-progress"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={step + 1}
      >
        <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>

      <div className="vf-setup-layout">
        <nav className="vf-setup-steps" aria-label="Project setup steps">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              aria-current={index === step ? "step" : undefined}
              disabled={index > step}
              onClick={() => setStep(index)}
            >
              <span>{index < step ? <Check size={14} /> : index + 1}</span>
              {label}
            </button>
          ))}
          <p>Keep source on this device. Choose a runtime only when FORGE can support it.</p>
        </nav>

        <section className="vf-setup-form" aria-labelledby="vf-setup-step-title">
          {showRecovery && savedDraft.current ? (
            <div className="vf-setup-recovery" role="region" aria-label="Saved setup draft">
              <div>
                <strong>Unfinished setup found</strong>
                <span>Resume it or start a fresh project.</span>
              </div>
              <button type="button" onClick={resumeDraft}>
                Resume draft
              </button>
              <button type="button" onClick={startFresh}>
                Start fresh
              </button>
            </div>
          ) : null}
          <p className="vf-eyebrow">
            STEP {step + 1} OF {steps.length}
          </p>
          <h2 id="vf-setup-step-title">{steps[step]}</h2>
          {step === 0 && (
            <div className="vf-setup-fields">
              <label>
                Project name{" "}
                <input
                  id="vf-setup-project-name"
                  name="projectName"
                  autoFocus
                  value={values.title}
                  maxLength={80}
                  onChange={(event) => update({ title: event.target.value })}
                  placeholder="A name for this idea"
                />
              </label>
              <small>{values.title.length}/80 characters</small>
              <label>
                Description{" "}
                <textarea
                  value={values.description}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => update({ description: event.target.value })}
                  placeholder="What should this project help someone do?"
                />
              </label>
              <label>
                Initial prompt{" "}
                <textarea
                  value={values.initialPrompt}
                  maxLength={4000}
                  rows={5}
                  onChange={(event) => update({ initialPrompt: event.target.value })}
                  placeholder="Describe what you want to make. Generation starts later, from the editor."
                />
              </label>
              <small>{values.initialPrompt.length}/4,000 characters</small>
              <label>
                Project category{" "}
                <select
                  value={values.category}
                  onChange={(event) => update({ category: event.target.value })}
                >
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="vf-setup-fields">
              <fieldset>
                <legend>What are you building?</legend>
                <div className="vf-setup-choice-grid">
                  {(
                    [
                      ["website", "Website"],
                      ["web-app", "Web app"],
                      ["backend-api", "Backend API"],
                      ["presentation", "Presentation"],
                      ["custom", "Custom project"],
                    ] as const
                  ).map(([id, label]) => (
                    <label
                      className={`vf-setup-choice${values.platform === id ? " is-selected" : ""}`}
                      key={id}
                    >
                      <input
                        type="radio"
                        name="forge-platform"
                        checked={values.platform === id}
                        onChange={() => {
                          const next = frameworks.find((item) => item.platforms.includes(id));
                          update({ platform: id, ...(next ? { framework: next.id } : {}) });
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Framework and execution</legend>
                <div className="vf-setup-frameworks">
                  {availableFrameworks.map((item) => (
                    <label
                      className={`vf-setup-framework${values.framework === item.id ? " is-selected" : ""}`}
                      key={item.id}
                    >
                      <input
                        type="radio"
                        name="forge-framework"
                        checked={values.framework === item.id}
                        onChange={() => update({ framework: item.id as Framework })}
                      />
                      <strong>{item.name}</strong>
                      <span>{item.detail}</span>
                      <small>{item.capability}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 2 && (
            <div className="vf-setup-fields">
              <fieldset>
                <legend>Visual style</legend>
                <div className="vf-setup-designs">
                  {designs.map((design, index) => (
                    <label
                      className={`vf-setup-design${values.design === design ? " is-selected" : ""}`}
                      key={design}
                    >
                      <input
                        type="radio"
                        name="forge-design"
                        checked={values.design === design}
                        onChange={() => update({ design })}
                      />
                      <span
                        className={`vf-setup-thumbnail vf-setup-thumbnail-${index}`}
                        aria-hidden="true"
                      >
                        <i />
                        <i />
                        <i />
                      </span>
                      <strong>{design}</strong>
                      <small>
                        {index === 0
                          ? "Layered surfaces · soft ambient glow"
                          : index === 1
                            ? "Warm surfaces · calm contrast"
                            : "Clear hierarchy · considered spacing"}
                      </small>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="vf-setup-two-col">
                <label>
                  Theme{" "}
                  <select
                    value={values.theme}
                    onChange={(event) =>
                      update({ theme: event.target.value as ForgeProjectSetup["theme"] })
                    }
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label>
                  Accent color{" "}
                  <input
                    type="color"
                    value={values.color}
                    onChange={(event) => update({ color: event.target.value })}
                  />
                </label>
                <label>
                  Animation{" "}
                  <select
                    value={values.animation}
                    onChange={(event) =>
                      update({ animation: event.target.value as ForgeProjectSetup["animation"] })
                    }
                  >
                    <option value="off">Off</option>
                    <option value="subtle">Subtle</option>
                    <option value="balanced">Balanced</option>
                    <option value="expressive">Expressive</option>
                  </select>
                </label>
                <label>
                  Responsive priority{" "}
                  <select
                    value={values.responsive}
                    onChange={(event) =>
                      update({ responsive: event.target.value as ForgeProjectSetup["responsive"] })
                    }
                  >
                    <option value="mobile-first">Mobile-first</option>
                    <option value="desktop-first">Desktop-first</option>
                    <option value="adaptive">Adaptive</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="vf-setup-fields">
              <fieldset>
                <legend>AI runtime</legend>
                <p>
                  FORGE uses the protected server-managed runtime when you consent in the editor.
                </p>
              </fieldset>
              <div className="vf-setup-note">
                <Sparkles size={18} />
                <p>
                  Project prompts and source context are sent to the server-managed runtime only
                  after you consent in the editor.
                </p>
              </div>
              <label>
                Default interaction{" "}
                <select
                  value={values.defaultMode}
                  onChange={(event) =>
                    update({ defaultMode: event.target.value as ForgeLandingMode })
                  }
                >
                  <option value="build">Build</option>
                  <option value="ask">Ask</option>
                </select>
              </label>
              <p className="vf-setup-muted">
                Generation detail follows the provider's actual capabilities. Project setup itself
                never starts AI work.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="vf-setup-fields">
              <div className="vf-setup-note">
                <HardDrive size={19} />
                <p>
                  Your project source stays in this browser by default. Browser storage can be
                  cleared; export a ZIP backup for anything you need to keep.
                </p>
              </div>
              <label className="vf-setup-toggle">
                <input
                  type="checkbox"
                  checked={values.autosave}
                  onChange={(event) => update({ autosave: event.target.checked })}
                />
                <span>
                  <strong>Autosave project edits</strong>
                  <small>Save local changes as you work.</small>
                </span>
              </label>
              <label className="vf-setup-toggle">
                <input
                  type="checkbox"
                  checked={values.backupReminder}
                  onChange={(event) => update({ backupReminder: event.target.checked })}
                />
                <span>
                  <strong>Remind me to export a backup</strong>
                  <small>Keep a portable copy separate from browser data.</small>
                </span>
              </label>
              <details className="vf-setup-advanced">
                <summary>Advanced runtime details</summary>
                <p>
                  {selectedFramework?.capability}. Setup does not execute shell commands, upload
                  source, or configure a hosted backend.
                </p>
              </details>
            </div>
          )}

          {step === 5 && (
            <div className="vf-setup-review">
              <dl>
                <div>
                  <dt>Project</dt>
                  <dd>{values.title.trim() || "Name required"}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{values.category}</dd>
                </div>
                <div>
                  <dt>Framework</dt>
                  <dd>{selectedFramework?.name}</dd>
                </div>
                <div>
                  <dt>Runtime</dt>
                  <dd>{selectedFramework?.capability}</dd>
                </div>
                <div>
                  <dt>Design</dt>
                  <dd>
                    {values.design} · {values.theme} theme
                  </dd>
                </div>
                <div>
                  <dt>AI</dt>
                  <dd>Protected server runtime · default {values.defaultMode}</dd>
                </div>
                <div>
                  <dt>Storage</dt>
                  <dd>Local browser storage</dd>
                </div>
                <div>
                  <dt>Initial prompt</dt>
                  <dd>
                    {values.initialPrompt.trim()
                      ? values.initialPrompt.trim().slice(0, 220)
                      : "No prompt yet"}
                  </dd>
                </div>
              </dl>
              <p className="vf-setup-note-text">
                Creating this local project does not consume a creation credit. A later AI
                generation uses the server's current allowance and provider checks.
              </p>
            </div>
          )}

          {error && (
            <p className="vf-setup-error" role="alert">
              {error}
            </p>
          )}
          {draftNotice && (
            <p className="vf-setup-muted" role="status">
              {draftNotice}
            </p>
          )}
        </section>

        <aside className="vf-setup-summary" aria-live="polite">
          <p className="vf-eyebrow">PROJECT SUMMARY</p>
          <h2>{values.title.trim() || "Your project"}</h2>
          <p>
            {values.description ||
              values.initialPrompt ||
              "Your project details will appear here as you set them."}
          </p>
          <dl>
            <div>
              <dt>Framework</dt>
              <dd>{selectedFramework?.name}</dd>
            </div>
            <div>
              <dt>Design</dt>
              <dd>{values.design}</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>On this device</dd>
            </div>
          </dl>
          <span
            className="vf-setup-summary-swatch"
            style={{ backgroundColor: values.color }}
            aria-label={`Accent ${values.color}`}
          />
        </aside>
      </div>

      <footer className="vf-setup-footer">
        <button
          type="button"
          className="vf-setup-secondary"
          disabled={step === 0 || creating}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
        >
          Back
        </button>
        <button
          type="button"
          className="vf-setup-secondary"
          disabled={creating}
          onClick={saveDraft}
        >
          Save Draft
        </button>
        {step < steps.length - 1 ? (
          <button type="button" className="vf-primary" disabled={creating} onClick={continueStep}>
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="vf-primary"
            disabled={creating}
            onClick={() => void createProject()}
          >
            {creating ? "Saving project…" : "Create Project"} {!creating && <Check size={16} />}
          </button>
        )}
      </footer>

      <Dialog
        open={navigation.state === "blocked"}
        title="Leave project setup?"
        description="Your unfinished setup changes may be lost unless you save a draft."
        onClose={() => navigation.reset?.()}
        actions={
          <>
            <button type="button" onClick={() => navigation.reset?.()}>
              Continue Editing
            </button>
            <button type="button" onClick={saveDraftAndLeave}>
              Save Draft
            </button>
            <button type="button" onClick={leaveWithoutSaving}>
              Leave Without Saving
            </button>
          </>
        }
      />
    </main>
  );
}
