import { StudioHeader } from "../../product/StudioHeader";
import { CreatorDestinations } from "../CreatorDestinations";
import React, { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Camera, Music2, Palette, Pencil, Sticker, Type, type LucideIcon } from "lucide-react";
import "./story-studio.css";

export type StoryStudioTool = "Media" | "Text" | "Stickers" | "Draw" | "Music" | "Background";

const tools: { name: StoryStudioTool; icon: LucideIcon }[] = [
  { name: "Media", icon: Camera },
  { name: "Text", icon: Type },
  { name: "Stickers", icon: Sticker },
  { name: "Draw", icon: Pencil },
  { name: "Music", icon: Music2 },
  { name: "Background", icon: Palette },
];

export interface StoryStudioProps {
  activeTool: StoryStudioTool | null;
  onToolChange: (tool: StoryStudioTool | null) => void;
  preview: ReactNode;
  panel?: ReactNode;
  panelOpen?: boolean;
  panelTitle?: string;
  menuContent?: ReactNode;
  overlay?: ReactNode;
  status?: string;
  error?: string;
  publishing?: boolean;
  readOnly?: boolean;
  style?: CSSProperties;
  theme?: "light" | "dark";
  onBack: () => void;
  onReset: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}

export default function StoryStudio({
  activeTool,
  onToolChange,
  preview,
  panel,
  panelOpen = Boolean(activeTool),
  panelTitle,
  menuContent,
  overlay,
  status,
  error,
  publishing = false,
  readOnly = false,
  style,
  theme = "light",
  onBack,
  onReset,
  onSaveDraft,
  onPublish,
}: StoryStudioProps) {
  const [menu, setMenu] = useState(false);
  const [focusCanvas, setFocusCanvas] = useState(false);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusCanvas(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const previewColumn = useRef<HTMLElement>(null);
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number }>();
  useEffect(() => {
    const element = previewColumn.current;
    if (!element) return;
    const fit = () => {
      const width = Math.max(
        1,
        Math.min(element.clientWidth - 4, (Math.max(80, element.clientHeight - 28) * 9) / 16),
      );
      setPreviewSize({ width, height: (width * 16) / 9 });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    fit();
    return () => observer.disconnect();
  }, []);

  return createPortal(
    <main
      className="story-studio"
      data-focus-canvas={focusCanvas}
      data-theme={theme}
      data-panel-open={panelOpen && Boolean(panel)}
      style={style}
    >
      <StudioHeader
        className="ss-topbar"
        back={
          <button className="ss-back" aria-label="Back to stories" onClick={onBack} type="button">
            &#8249;
          </button>
        }
        title={<strong>Create a story</strong>}
        actions={
          !readOnly ? (
            <div className="ss-top-right">
              <button
                type="button"
                aria-pressed={focusCanvas}
                onClick={() => setFocusCanvas(!focusCanvas)}
              >
                {focusCanvas ? "Back to editing" : "Focus canvas"}
              </button>
              <button onClick={onReset} type="button">
                Reset edits
              </button>
              <button className="ss-save" onClick={onSaveDraft} type="button">
                Save draft
              </button>
            </div>
          ) : null
        }
      />

      {!readOnly && <CreatorDestinations />}
      <div className="ss-workspace">
        <section ref={previewColumn} className="ss-preview-column" aria-label="Story preview">
          <div className="ss-preview" style={previewSize}>
            {preview}
          </div>
          <div className="ss-ratio">Preview &middot; 9:16</div>
        </section>

        {!readOnly ? (
          <aside className="ss-side" aria-label="Story editor tools">
            <nav className="ss-tools" aria-label="Story tools">
              {tools.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  className={activeTool === name ? "active" : ""}
                  aria-pressed={activeTool === name}
                  onClick={() => {
                    onToolChange(activeTool === name ? null : name);
                    setMenu(false);
                  }}
                  type="button"
                >
                  <span className="ss-tool-icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <span>{name}</span>
                </button>
              ))}
            </nav>
            {panelOpen && panel ? (
              <section
                className="ss-panel"
                aria-label={`${panelTitle ?? activeTool ?? "Story"} controls`}
              >
                <div className="ss-panel-title">
                  <strong>{panelTitle ?? activeTool}</strong>
                  <button
                    onClick={() => onToolChange(null)}
                    aria-label="Close tool panel"
                    type="button"
                  >
                    &#215;
                  </button>
                </div>
                {panel}
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>

      {!readOnly ? (
        <footer className="ss-bottom">
          <button className="ss-publish" onClick={onPublish} disabled={publishing} type="button">
            {publishing ? "Publishing\u2026" : "Publish"}
          </button>
          <div className="ss-menu-wrap">
            <button
              className="ss-menu"
              onClick={() => setMenu((open) => !open)}
              aria-expanded={menu}
              type="button"
            >
              &#8226;&#8226;&#8226; &nbsp; Menu
            </button>
            {menu ? (
              <div className="ss-menu-pop" onClick={() => setMenu(false)}>
                {menuContent}
              </div>
            ) : null}
          </div>
        </footer>
      ) : null}
      {error ? (
        <div className="ss-toast ss-toast-error" role="alert">
          {error}
        </div>
      ) : null}
      {status ? (
        <div className="ss-toast" role="status">
          {status}
        </div>
      ) : null}
      {overlay}
    </main>,
    document.body,
  );
}
