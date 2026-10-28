import { Copy, Play, Plus, Trash2 } from "lucide-react";
import type {
  StoryTextAnimation,
  StoryTextOverlay,
  StoryTextPosition,
} from "../../lib/story-editor/types";
import {
  STORY_TEXT_POSITION_PRESETS,
  STORY_TEXT_STYLES,
} from "../../lib/story-editor/text-tools.mjs";

interface TextToolsProps {
  overlays: StoryTextOverlay[];
  selectedId: string | null;
  lockedColors?: boolean;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<StoryTextOverlay>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onPreviewAnimation: () => void;
}

const fonts = ["DM Sans", "Manrope", "Playfair Display", "Georgia", "Arial", "monospace"];
const animations: { id: StoryTextAnimation; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade-in", label: "Fade In" },
  { id: "fade-out", label: "Fade Out" },
  { id: "fade-in-out", label: "Fade In and Out" },
  { id: "slide-up", label: "Slide Up" },
  { id: "slide-down", label: "Slide Down" },
  { id: "slide-left", label: "Slide Left" },
  { id: "slide-right", label: "Slide Right" },
  { id: "zoom-in", label: "Zoom In" },
  { id: "zoom-out", label: "Zoom Out" },
  { id: "pop", label: "Pop" },
  { id: "bounce", label: "Bounce" },
  { id: "pulse", label: "Pulse" },
  { id: "rotate-in", label: "Rotate In" },
  { id: "float", label: "Float" },
  { id: "typewriter", label: "Typewriter" },
];

export function TextTools({
  overlays,
  selectedId,
  lockedColors = false,
  onAdd,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onPreviewAnimation,
}: TextToolsProps) {
  const selected = overlays.find((overlay) => overlay.id === selectedId) ?? null;

  return (
    <section aria-label="Text and animation tools" className="story-editor-text-tools">
      <div className="story-editor-section-heading">
        <div>
          <span className="story-editor-eyebrow">TEXT & CAPTIONS</span>
          <h2>
            Text overlays <span>{overlays.length} / 20</span>
          </h2>
        </div>
        <button
          aria-label="Add text overlay"
          className="story-editor-icon-button"
          disabled={overlays.length >= 20}
          onClick={() => onAdd()}
          type="button"
        >
          <Plus size={16} />
        </button>
      </div>

      {overlays.length ? (
        <div className="story-editor-overlay-tabs" role="tablist" aria-label="Text overlays">
          {overlays.map((overlay, index) => (
            <button
              aria-selected={overlay.id === selected?.id}
              className="story-editor-overlay-tab"
              key={overlay.id}
              onClick={() => onSelect(overlay.id)}
              role="tab"
              type="button"
            >
              {overlay.content.trim().slice(0, 16) || `Text ${index + 1}`}
            </button>
          ))}
        </div>
      ) : (
        <p className="story-editor-tool-hint">
          Add a text overlay, then style and position it on your story.
        </p>
      )}

      {selected ? (
        <>
          <label className="story-editor-textarea-label">
            <span>Text</span>
            <textarea
              maxLength={500}
              onChange={(event) => onUpdate(selected.id, { content: event.target.value })}
              placeholder="Write something for your story…"
              rows={3}
              value={selected.content}
            />
          </label>

          <div className="story-editor-text-preset-grid" aria-label="24 text styles">
            {STORY_TEXT_STYLES.map((style) => (
              <button
                aria-pressed={selected.styleId === style.id}
                className="story-editor-text-preset"
                key={style.id}
                onClick={() =>
                  onUpdate(selected.id, {
                    styleId: style.id,
                    fontFamily: style.fontFamily,
                    fontSize: style.fontSize,
                    fontWeight: style.fontWeight,
                    color: style.color,
                    align: style.align,
                    letterSpacing: style.letterSpacing,
                    lineHeight: style.lineHeight,
                    italic: style.italic,
                    uppercase: style.uppercase,
                    background: style.background,
                    stroke: style.stroke,
                    shadow: style.shadow,
                  })
                }
                style={{
                  background: style.background ?? "linear-gradient(140deg,#252a43,#51456e)",
                  color: style.color === "transparent" ? "#fff" : style.color,
                  fontFamily: style.fontFamily,
                  fontSize: "0.8rem",
                  fontStyle: style.italic ? "italic" : "normal",
                  fontWeight: style.fontWeight,
                  textShadow: style.shadow ?? undefined,
                  WebkitTextStroke: style.stroke ? `0.5px ${style.stroke}` : undefined,
                }}
                type="button"
              >
                Aa
                <small>{style.name}</small>
              </button>
            ))}
          </div>

          <details className="story-editor-tool-section" open>
            <summary>Font</summary>
            <div className="story-editor-text-control-grid">
              <label className="story-editor-select">
                <span>Font family</span>
                <select
                  onChange={(event) =>
                    onUpdate(selected.id, { fontFamily: event.target.value, styleId: "custom" })
                  }
                  value={selected.fontFamily}
                >
                  {fonts.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
              </label>
              <label className="story-editor-select">
                <span>Weight</span>
                <select
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      fontWeight: Number(event.target.value),
                      styleId: "custom",
                    })
                  }
                  value={selected.fontWeight}
                >
                  {[400, 500, 600, 650, 700, 800, 850, 900].map((weight) => (
                    <option key={weight} value={weight}>
                      {weight}
                    </option>
                  ))}
                </select>
              </label>{" "}
              <label className="story-editor-number-field">
                <span>Text opacity</span>
                <input
                  max={1}
                  min={0.1}
                  step={0.05}
                  type="number"
                  value={selected.opacity ?? 1}
                  onChange={(event) =>
                    onUpdate(selected.id, { opacity: Number(event.target.value) })
                  }
                />
              </label>
              <label className="story-editor-number-field">
                <span>Size · px</span>
                <input
                  max={160}
                  min={12}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      fontSize: Math.min(160, Math.max(12, Number(event.target.value))),
                      styleId: "custom",
                    })
                  }
                  type="number"
                  value={selected.fontSize}
                />
              </label>
              <label className="story-editor-color-input">
                <span>Color</span>
                <input
                  disabled={lockedColors}
                  onChange={(event) =>
                    onUpdate(selected.id, { color: event.target.value, styleId: "custom" })
                  }
                  type="color"
                  value={/^#[0-9a-f]{6}$/i.test(selected.color) ? selected.color : "#ffffff"}
                />
              </label>
              <label className="story-editor-select">
                <div className="story-editor-color-palette" aria-label="Quick text colors">
                  {[
                    ["VELORI pink", "#f05a9d"],
                    ["VELORI blue", "#3478f6"],
                    ["Black", "#111111"],
                    ["White", "#ffffff"],
                  ].map(([label, color]) => (
                    <button
                      key={color}
                      aria-label={label}
                      aria-pressed={selected.color === color}
                      onClick={() => onUpdate(selected.id, { color, styleId: "custom" })}
                      style={{ background: color }}
                      type="button"
                    />
                  ))}
                </div>{" "}
                <span>Alignment</span>
                <select
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      align: event.target.value as StoryTextOverlay["align"],
                      styleId: "custom",
                    })
                  }
                  value={selected.align}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label className="story-editor-number-field">
                <span>Letter spacing</span>
                <input
                  disabled={lockedColors}
                  max={12}
                  min={-4}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      letterSpacing: Number(event.target.value),
                      styleId: "custom",
                    })
                  }
                  step={0.5}
                  type="number"
                  value={selected.letterSpacing}
                />
              </label>
              <label className="story-editor-number-field">
                <span>Line height</span>
                <input
                  max={2.5}
                  min={0.8}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      lineHeight: Number(event.target.value),
                      styleId: "custom",
                    })
                  }
                  step={0.05}
                  type="number"
                  value={selected.lineHeight}
                />
              </label>
            </div>
            <div className="story-editor-text-toggle-row">
              <label className="story-editor-check">
                <input
                  checked={selected.italic}
                  onChange={(event) =>
                    onUpdate(selected.id, { italic: event.target.checked, styleId: "custom" })
                  }
                  type="checkbox"
                />
                Italic
              </label>
              <label className="story-editor-check">
                <input
                  checked={selected.uppercase}
                  onChange={(event) =>
                    onUpdate(selected.id, { uppercase: event.target.checked, styleId: "custom" })
                  }
                  type="checkbox"
                />
                Uppercase
              </label>
              <label className="story-editor-check">
                <input
                  checked={selected.autoSize}
                  onChange={(event) => onUpdate(selected.id, { autoSize: event.target.checked })}
                  type="checkbox"
                />
                Auto-fit text
              </label>
              <label className="story-editor-check">
                <input
                  checked={selected.background !== null}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      background: event.target.checked ? "#202235" : null,
                      styleId: "custom",
                    })
                  }
                  type="checkbox"
                />
                Text background
              </label>
              <label className="story-editor-check">
                <input
                  checked={selected.stroke !== null}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      stroke: event.target.checked ? "#ffffff" : null,
                      styleId: "custom",
                    })
                  }
                  type="checkbox"
                />
                Outline
              </label>
              <label className="story-editor-check">
                <input
                  checked={selected.shadow !== null}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      shadow: event.target.checked ? "0 2px 12px rgba(0,0,0,.45)" : null,
                      styleId: "custom",
                    })
                  }
                  type="checkbox"
                />
                Shadow
              </label>
              {selected.background !== null ? (
                <label className="story-editor-color-input">
                  <span>Background color</span>
                  <input
                    disabled={lockedColors}
                    onChange={(event) => onUpdate(selected.id, { background: event.target.value })}
                    type="color"
                    value={
                      /^#[0-9a-f]{6}$/i.test(selected.background) ? selected.background : "#202235"
                    }
                  />
                </label>
              ) : null}{" "}
              {selected.background !== null ? (
                <>
                  <label className="story-editor-number-field">
                    <span>Background opacity</span>
                    <input
                      max={1}
                      min={0.1}
                      step={0.05}
                      type="number"
                      value={selected.backgroundOpacity ?? 1}
                      onChange={(event) =>
                        onUpdate(selected.id, { backgroundOpacity: Number(event.target.value) })
                      }
                    />
                  </label>
                  <label className="story-editor-number-field">
                    <span>Background corner</span>
                    <input
                      max={32}
                      min={0}
                      type="number"
                      value={selected.backgroundRadius ?? 8}
                      onChange={(event) =>
                        onUpdate(selected.id, { backgroundRadius: Number(event.target.value) })
                      }
                    />
                  </label>
                </>
              ) : null}
              {selected.stroke !== null ? (
                <label className="story-editor-color-input">
                  <span>Outline color</span>
                  <input
                    disabled={lockedColors}
                    onChange={(event) => onUpdate(selected.id, { stroke: event.target.value })}
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(selected.stroke) ? selected.stroke : "#ffffff"}
                  />
                </label>
              ) : null}
            </div>
          </details>

          <details className="story-editor-tool-section" open>
            <summary>Animation & timing</summary>
            <div className="story-editor-text-control-grid">
              <label className="story-editor-select">
                <span>Animation</span>
                <select
                  onChange={(event) =>
                    onUpdate(selected.id, { animation: event.target.value as StoryTextAnimation })
                  }
                  value={selected.animation}
                >
                  {animations.map((animation) => (
                    <option key={animation.id} value={animation.id}>
                      {animation.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="story-editor-number-field">
                <span>Start at · seconds</span>
                <input
                  max={14.9}
                  min={0}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      startAt: Math.min(14.9, Math.max(0, Number(event.target.value))),
                    })
                  }
                  step={0.1}
                  type="number"
                  value={selected.startAt}
                />
              </label>
              <label className="story-editor-number-field">
                <span>Duration · seconds</span>
                <input
                  max={3}
                  min={0.1}
                  onChange={(event) =>
                    onUpdate(selected.id, {
                      animationDuration: Math.min(3, Math.max(0.1, Number(event.target.value))),
                    })
                  }
                  step={0.1}
                  type="number"
                  value={selected.animationDuration}
                />
              </label>
            </div>
            <div className="story-editor-text-actions">
              <label className="story-editor-number-field">
                <span>Delay · seconds</span>
                <input
                  max={5}
                  min={0}
                  step={0.1}
                  type="number"
                  value={selected.animationDelay ?? 0}
                  onChange={(event) =>
                    onUpdate(selected.id, { animationDelay: Number(event.target.value) })
                  }
                />
              </label>
              <label className="story-editor-check">
                <input
                  type="checkbox"
                  checked={selected.animationLoop ?? false}
                  onChange={(event) =>
                    onUpdate(selected.id, { animationLoop: event.target.checked })
                  }
                />
                Loop animation
              </label>
              <button onClick={onPreviewAnimation} type="button">
                <Play size={14} /> Preview
              </button>
              <button
                onClick={() =>
                  onUpdate(selected.id, {
                    animation: "none",
                    animationDuration: 0.7,
                    animationDelay: 0,
                    animationLoop: false,
                    startAt: 0,
                  })
                }
                type="button"
              >
                Reset animation
              </button>
            </div>
          </details>

          <details className="story-editor-tool-section" open>
            <summary>Position</summary>
            <label className="story-editor-number-field">
              <span>Rotation · degrees</span>
              <input
                max={180}
                min={-180}
                type="number"
                value={selected.rotation ?? 0}
                onChange={(event) =>
                  onUpdate(selected.id, { rotation: Number(event.target.value) })
                }
              />
            </label>{" "}
            <div className="story-editor-position-grid">
              {STORY_TEXT_POSITION_PRESETS.map((position) => (
                <button
                  aria-pressed={selected.position === position.id}
                  className="story-editor-position-button"
                  key={position.id}
                  onClick={() =>
                    onUpdate(selected.id, {
                      position: position.id as StoryTextPosition,
                      x: position.x,
                      y: position.y,
                      width: position.width,
                      height: position.height,
                      align: position.align,
                    })
                  }
                  type="button"
                >
                  {position.name}
                </button>
              ))}
            </div>
          </details>

          <div className="story-editor-text-actions">
            <span>Text stays within its safe area when auto-fit is on.</span>
            <button
              aria-label="Duplicate text overlay"
              onClick={() => onDuplicate(selected.id)}
              type="button"
            >
              <Copy size={15} />
            </button>
            <button
              aria-label="Delete text overlay"
              className="story-editor-icon-button"
              onClick={() => onDelete(selected.id)}
              type="button"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </>
      ) : (
        <button
          className="story-editor-add-slide"
          disabled={overlays.length >= 20}
          onClick={() => onAdd()}
          type="button"
        >
          <Plus size={17} /> Add text overlay
        </button>
      )}
    </section>
  );
}
