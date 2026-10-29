/* Copyright © 2026 VELORYZ. */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  Code2,
  FileCode2,
  Gift,
  HardDrive,
  Layers3,
  Menu,
  MessageCircle,
  MonitorPlay,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  Smartphone,
  WandSparkles,
  Workflow,
} from "lucide-react";
import { Dialog } from "../../components/ui";
import veloriLogo from "../../imports/velori-official.svg";
import { useConnection } from "./Assistant";
import {
  FORGE_LANDING_PROMPT_LIMIT,
  readForgeLandingDraft,
  saveForgeLandingDraft,
  type ForgeLandingMode,
} from "./forge-landing-state";
import "./forge-landing.css";

type ThemePreference = "system" | "aurora" | "ivory";

const themeKey = "velori.forge.landing-theme.v1";

const suggestions = [
  {
    label: "Portfolio",
    prompt:
      "Create a portfolio for a visual artist, with a work gallery, about page, and contact section.",
  },
  {
    label: "Dashboard",
    prompt:
      "Design a calm project dashboard with a task list, progress summary, and clear responsive navigation.",
  },
  {
    label: "Storefront",
    prompt:
      "Create a small independent bookstore storefront with featured titles, category browsing, and a story about the shop.",
  },
  {
    label: "Presentation",
    prompt:
      "Build a concise presentation introducing a community garden, with an opening, three key ideas, and a closing slide.",
  },
];

const faqs = [
  {
    question: "What is FORGE AI?",
    answer:
      "FORGE is VELORI's workspace for shaping ideas into editable digital projects. You can start with a prompt, work with source, and keep local project copies on this device.",
  },
  {
    question: "Do I need an account?",
    answer:
      "You can explore the public page without an account. Submitting a landing-page prompt asks you to sign in first; the short-lived draft is kept locally while you authenticate.",
  },
  {
    question: "What can I preview today?",
    answer:
      "The built-in static preview supports the project's HTML, CSS, and JavaScript pages. React package execution requires a separately approved isolated runtime, and Python servers are not currently available in this workspace.",
  },
  {
    question: "Where are my project files saved?",
    answer:
      "FORGE keeps browser project drafts on this device and provides source export. Browser storage is not a permanent backup, so export copies you need to keep.",
  },
  {
    question: "How do plans and rewards work?",
    answer:
      "Current plan details are shown on the existing pricing page. No referral reward is being offered from this landing page; any future offer must be confirmed by VELORI before it is shown as active.",
  },
];

function storedTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(themeKey);
    if (value === "aurora" || value === "ivory" || value === "system") return value;
  } catch {
    // Theme selection remains usable when browser storage is blocked.
  }
  return "system";
}

function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="forge-section-title">
      <p className="forge-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function ForgeLandingPage({ signedIn }: { signedIn: boolean }) {
  const navigate = useNavigate();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const resumedDraft = useRef(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>(storedTheme);
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<ForgeLandingMode>("build");
  const [notice, setNotice] = useState("");
  const theme = themePreference === "system" ? (systemDark ? "aurora" : "ivory") : themePreference;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(themeKey, themePreference);
    } catch {
      // The selected theme still applies for this visit.
    }
  }, [themePreference]);

  useEffect(() => {
    if (!signedIn || resumedDraft.current) return;
    try {
      const draft = readForgeLandingDraft(window.localStorage);
      if (!draft) return;
      resumedDraft.current = true;
      navigate(draft.mode === "build" ? "/forge/projects/new" : "/artifacts", {
        replace: true,
        state: { forgeLandingDraft: draft },
      });
    } catch {
      setNotice("Your saved prompt could not be restored. Copy it here and continue again.");
    }
  }, [navigate, signedIn]);

  function continuePrompt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || value.length > FORGE_LANDING_PROMPT_LIMIT) return;
    setNotice("");
    if (!signedIn) {
      try {
        saveForgeLandingDraft(window.localStorage, { prompt: value, mode });
        navigate("/login", { state: { from: "/forge" } });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Sign-in could not be started.");
      }
      return;
    }
    try {
      saveForgeLandingDraft(window.localStorage, { prompt: value, mode });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your prompt could not be saved locally.");
    }
    navigate(mode === "build" ? "/forge/projects/new" : "/artifacts", {
      state: { forgeLandingDraft: { prompt: value, mode } },
    });
  }

  function selectSuggestion(value: string) {
    setPrompt(value);
    setNotice("");
    textarea.current?.focus();
  }

  const nav = (
    <>
      <a href="#features" onClick={() => setMobileOpen(false)}>
        Features
      </a>
      <a href="#how-it-works" onClick={() => setMobileOpen(false)}>
        How it works
      </a>
      <a href="#pricing" onClick={() => setMobileOpen(false)}>
        Pricing
      </a>
      <a href="#download" onClick={() => setMobileOpen(false)}>
        Download
      </a>
      <Link to="/help" onClick={() => setMobileOpen(false)}>
        Help
      </Link>
    </>
  );

  return (
    <main className="forge-landing" data-forge-theme={theme} id="top">
      <header className="forge-header">
        <div className="forge-header-inner">
          <Link className="forge-brand" to="/home" aria-label="VELORI home">
            <img src={veloriLogo} alt="VELORI" />
            <span className="forge-brand-divider" aria-hidden="true" />
            <span className="forge-brand-product">FORGE AI</span>
          </Link>
          <nav className="forge-nav" aria-label="Main navigation">
            {nav}
          </nav>
          <div className="forge-header-actions">
            <label className="forge-theme-select">
              <span className="forge-sr-only">Appearance</span>
              <select
                aria-label="Appearance"
                value={themePreference}
                onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
              >
                <option value="system">System</option>
                <option value="aurora">Aurora</option>
                <option value="ivory">Ivory</option>
              </select>
            </label>
            {signedIn ? (
              <>
                <Link className="forge-header-link" to="/artifacts">
                  My projects
                </Link>
                <Link
                  className="forge-button forge-button-small forge-button-primary"
                  to="/artifacts"
                >
                  Open FORGE <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </>
            ) : (
              <>
                <Link className="forge-header-link" to="/login" state={{ from: "/forge" }}>
                  Log in
                </Link>
                <Link
                  className="forge-button forge-button-small forge-button-primary"
                  to="/signup"
                  state={{ from: "/forge" }}
                >
                  Get started <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
          <button
            className="forge-menu-button"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <Menu size={21} aria-hidden="true" />
          </button>
        </div>
      </header>

      <Dialog
        open={mobileOpen}
        title="Explore FORGE"
        description="Choose a section or open your account."
        onClose={() => setMobileOpen(false)}
        className={`forge-mobile-dialog${theme === "aurora" ? " forge-mobile-dialog-aurora" : ""}`}
      >
        <nav className="forge-mobile-nav" aria-label="Mobile navigation">
          {nav}
        </nav>
        <div className="forge-mobile-account">
          {signedIn ? (
            <Link
              className="forge-button forge-button-primary"
              to="/artifacts"
              onClick={() => setMobileOpen(false)}
            >
              My projects <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <>
              <Link
                className="forge-button forge-button-primary"
                to="/signup"
                state={{ from: "/forge" }}
                onClick={() => setMobileOpen(false)}
              >
                Get started <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link
                className="forge-mobile-login"
                to="/login"
                state={{ from: "/forge" }}
                onClick={() => setMobileOpen(false)}
              >
                Log in
              </Link>
            </>
          )}
          <label className="forge-theme-select forge-mobile-theme">
            <span>Appearance</span>
            <select
              value={themePreference}
              onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
            >
              <option value="system">System</option>
              <option value="aurora">Aurora</option>
              <option value="ivory">Ivory</option>
            </select>
          </label>
        </div>
      </Dialog>

      <section className="forge-hero" aria-labelledby="forge-hero-title">
        <div className="forge-hero-content">
          <p className="forge-eyebrow">
            <Sparkles size={14} aria-hidden="true" /> VELORYZ STUDIO · CREATIVE WORKSPACE
          </p>
          <h1 id="forge-hero-title">
            Your ideas.
            <br />
            <span>Built with FORGE.</span>
          </h1>
          <p className="forge-hero-copy">
            Shape websites, apps and digital experiences into editable projects. Start with a
            prompt, then keep control of every change.
          </p>
          <form className="forge-composer" id="composer" onSubmit={continuePrompt}>
            <label className="forge-sr-only" htmlFor="forge-landing-prompt">
              Describe what you want to create
            </label>
            <textarea
              ref={textarea}
              id="forge-landing-prompt"
              value={prompt}
              maxLength={FORGE_LANDING_PROMPT_LIMIT}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Describe the website, app or experience you want to create…"
              rows={3}
              aria-describedby="forge-prompt-hint forge-prompt-count"
            />
            <div className="forge-composer-toolbar">
              <div className="forge-mode-switch" role="group" aria-label="Prompt mode">
                <button
                  type="button"
                  aria-pressed={mode === "build"}
                  onClick={() => setMode("build")}
                >
                  <Code2 size={15} aria-hidden="true" /> Build
                </button>
                <button type="button" aria-pressed={mode === "ask"} onClick={() => setMode("ask")}>
                  <MessageCircle size={15} aria-hidden="true" /> Ask
                </button>
              </div>
              <div className="forge-composer-submit">
                <span id="forge-prompt-count">
                  {prompt.length}/{FORGE_LANDING_PROMPT_LIMIT}
                </span>
                <button
                  className="forge-send-button"
                  type="submit"
                  disabled={!prompt.trim()}
                  aria-label={
                    signedIn
                      ? mode === "build"
                        ? "Continue to build"
                        : "Continue to ask"
                      : "Sign in to continue"
                  }
                >
                  {signedIn
                    ? mode === "build"
                      ? "Continue to build"
                      : "Continue to ask"
                    : "Continue"}
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </form>
          <p className="forge-prompt-hint" id="forge-prompt-hint">
            {signedIn
              ? "Your prompt opens in your local FORGE workspace. No generation starts until you choose it there."
              : "Sign in to continue. Your prompt is saved locally during authentication."}
            <span> Use Ctrl/⌘ + Enter to continue.</span>
          </p>
          {notice ? (
            <p className="forge-notice" role="status">
              {notice}
            </p>
          ) : null}
          <div className="forge-suggestions" aria-label="Prompt suggestions">
            <span>Try</span>
            {suggestions.map((idea) => (
              <button key={idea.label} type="button" onClick={() => selectSuggestion(idea.prompt)}>
                {idea.label}
              </button>
            ))}
          </div>
        </div>
        <a className="forge-scroll-cue" href="#features" aria-label="Scroll to FORGE features">
          <ArrowDown size={16} aria-hidden="true" />
        </a>
      </section>

      <section className="forge-proof-strip" aria-label="FORGE principles">
        <span>
          <HardDrive size={17} aria-hidden="true" /> Local-first project storage
        </span>
        <span>
          <ShieldCheck size={17} aria-hidden="true" /> Reviewed changes
        </span>
        <span>
          <FileCode2 size={17} aria-hidden="true" /> Editable source exports
        </span>
      </section>

      <section className="forge-section forge-features" id="features">
        <SectionTitle eyebrow="A WORKSPACE THAT STAYS YOURS" title="Make room for the idea.">
          FORGE pairs conversation with hands-on editing, so the project remains understandable and
          yours to shape.
        </SectionTitle>
        <div className="forge-feature-grid">
          <article className="forge-feature">
            <span className="forge-feature-icon">
              <WandSparkles size={20} aria-hidden="true" />
            </span>
            <h3>Start with a description</h3>
            <p>
              Use a connected model to draft or revise project source. Review a proposed change
              before it replaces your work.
            </p>
          </article>
          <article className="forge-feature">
            <span className="forge-feature-icon">
              <Layers3 size={20} aria-hidden="true" />
            </span>
            <h3>Edit the details</h3>
            <p>
              Work with page content and source files in the existing editor. Local drafts remain
              available even when cloud services are not.
            </p>
          </article>
          <article className="forge-feature">
            <span className="forge-feature-icon">
              <HardDrive size={20} aria-hidden="true" />
            </span>
            <h3>Keep a copy</h3>
            <p>
              Save projects in this browser and export source backups. Browser storage is
              convenient, not a substitute for your own backup.
            </p>
          </article>
        </div>
      </section>

      <section className="forge-section forge-workflow" id="how-it-works">
        <SectionTitle
          eyebrow="A CLEAR WAY THROUGH"
          title="From first thought to a project you can edit."
        />
        <ol className="forge-steps">
          <li>
            <span>01</span>
            <div>
              <h3>Describe the direction</h3>
              <p>Start with a goal, an audience, and what the experience should help someone do.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Choose how to work</h3>
              <p>
                Build to propose source changes, or Ask to discuss the current project without
                editing it.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Review and refine</h3>
              <p>
                Inspect the source, make focused edits, and keep earlier work when a proposal is not
                right.
              </p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <h3>Preview what is supported</h3>
              <p>
                Static project previews are available. React package execution and Python servers
                need an approved local runtime.
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="forge-showcase-band" aria-labelledby="forge-workspace-title">
        <div className="forge-showcase-copy">
          <p className="forge-eyebrow">THE WORKSPACE</p>
          <h2 id="forge-workspace-title">A conversation beside the work.</h2>
          <p>
            Move between the idea, editable source, and supported preview without giving up the
            files you have already made.
          </p>
          <Link
            className="forge-inline-link"
            to={signedIn ? "/artifacts" : "/login"}
            state={!signedIn ? { from: "/forge" } : undefined}
          >
            {signedIn ? "Open your projects" : "Log in to continue"}{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div
          className="forge-workspace-illustration"
          role="img"
          aria-label="Illustrative FORGE workspace interface preview. It is not a live build or preview."
        >
          <div className="forge-preview-caption">
            <MonitorPlay size={14} aria-hidden="true" /> WORKSPACE INTERFACE PREVIEW
          </div>
          <div className="forge-preview-window">
            <div className="forge-preview-topbar">
              <span />
              <span />
              <span />
              <b>FORGE · Project workspace</b>
            </div>
            <div className="forge-preview-content">
              <aside className="forge-preview-files">
                <small>PROJECT FILES</small>
                <span>
                  <Layers3 size={13} /> pages
                </span>
                <span className="is-active">
                  <FileCode2 size={13} /> index
                </span>
                <span>
                  <Code2 size={13} /> styles
                </span>
              </aside>
              <div className="forge-preview-editor">
                <small>SOURCE · index</small>
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="forge-preview-canvas">
                <small>STATIC PREVIEW</small>
                <div className="forge-canvas-art">
                  <span>MAKE SOMETHING</span>
                  <b>worth sharing.</b>
                  <i />
                </div>
              </div>
            </div>
          </div>
          <p className="forge-preview-disclaimer">
            Illustrative interface only. No simulated build output or live project is shown.
          </p>
        </div>
      </section>

      <section className="forge-section forge-use-cases" aria-labelledby="forge-use-title">
        <SectionTitle
          eyebrow="A FLEXIBLE STARTING POINT"
          title="Different ideas. One thoughtful workspace."
        />
        <div className="forge-use-grid" id="forge-use-title">
          <div>
            <BookOpen size={19} aria-hidden="true" />
            <h3>Stories and portfolios</h3>
            <p>Organize pages around work, a practice, or a point of view.</p>
          </div>
          <div>
            <Workflow size={19} aria-hidden="true" />
            <h3>Tools and dashboards</h3>
            <p>Sketch an interface with clear states and practical interactions.</p>
          </div>
          <div>
            <MousePointer2 size={19} aria-hidden="true" />
            <h3>Small web experiences</h3>
            <p>Build a focused page, event, or concept that can grow over time.</p>
          </div>
        </div>
      </section>

      <section className="forge-commercial-band">
        <article className="forge-commercial" id="pricing">
          <p className="forge-eyebrow">PLANS</p>
          <h2>Start free. Find the plan that fits.</h2>
          <p>Current plan details and verified prices live on the existing FORGE pricing page.</p>
          <Link className="forge-button forge-button-secondary" to="/forge/pricing">
            View current plans <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </article>
      </section>

      <section className="forge-download-band" id="download">
        <span className="forge-download-icon">
          <Smartphone size={25} aria-hidden="true" />
        </span>
        <div>
          <p className="forge-eyebrow">VELORI ON YOUR DEVICE</p>
          <h2>Bring your community with you.</h2>
          <p>
            VELORI can be installed from supported mobile browsers when an install option is
            available. There is no app-store listing linked from this page.
          </p>
        </div>
        <Link className="forge-button forge-button-secondary" to="/help">
          Installation help <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </section>

      <section className="forge-section forge-faq" id="faq">
        <SectionTitle eyebrow="GOOD TO KNOW" title="Questions, answered." />
        <div className="forge-faq-list">
          {faqs.map((item) => (
            <details key={item.question}>
              <summary>
                {item.question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="forge-final-cta">
        <p className="forge-eyebrow">A FIRST STEP IS ENOUGH</p>
        <h2>Your next idea starts here.</h2>
        <p>Tell FORGE what you want to create. Your source stays yours to inspect and keep.</p>
        <a className="forge-button forge-button-primary" href="#composer">
          Start with FORGE AI <ArrowUp size={16} aria-hidden="true" />
        </a>
      </section>

      <footer className="forge-footer">
        <Link className="forge-brand forge-footer-brand" to="/home" aria-label="VELORI home">
          <img src={veloriLogo} alt="VELORI" />
          <span className="forge-brand-divider" aria-hidden="true" />
          <span className="forge-brand-product">FORGE AI</span>
        </Link>
        <nav aria-label="Footer navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <Link to="/forge/pricing">Plans</Link>
          <Link to="/help">Help</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </nav>
        <small>© 2026 VELORYZ Studio. VELORI is a community for everyone.</small>
      </footer>
    </main>
  );
}
