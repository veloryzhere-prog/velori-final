import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Eye,
  Image as ImageIcon,
  Magnet,
  Menu,
  MoreHorizontal,
  Music2,
  Palette,
  PanelRightOpen,
  Pencil,
  Redo2,
  Share2,
  Smile,
  Sparkles,
  SquareDashed,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import "@/styles/tokens.css";
import "@/styles/post-studio.css";

export type StudioTab = "tools" | "features" | "media" | "templates" | "brand";
export type StudioSelectedElement = "text" | "image" | "clip" | "sticker" | "shape" | null;
export type StudioSaveStatus = "saved" | "saving" | "unsaved";

export interface StudioShellProps {
  children: ReactNode;
  style?: CSSProperties;
  projectName: string;
  selectedElement: StudioSelectedElement;
  saveStatus: StudioSaveStatus;
  zoom?: number;
  leftPanelContent?: Partial<Record<StudioTab, ReactNode>>;
  rightPanelContent?: ReactNode;
  onBack?: () => void;
  onPreview?: () => void;
  onPublish?: () => void;
  onSave?: () => void;
  onRename?: (name: string) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onMobileToolSelect?: (toolName: string) => void;
  onSnapChange?: (enabled: boolean) => void;
  onSafeZoneChange?: (enabled: boolean) => void;
  onZoomReset?: () => void;
}

const tabs: {
  id: "tools" | "features";
  label: string;
  description: string;
  Icon: typeof Sparkles;
}[] = [
  { id: "tools", label: "Tools", description: "Edit your post", Icon: Sparkles },
  {
    id: "features",
    label: "Features",
    description: "Media, templates, and brand kit",
    Icon: MoreHorizontal,
  },
];

const featureTabs: {
  id: Exclude<StudioTab, "tools" | "features">;
  label: string;
  Icon: typeof Sparkles;
}[] = [
  { id: "media", label: "Media", Icon: ImageIcon },
  { id: "templates", label: "Templates", Icon: Clapperboard },
  { id: "brand", label: "Brand kit", Icon: Palette },
];

function ContextPlaceholder({ title }: { title: string }) {
  return (
    <section className="studio-context-placeholder">
      <h2>{title}</h2>
      <p>Select an item on the canvas to edit its properties.</p>
    </section>
  );
}

function ContextPanel({ selectedElement }: { selectedElement: StudioSelectedElement }) {
  switch (selectedElement) {
    case "text":
      return <ContextPlaceholder title="Text properties" />;
    case "clip":
      return <ContextPlaceholder title="Clip properties" />;
    case "sticker":
      return <ContextPlaceholder title="Sticker properties" />;
    case "image":
      return <ContextPlaceholder title="Image properties" />;
    case "shape":
      return <ContextPlaceholder title="Shape properties" />;
    default:
      return <ContextPlaceholder title="Inspector" />;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export default function StudioShell({
  children,
  style,
  projectName,
  selectedElement,
  saveStatus,
  zoom,
  leftPanelContent,
  rightPanelContent,
  onBack,
  onPreview,
  onPublish,
  onSave,
  onRename,
  onDuplicate,
  onDelete,
  onShare,
  onUndo,
  onRedo,
  onMobileToolSelect,
  onSnapChange,
  onSafeZoneChange,
  onZoomReset,
}: StudioShellProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>("tools");
  const [activeFeature, setActiveFeature] =
    useState<Exclude<StudioTab, "tools" | "features">>("media");
  const [isCompactLayout, setIsCompactLayout] = useState(
    () => window.matchMedia("(max-width: 900px)").matches,
  );
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const [helpOpen, setHelpOpen] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [safeZoneEnabled, setSafeZoneEnabled] = useState(false);
  const [mobileAction, setMobileAction] = useState("tools");

  useEffect(() => setDraftName(projectName), [projectName]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const updateLayout = () => setIsCompactLayout(mediaQuery.matches);
    mediaQuery.addEventListener("change", updateLayout);
    return () => mediaQuery.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    if (!helpOpen && !projectMenuOpen && !inspectorOpen && !mobilePanelOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setHelpOpen(false);
      setProjectMenuOpen(false);
      setInspectorOpen(false);
      setMobilePanelOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen, projectMenuOpen, inspectorOpen, mobilePanelOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier) return;
      const key = event.key.toLowerCase();
      if (key === "s" && onSave) {
        event.preventDefault();
        onSave();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (key === "z" && event.shiftKey && onRedo) {
        event.preventDefault();
        onRedo();
      } else if (key === "z" && onUndo) {
        event.preventDefault();
        onUndo();
      } else if (key === "enter" && onPreview) {
        event.preventDefault();
        onPreview();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSave, onUndo, onRedo, onPreview]);

  const commitRename = () => {
    const nextName = draftName.trim();
    if (nextName) onRename?.(nextName);
    else setDraftName(projectName);
    setRenaming(false);
  };

  const saveStatusText = {
    saved: "All changes saved",
    saving: "Saving changes…",
    unsaved: "Unsaved changes",
  }[saveStatus];

  return (
    <div
      className="studio-shell studio-shell--post"
      data-design="editorial-2026"
      data-save-status={saveStatus}
      style={style}
    >
      <header className="studio-topbar">
        <div className="studio-topbar-leading">
          <button
            className="studio-icon-button studio-mobile-menu"
            type="button"
            aria-label="Open creation tools"
            aria-expanded={mobilePanelOpen}
            onClick={() => setMobilePanelOpen(true)}
          >
            <Menu size={19} />
          </button>
          <button
            className="studio-icon-button studio-back-button"
            type="button"
            aria-label="Back"
            onClick={onBack}
            disabled={!onBack}
          >
            <ArrowLeft size={19} />
          </button>
          <span className="studio-brand-mark" aria-label="VELORI">
            V
          </span>
          <div className="studio-project-wrap">
            <span className="studio-topbar-kicker">VELORI / CREATE POST</span>
            {renaming ? (
              <input
                autoFocus
                className="studio-rename-input"
                aria-label="Post title"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitRename();
                  if (event.key === "Escape") {
                    setDraftName(projectName);
                    setRenaming(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="studio-project-trigger"
                aria-expanded={projectMenuOpen}
                aria-haspopup="menu"
                onClick={() => setProjectMenuOpen((open) => !open)}
              >
                <span className="studio-project-name">{projectName || "New post"}</span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
            )}
            {projectMenuOpen && (
              <div className="studio-project-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  disabled={!onRename}
                  onClick={() => {
                    setProjectMenuOpen(false);
                    setRenaming(true);
                  }}
                >
                  <Pencil size={15} /> Rename post
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!onDuplicate}
                  onClick={() => {
                    setProjectMenuOpen(false);
                    onDuplicate?.();
                  }}
                >
                  <Clapperboard size={15} /> Duplicate post
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!onShare}
                  onClick={() => {
                    setProjectMenuOpen(false);
                    onShare?.();
                  }}
                >
                  <Share2 size={15} /> Share draft
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  disabled={!onDelete}
                  onClick={() => {
                    setProjectMenuOpen(false);
                    onDelete?.();
                  }}
                >
                  <X size={15} /> Delete draft
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          className="studio-save-status"
          data-status={saveStatus}
          role="status"
          aria-live="polite"
        >
          <span className="studio-save-dot" aria-hidden="true" />
          <span>{saveStatusText}</span>
          {saveStatus === "saved" && <Check size={13} aria-hidden="true" />}
        </div>

        <div className="studio-topbar-actions">
          <button
            type="button"
            className={`studio-icon-button studio-inspector-toggle${inspectorOpen ? " is-active" : ""}`}
            aria-label={inspectorOpen ? "Close inspector" : "Open inspector"}
            aria-pressed={inspectorOpen}
            onClick={() => setInspectorOpen((open) => !open)}
          >
            <PanelRightOpen size={18} />
          </button>
          <button
            type="button"
            className="studio-preview-button"
            onClick={onPreview}
            disabled={!onPreview}
          >
            <Eye size={16} /> <span>Preview</span>
          </button>
          <button
            type="button"
            className="studio-publish-button"
            onClick={onPublish}
            disabled={!onPublish || saveStatus === "saving"}
          >
            Publish post <ChevronRight size={16} />
          </button>
        </div>
      </header>

      <div
        className={`studio-body${leftCollapsed ? " is-left-collapsed" : ""}${inspectorOpen ? " is-inspector-open" : ""}`}
      >
        {mobilePanelOpen && (
          <button
            type="button"
            className="studio-mobile-scrim"
            aria-label="Close creation tools"
            onClick={() => setMobilePanelOpen(false)}
          />
        )}

        <aside
          className={`studio-left-panel${leftCollapsed ? " is-collapsed" : ""}${mobilePanelOpen ? " is-mobile-open" : ""}`}
          aria-label="Creation tools"
          aria-hidden={isCompactLayout && !mobilePanelOpen}
        >
          <div className="studio-panel-header">
            <div>
              <span className="studio-panel-eyebrow">CREATE</span>
              <h2 className="studio-panel-title">Build your post</h2>
            </div>
            <button
              type="button"
              className="studio-icon-button studio-desktop-collapse"
              aria-label={leftCollapsed ? "Expand creation tools" : "Collapse creation tools"}
              onClick={() => setLeftCollapsed((collapsed) => !collapsed)}
            >
              {leftCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            </button>
            <button
              type="button"
              className="studio-icon-button studio-mobile-close"
              aria-label="Close creation tools"
              onClick={() => setMobilePanelOpen(false)}
            >
              <X size={17} />
            </button>
          </div>

          <nav className="studio-left-tabs" aria-label="Creation panels" role="tablist">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className="studio-tab"
                role="tab"
                aria-label={label}
                aria-selected={activeTab === id}
                aria-controls="studio-left-panel-content"
                id={`studio-tab-${id}`}
                onClick={() => {
                  setActiveTab(id);
                  if (window.matchMedia("(max-width: 900px)").matches) setMobilePanelOpen(true);
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="studio-tab-label">{label}</span>
              </button>
            ))}
          </nav>

          <div id="studio-left-panel-content" className="studio-left-content">
            {activeTab === "tools" ? (
              <>
                <p className="studio-active-panel-description">
                  {tabs.find((tab) => tab.id === activeTab)?.description}
                </p>
                <div role="tabpanel" aria-labelledby="studio-tab-tools" aria-label="Tools panel">
                  {leftPanelContent?.tools ?? (
                    <div className="studio-left-content-empty">Choose a tool to get started.</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="studio-active-panel-description">
                  {tabs.find((tab) => tab.id === activeTab)?.description}
                </p>
                <nav className="studio-feature-tabs" role="tablist" aria-label="Post features">
                  {featureTabs.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={activeFeature === id}
                      aria-controls="studio-feature-content"
                      id={`studio-feature-${id}`}
                      onClick={() => setActiveFeature(id)}
                    >
                      <Icon size={15} aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </nav>
                <div
                  id="studio-feature-content"
                  role="tabpanel"
                  aria-labelledby={`studio-feature-${activeFeature}`}
                  aria-label={`${featureTabs.find((feature) => feature.id === activeFeature)?.label} feature`}
                >
                  {leftPanelContent?.[activeFeature] ?? (
                    <div className="studio-left-content-empty">No options are available.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        <main className="studio-center-area" aria-label="Post editor workspace">
          {children}
        </main>

        <aside
          className={`studio-right-panel${inspectorOpen ? " is-open" : ""}`}
          aria-label={selectedElement ? `${selectedElement} properties` : "Preview inspector"}
          aria-hidden={!inspectorOpen}
        >
          <div className="studio-panel-header studio-inspector-header">
            <div>
              <span className="studio-panel-eyebrow">INSPECTOR</span>
              <h2 className="studio-panel-title">
                {selectedElement
                  ? `${selectedElement[0].toUpperCase()}${selectedElement.slice(1)} properties`
                  : "Preview"}
              </h2>
            </div>
            <button
              type="button"
              className="studio-icon-button"
              aria-label="Close inspector"
              onClick={() => setInspectorOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <div className="studio-right-content">
            {rightPanelContent ?? <ContextPanel selectedElement={selectedElement} />}
          </div>
        </aside>

        {inspectorOpen && (
          <button
            type="button"
            className="studio-inspector-scrim"
            aria-label="Close inspector"
            onClick={() => setInspectorOpen(false)}
          />
        )}
      </div>

      <nav className="studio-mobile-navigation" aria-label="Post creation tools">
        {[
          { id: "tools", label: "Tools", Icon: Sparkles },
          { id: "features", label: "Features", Icon: MoreHorizontal },
          { id: "text", label: "Text", Icon: Type },
          { id: "stickers", label: "Stickers", Icon: Smile },
          { id: "music", label: "Music", Icon: Music2 },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={mobileAction === id}
            className="studio-mobile-navigation-item"
            onClick={() => {
              setMobileAction(id);
              if (id === "features") {
                setActiveTab("features");
                setMobilePanelOpen(true);
              } else {
                setActiveTab("tools");
                setMobilePanelOpen(id === "tools" || id === "music");
              }
              if (id === "text") {
                setInspectorOpen(false);
                onMobileToolSelect?.("Text");
              }
              if (id === "stickers") {
                setInspectorOpen(false);
                onMobileToolSelect?.("Sticker");
              }
              if (id === "music") onMobileToolSelect?.("Music");
            }}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <footer className="studio-bottombar">
        <div className="studio-toolbar-group studio-bottom-leading">
          <button
            type="button"
            className="studio-quiet-button"
            aria-label="Reset zoom to fit"
            onClick={onZoomReset}
          >
            <span className="studio-zoom-indicator">
              {zoom === undefined ? "Fit" : `${Math.round(zoom * 100)}%`}
            </span>
            Reset view
          </button>
        </div>
        <div className="studio-toolbar-group studio-bottom-center">
          <button
            type="button"
            className="studio-icon-button"
            aria-label="Undo"
            onClick={onUndo}
            disabled={!onUndo}
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            className="studio-icon-button"
            aria-label="Redo"
            onClick={onRedo}
            disabled={!onRedo}
          >
            <Redo2 size={17} />
          </button>
          <span className="studio-toolbar-separator" aria-hidden="true" />
          <button
            type="button"
            className={`studio-icon-button studio-toggle${snapEnabled ? " is-active" : ""}`}
            aria-label="Toggle snapping"
            aria-pressed={snapEnabled}
            onClick={() => {
              const next = !snapEnabled;
              setSnapEnabled(next);
              onSnapChange?.(next);
            }}
          >
            <Magnet size={17} />
          </button>
          <button
            type="button"
            className={`studio-icon-button studio-toggle${safeZoneEnabled ? " is-active" : ""}`}
            aria-label="Toggle safe zones"
            aria-pressed={safeZoneEnabled}
            onClick={() => {
              const next = !safeZoneEnabled;
              setSafeZoneEnabled(next);
              onSafeZoneChange?.(next);
            }}
          >
            <SquareDashed size={17} />
          </button>
        </div>
        <div className="studio-toolbar-group studio-bottom-trailing">
          <span className="studio-footer-hint">Select media · write a caption · publish</span>
          <button type="button" className="studio-quiet-button" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={16} /> Help
          </button>
        </div>
      </footer>

      {helpOpen && (
        <div
          className="studio-help-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false);
          }}
        >
          <section
            className="studio-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-help-title"
          >
            <header>
              <div>
                <span className="studio-panel-eyebrow">QUICK REFERENCE</span>
                <h2 id="studio-help-title">Keyboard shortcuts</h2>
              </div>
              <button
                type="button"
                className="studio-icon-button"
                aria-label="Close help"
                onClick={() => setHelpOpen(false)}
              >
                <X size={17} />
              </button>
            </header>
            <dl className="studio-shortcut-list">
              <dt>Undo</dt>
              <dd>
                <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd>
              </dd>
              <dt>Redo</dt>
              <dd>
                <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>
              </dd>
              <dt>Save</dt>
              <dd>
                <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>S</kbd>
              </dd>
              <dt>Close panel</dt>
              <dd>
                <kbd>Esc</kbd>
              </dd>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
