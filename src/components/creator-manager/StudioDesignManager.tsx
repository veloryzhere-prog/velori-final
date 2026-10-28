import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, RotateCcw, Save } from "lucide-react";
import { adminMotionCms, adminPublishMotion, adminSaveMotionDraft } from "../../lib/admin-api";
import {
  DEFAULT_MOTION_CONFIG,
  normalizeMotionConfig,
  type MotionConfig,
} from "../../../supabase/functions/_shared/motion-config.mjs";
import { ConsoleScreen, useScreenReauth } from "../../app/admin-console/frame";
import { usePermission } from "../../app/admin-console/session";
import { Notice, useGuardedAction, useResource } from "../../app/admin-console/widgets";
import type { StudioTarget } from "./CreatorManager.types";

const COLOR_KEYS = [
  ["primary", "Primary pink"],
  ["accent", "Electric blue"],
  ["background", "Editor background"],
  ["surface", "Panel surface"],
  ["text", "Primary text"],
] as const;
const PREVIEW_ROUTES: Record<StudioTarget, string> = {
  story: "/stories/create",
  reel: "/reels/create",
  post: "/create",
};

function StudioDesignManagerBody({
  studio,
  onOpenSource,
}: {
  studio: StudioTarget;
  onOpenSource: (target: StudioTarget) => void;
}) {
  const resource = useResource(() => adminMotionCms(), []);
  const canWrite = usePermission("motion.write");
  const canPublish = usePermission("motion.publish");
  const reauth = useScreenReauth();
  const { busy, guarded } = useGuardedAction(reauth);
  const [config, setConfig] = useState<MotionConfig>(DEFAULT_MOTION_CONFIG);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [previewSize, setPreviewSize] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [frameKey, setFrameKey] = useState(0);
  const iframe = useRef<HTMLIFrameElement>(null);
  const theme = config.creatorStudio.themes[studio];

  useEffect(() => {
    if (!resource.data) return;
    try {
      setConfig(normalizeMotionConfig(resource.data.draft));
    } catch {
      setError("The saved visual configuration could not be read.");
    }
  }, [resource.data]);

  const previewCss = useMemo(
    () => `
    :root{--creator-primary:${theme.primary};--creator-accent:${theme.accent};--creator-background:${theme.background};--creator-surface:${theme.surface};--creator-text:${theme.text};--velo-primary:${theme.primary};--brand-pink:${theme.primary};--brand-blue:${theme.accent};--background-primary:${theme.background};--background-secondary:${theme.background};--surface-primary:${theme.surface};--surface-elevated:${theme.surface};--text-primary:${theme.text};}
  `,
    [theme],
  );

  const applyPreview = useCallback(() => {
    try {
      const document = iframe.current?.contentDocument;
      if (!document) return;
      let style = document.getElementById(
        "creator-manager-preview-theme",
      ) as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement("style");
        style.id = "creator-manager-preview-theme";
        document.head.append(style);
      }
      style.textContent = previewCss;
    } catch {
      setError("The actual studio preview is not available in this browser session.");
    }
  }, [previewCss]);

  useEffect(() => {
    applyPreview();
  }, [applyPreview, frameKey]);

  function updateColor(key: (typeof COLOR_KEYS)[number][0], value: string) {
    setConfig((current) => ({
      ...current,
      creatorStudio: {
        ...current.creatorStudio,
        themes: {
          ...current.creatorStudio.themes,
          [studio]: { ...current.creatorStudio.themes[studio], [key]: value },
        },
      },
    }));
    setError("");
    setStatus("");
  }

  async function save(publish: boolean) {
    setError("");
    setStatus("");
    if (publish && !summary.trim()) {
      setError("Add a change summary before publishing the shared Motion CMS version.");
      return;
    }
    try {
      const normalized = normalizeMotionConfig(config);
      await guarded(async () => {
        await adminSaveMotionDraft({
          config: normalized as unknown as Record<string, unknown>,
          summary: summary.trim() || `Updated ${studio} studio appearance`,
        });
        if (publish) await adminPublishMotion(summary.trim());
      });
      setConfig(normalized);
      setSummary("");
      setStatus(
        publish
          ? "Published through Motion CMS. The application receives this version through its normal runtime refresh."
          : "Draft saved. It is not live until published.",
      );
      resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Studio design could not be saved.");
    }
  }

  return (
    <div className="cm-design-manager">
      <div className="cm-studio-modebar">
        <div className="cm-mode-tabs">
          <span className="cm-mode-chip active">Visual Design</span>
          <button className="cm-button" onClick={() => onOpenSource(studio)}>
            <ArrowUpRight size={14} /> Open Full Source Editor
          </button>
        </div>
        <div className="cm-workbench-actions">
          <span className="cm-muted">Motion CMS v{resource.data?.publishedVersion ?? 0}</span>
          <button
            className="cm-button"
            disabled={!canWrite || busy}
            onClick={() => void save(false)}
          >
            <Save size={14} /> Save Draft
          </button>
          <button
            className="cm-button cm-button-primary"
            disabled={!canPublish || busy}
            onClick={() => void save(true)}
          >
            <Check size={14} /> Publish
          </button>
        </div>
      </div>
      {resource.loading ? <Notice>Loading versioned studio design…</Notice> : null}
      {resource.error || error ? <Notice tone="error">{error || resource.error}</Notice> : null}
      {status ? <Notice tone="success">{status}</Notice> : null}
      <div className="cm-design-layout">
        <section className="cm-panel">
          <div className="cm-panel-header">
            <div>
              <h2>{studio[0].toUpperCase() + studio.slice(1)} appearance</h2>
              <p>
                These five published theme values are currently consumed by the real studio
                components.
              </p>
            </div>
            <button
              className="cm-button"
              onClick={() => {
                setConfig(normalizeMotionConfig(resource.data?.draft ?? DEFAULT_MOTION_CONFIG));
                setStatus("");
              }}
            >
              <RotateCcw size={14} /> Reset to saved draft
            </button>
          </div>
          <div className="cm-panel-body">
            <div className="cm-design-colors">
              {COLOR_KEYS.map(([key, label]) => (
                <label className="cm-color-control" key={key}>
                  <span>{label}</span>
                  <input
                    type="color"
                    value={theme[key]}
                    disabled={!canWrite}
                    onChange={(event) => updateColor(key, event.target.value)}
                    aria-label={label}
                  />
                </label>
              ))}
            </div>
            <label className="cm-field cm-field-full">
              <span className="cm-label">Change summary</span>
              <input
                className="cm-input"
                value={summary}
                maxLength={300}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Required before publishing"
              />
            </label>
            <p className="cm-muted">
              Layout, typography, motion, and tool behavior remain controlled by the actual studio
              implementations. Open Full Source Editor to review and change trusted TSX, JavaScript,
              and CSS files.
            </p>
          </div>
        </section>
        <section className="cm-design-preview" aria-label="Live studio preview">
          <div className="cm-preview-toolbar">
            <strong>Actual {studio[0].toUpperCase() + studio.slice(1)} Studio</strong>
            <select
              className="cm-select"
              value={previewSize}
              onChange={(event) => setPreviewSize(event.target.value as typeof previewSize)}
            >
              <option value="desktop">Desktop</option>
              <option value="tablet">Tablet</option>
              <option value="mobile">Mobile</option>
            </select>
            <button className="cm-button" onClick={() => setFrameKey((value) => value + 1)}>
              Reload
            </button>
          </div>
          <iframe
            key={`${studio}-${frameKey}`}
            ref={iframe}
            className={`cm-preview-device${previewSize === "tablet" ? " is-tablet" : previewSize === "mobile" ? " is-mobile" : ""}`}
            src={PREVIEW_ROUTES[studio]}
            title={`Actual ${studio} studio preview`}
            onLoad={() => {
              requestAnimationFrame(applyPreview);
            }}
          />
        </section>
      </div>
    </div>
  );
}

export function StudioDesignManager(props: {
  studio: StudioTarget;
  onOpenSource: (target: StudioTarget) => void;
}) {
  return (
    <ConsoleScreen anyOf={["motion.read"]}>
      <StudioDesignManagerBody {...props} />
    </ConsoleScreen>
  );
}
