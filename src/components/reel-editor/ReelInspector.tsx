import type { ReactNode } from "react";
import {
  REEL_ADJUSTMENT_RANGE,
  REEL_EFFECT_PRESETS,
  REEL_FILTER_PRESETS,
  REEL_TEXT_FONTS,
  REEL_TRANSITION_PRESETS,
  type ReelAspectRatio,
  type ReelProject,
} from "../../lib/reel-editor/types.ts";
import {
  addCaption,
  addSticker,
  addTextOverlay,
  removeAudioClip,
  removeCaption,
  removeSticker,
  removeTextOverlay,
  setAspectRatio,
  setClipPlaybackRate,
  splitClip,
  updateAudioClip,
  updateCaption,
  updateClip,
  updateClipAdjustments,
  updateClipTransform,
  updateSticker,
  updateTextOverlay,
} from "../../lib/reel-editor/timeline.ts";
import type { ReelSelection } from "./types.ts";

export interface ReelInspectorProps {
  project: ReelProject;
  selection: ReelSelection;
  currentTime: number;
  onChange: (updater: ReelProject | ((current: ReelProject) => ReelProject)) => void;
  onSelect: (selection: ReelSelection) => void;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="reel-field">
      <span className="reel-field-label">{label}</span>
      {children}
      {hint ? <span className="reel-field-hint">{hint}</span> : null}
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="reel-field reel-field-slider">
      <span className="reel-field-label">
        {label}
        <span className="reel-field-value">
          {Math.round(value * 100) / 100}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}

const aspectOptions: ReelAspectRatio[] = ["9:16", "1:1", "16:9", "4:5"];

export default function ReelInspector({
  project,
  selection,
  currentTime,
  onChange,
  onSelect,
}: ReelInspectorProps) {
  if (selection.kind === "clip") {
    const clip = project.clips.find((item) => item.id === selection.id);
    if (!clip) {
      return <p className="reel-empty-note">This clip is no longer on the timeline.</p>;
    }
    const asset = project.assets[clip.assetId];
    return (
      <div className="reel-inspector">
        <h3 className="reel-inspector-title">{asset?.name ?? "Clip"}</h3>
        <div className="reel-inspector-actions">
          <button
            type="button"
            className="reel-button"
            onClick={() => {
              const result = splitClip(project, clip.id, currentTime);
              if (result.newClipId) {
                onChange(result.project);
                onSelect({ kind: "clip", id: result.newClipId });
              }
            }}
            disabled={
              currentTime <= clip.startSeconds ||
              currentTime >=
                clip.startSeconds + (clip.sourceOut - clip.sourceIn) / clip.playbackRate
            }
          >
            Split here
          </button>
        </div>
        <Slider
          label="Speed"
          value={clip.playbackRate}
          min={0.25}
          max={4}
          step={0.05}
          suffix="×"
          onChange={(value) => onChange((current) => setClipPlaybackRate(current, clip.id, value))}
        />
        <Slider
          label="Volume"
          value={clip.volume}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) =>
            onChange((current) => updateClip(current, clip.id, { volume: value }))
          }
        />
        <label className="reel-field reel-field-inline">
          <input
            type="checkbox"
            checked={clip.muted}
            onChange={(event) =>
              onChange((current) => updateClip(current, clip.id, { muted: event.target.checked }))
            }
          />
          <span>Mute this clip</span>
        </label>
        <Slider
          label="Fade in"
          value={clip.fadeInSeconds}
          min={0}
          max={5}
          step={0.1}
          suffix="s"
          onChange={(value) =>
            onChange((current) => updateClip(current, clip.id, { fadeInSeconds: value }))
          }
        />
        <Slider
          label="Fade out"
          value={clip.fadeOutSeconds}
          min={0}
          max={5}
          step={0.1}
          suffix="s"
          onChange={(value) =>
            onChange((current) => updateClip(current, clip.id, { fadeOutSeconds: value }))
          }
        />
        <Slider
          label="Scale"
          value={clip.transform.scale}
          min={0.2}
          max={3}
          step={0.01}
          onChange={(value) =>
            onChange((current) => updateClipTransform(current, clip.id, { scale: value }))
          }
        />
        <Slider
          label="Rotation"
          value={clip.transform.rotation}
          min={-180}
          max={180}
          step={1}
          suffix="°"
          onChange={(value) =>
            onChange((current) => updateClipTransform(current, clip.id, { rotation: value }))
          }
        />
        <Slider
          label="Horizontal position"
          value={clip.transform.offsetX}
          min={-1}
          max={1}
          step={0.01}
          onChange={(value) =>
            onChange((current) => updateClipTransform(current, clip.id, { offsetX: value }))
          }
        />
        <Slider
          label="Vertical position"
          value={clip.transform.offsetY}
          min={-1}
          max={1}
          step={0.01}
          onChange={(value) =>
            onChange((current) => updateClipTransform(current, clip.id, { offsetY: value }))
          }
        />
        <Field label="Fit">
          <select
            value={clip.transform.fit}
            onChange={(event) =>
              onChange((current) =>
                updateClipTransform(current, clip.id, {
                  fit: event.target.value as "cover" | "contain",
                }),
              )
            }
          >
            <option value="cover">Fill the frame</option>
            <option value="contain">Fit inside the frame</option>
          </select>
        </Field>
        <label className="reel-field reel-field-inline">
          <input
            type="checkbox"
            checked={clip.transform.flipX}
            onChange={(event) =>
              onChange((current) =>
                updateClipTransform(current, clip.id, { flipX: event.target.checked }),
              )
            }
          />
          <span>Flip horizontally</span>
        </label>
        <label className="reel-field reel-field-inline">
          <input
            type="checkbox"
            checked={clip.transform.flipY}
            onChange={(event) =>
              onChange((current) =>
                updateClipTransform(current, clip.id, { flipY: event.target.checked }),
              )
            }
          />
          <span>Flip vertically</span>
        </label>
        {REEL_EFFECT_PRESETS.map((effect) => (
          <Slider
            key={effect.id}
            label={effect.name}
            value={clip.effects?.[effect.id] ?? 0}
            min={0}
            max={1}
            step={0.05}
            onChange={(value) =>
              onChange((current) =>
                updateClip(current, clip.id, {
                  effects: {
                    ...current.clips.find((item) => item.id === clip.id)?.effects,
                    [effect.id]: value,
                  },
                }),
              )
            }
          />
        ))}
        <Field label="Filter">
          <select
            value={clip.filterId ?? "none"}
            onChange={(event) =>
              onChange((current) =>
                updateClip(current, clip.id, {
                  filterId: event.target.value === "none" ? null : event.target.value,
                }),
              )
            }
          >
            {REEL_FILTER_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </Field>
        <Slider
          label="Brightness"
          value={clip.adjustments.brightness}
          min={REEL_ADJUSTMENT_RANGE.brightness.min}
          max={REEL_ADJUSTMENT_RANGE.brightness.max}
          onChange={(value) =>
            onChange((current) => updateClipAdjustments(current, clip.id, { brightness: value }))
          }
        />
        <Slider
          label="Contrast"
          value={clip.adjustments.contrast}
          min={REEL_ADJUSTMENT_RANGE.contrast.min}
          max={REEL_ADJUSTMENT_RANGE.contrast.max}
          onChange={(value) =>
            onChange((current) => updateClipAdjustments(current, clip.id, { contrast: value }))
          }
        />
        <Slider
          label="Saturation"
          value={clip.adjustments.saturation}
          min={REEL_ADJUSTMENT_RANGE.saturation.min}
          max={REEL_ADJUSTMENT_RANGE.saturation.max}
          onChange={(value) =>
            onChange((current) => updateClipAdjustments(current, clip.id, { saturation: value }))
          }
        />
        <Slider
          label="Blur"
          value={clip.adjustments.blur}
          min={REEL_ADJUSTMENT_RANGE.blur.min}
          max={REEL_ADJUSTMENT_RANGE.blur.max}
          step={0.5}
          suffix="px"
          onChange={(value) =>
            onChange((current) => updateClipAdjustments(current, clip.id, { blur: value }))
          }
        />
        <Slider
          label="Temperature"
          value={clip.adjustments.temperature}
          min={REEL_ADJUSTMENT_RANGE.temperature.min}
          max={REEL_ADJUSTMENT_RANGE.temperature.max}
          onChange={(value) =>
            onChange((current) => updateClipAdjustments(current, clip.id, { temperature: value }))
          }
        />
        <Field label="Transition in">
          <select
            value={clip.transitionIn?.id ?? "none"}
            onChange={(event) => {
              const preset = REEL_TRANSITION_PRESETS.find((item) => item.id === event.target.value);
              onChange((current) =>
                updateClip(current, clip.id, {
                  transitionIn:
                    preset && preset.id !== "none"
                      ? { id: preset.id, durationSeconds: preset.durationSeconds }
                      : null,
                }),
              );
            }}
          >
            {REEL_TRANSITION_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.id === "none" ? "None" : preset.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Transition out">
          <select
            value={clip.transitionOut?.id ?? "none"}
            onChange={(event) => {
              const preset = REEL_TRANSITION_PRESETS.find((item) => item.id === event.target.value);
              onChange((current) =>
                updateClip(current, clip.id, {
                  transitionOut:
                    preset && preset.id !== "none"
                      ? { id: preset.id, durationSeconds: preset.durationSeconds }
                      : null,
                }),
              );
            }}
          >
            {REEL_TRANSITION_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.id === "none" ? "None" : preset.id}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className="reel-button reel-button-danger"
          onClick={() => {
            onChange((current) => ({
              ...current,
              clips: current.clips.filter((item) => item.id !== clip.id),
            }));
            onSelect({ kind: "project", id: null });
          }}
        >
          Delete clip
        </button>
      </div>
    );
  }

  if (selection.kind === "text") {
    const overlay = project.texts.find((item) => item.id === selection.id);
    if (!overlay) return <p className="reel-empty-note">This text layer is no longer available.</p>;
    const reorderText = (direction: 1 | -1) =>
      onChange((current) => {
        const index = current.texts.findIndex((item) => item.id === overlay.id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= current.texts.length) return current;
        const texts = [...current.texts];
        const moved = texts.splice(index, 1)[0];
        if (!moved) return current;
        texts.splice(target, 0, moved);
        return { ...current, texts };
      });
    return (
      <div className="reel-inspector">
        <h3 className="reel-inspector-title">Text</h3>
        <div className="reel-inspector-quickactions">
          <button
            type="button"
            className="reel-icon-button"
            aria-label="Duplicate this text layer"
            onClick={() => {
              const copyId = crypto.randomUUID?.() ?? `${Date.now()}`;
              onChange((current) => {
                const source = current.texts.find((item) => item.id === overlay.id);
                if (!source) return current;
                return {
                  ...current,
                  texts: [
                    ...current.texts,
                    {
                      ...source,
                      id: copyId,
                      x: Math.min(0.94, source.x + 0.04),
                      y: Math.min(0.94, source.y + 0.04),
                    },
                  ],
                };
              });
              onSelect({ kind: "text", id: copyId });
            }}
          >
            ⧉
          </button>
          <button
            type="button"
            className="reel-icon-button"
            aria-pressed={Boolean(overlay.locked)}
            aria-label={overlay.locked ? "Unlock this text layer" : "Lock this text layer"}
            onClick={() =>
              onChange((current) =>
                updateTextOverlay(current, overlay.id, { locked: !overlay.locked }),
              )
            }
          >
            {overlay.locked ? "🔒" : "🔓"}
          </button>
          <button
            type="button"
            className="reel-icon-button"
            aria-label="Bring this text layer forward"
            onClick={() => reorderText(1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="reel-icon-button"
            aria-label="Send this text layer backward"
            onClick={() => reorderText(-1)}
          >
            ↓
          </button>
        </div>
        <Field label="Text">
          <textarea
            rows={3}
            value={overlay.text}
            onChange={(event) =>
              onChange((current) =>
                updateTextOverlay(current, overlay.id, { text: event.target.value }),
              )
            }
          />
        </Field>
        <Field label="Font">
          <select
            value={overlay.fontFamily}
            onChange={(event) =>
              onChange((current) =>
                updateTextOverlay(current, overlay.id, { fontFamily: event.target.value }),
              )
            }
          >
            {REEL_TEXT_FONTS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </Field>
        <Slider
          label="Size"
          value={overlay.fontSize}
          min={12}
          max={180}
          onChange={(value) =>
            onChange((current) => updateTextOverlay(current, overlay.id, { fontSize: value }))
          }
        />
        <Slider
          label="Weight"
          value={overlay.fontWeight}
          min={300}
          max={900}
          step={100}
          onChange={(value) =>
            onChange((current) => updateTextOverlay(current, overlay.id, { fontWeight: value }))
          }
        />
        <Field label="Colour">
          <input
            type="color"
            value={overlay.color}
            onChange={(event) =>
              onChange((current) =>
                updateTextOverlay(current, overlay.id, { color: event.target.value }),
              )
            }
          />
        </Field>
        <Field label="Alignment">
          <select
            value={overlay.align}
            onChange={(event) =>
              onChange((current) =>
                updateTextOverlay(current, overlay.id, {
                  align: event.target.value as "left" | "center" | "right",
                }),
              )
            }
          >
            <option value="left">Left</option>
            <option value="center">Centre</option>
            <option value="right">Right</option>
          </select>
        </Field>
        <Slider
          label="Horizontal position"
          value={overlay.x}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) =>
            onChange((current) => updateTextOverlay(current, overlay.id, { x: value }))
          }
        />
        <Slider
          label="Vertical position"
          value={overlay.y}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) =>
            onChange((current) => updateTextOverlay(current, overlay.id, { y: value }))
          }
        />
        <NumberInput
          label="Start (s)"
          value={overlay.startSeconds}
          onChange={(value) =>
            onChange((current) => updateTextOverlay(current, overlay.id, { startSeconds: value }))
          }
        />
        <NumberInput
          label="End (s)"
          value={overlay.endSeconds}
          onChange={(value) =>
            onChange((current) => updateTextOverlay(current, overlay.id, { endSeconds: value }))
          }
        />
        <label className="reel-field reel-field-inline">
          <input
            type="checkbox"
            checked={overlay.uppercase}
            onChange={(event) =>
              onChange((current) =>
                updateTextOverlay(current, overlay.id, { uppercase: event.target.checked }),
              )
            }
          />
          <span>Uppercase</span>
        </label>
        <label className="reel-field reel-field-inline">
          <input
            type="checkbox"
            checked={overlay.shadow}
            onChange={(event) =>
              onChange((current) =>
                updateTextOverlay(current, overlay.id, { shadow: event.target.checked }),
              )
            }
          />
          <span>Shadow</span>
        </label>
        <button
          type="button"
          className="reel-button reel-button-danger"
          onClick={() => {
            onChange((current) => removeTextOverlay(current, overlay.id));
            onSelect({ kind: "project", id: null });
          }}
        >
          Delete text
        </button>
      </div>
    );
  }

  if (selection.kind === "sticker") {
    const sticker = project.stickers.find((item) => item.id === selection.id);
    if (!sticker) return <p className="reel-empty-note">This sticker is no longer available.</p>;
    const reorderSticker = (direction: 1 | -1) =>
      onChange((current) => {
        const index = current.stickers.findIndex((item) => item.id === sticker.id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= current.stickers.length) return current;
        const stickers = [...current.stickers];
        const moved = stickers.splice(index, 1)[0];
        if (!moved) return current;
        stickers.splice(target, 0, moved);
        return { ...current, stickers };
      });
    return (
      <div className="reel-inspector">
        <h3 className="reel-inspector-title">Sticker</h3>
        <div className="reel-inspector-quickactions">
          <button
            type="button"
            className="reel-icon-button"
            aria-label="Duplicate this sticker"
            onClick={() => {
              const copyId = crypto.randomUUID?.() ?? `${Date.now()}`;
              onChange((current) => {
                const source = current.stickers.find((item) => item.id === sticker.id);
                if (!source) return current;
                return {
                  ...current,
                  stickers: [
                    ...current.stickers,
                    {
                      ...source,
                      id: copyId,
                      x: Math.min(0.94, source.x + 0.04),
                      y: Math.min(0.94, source.y + 0.04),
                    },
                  ],
                };
              });
              onSelect({ kind: "sticker", id: copyId });
            }}
          >
            ⧉
          </button>
          <button
            type="button"
            className="reel-icon-button"
            aria-pressed={Boolean(sticker.locked)}
            aria-label={sticker.locked ? "Unlock this sticker" : "Lock this sticker"}
            onClick={() =>
              onChange((current) => ({
                ...current,
                stickers: current.stickers.map((item) =>
                  item.id === sticker.id ? { ...item, locked: !item.locked } : item,
                ),
              }))
            }
          >
            {sticker.locked ? "🔒" : "🔓"}
          </button>
          <button
            type="button"
            className="reel-icon-button"
            aria-label="Bring this sticker forward"
            onClick={() => reorderSticker(1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="reel-icon-button"
            aria-label="Send this sticker backward"
            onClick={() => reorderSticker(-1)}
          >
            ↓
          </button>
        </div>
        <Field label="Character">
          <input
            type="text"
            value={sticker.glyph ?? ""}
            maxLength={4}
            onChange={(event) =>
              onChange((current) =>
                updateSticker(current, sticker.id, { glyph: event.target.value }),
              )
            }
          />
        </Field>
        <Slider
          label="Size"
          value={sticker.scale}
          min={0.2}
          max={3}
          step={0.05}
          onChange={(value) =>
            onChange((current) => updateSticker(current, sticker.id, { scale: value }))
          }
        />
        <Slider
          label="Rotation"
          value={sticker.rotation}
          min={-180}
          max={180}
          onChange={(value) =>
            onChange((current) => updateSticker(current, sticker.id, { rotation: value }))
          }
        />
        <Slider
          label="Horizontal position"
          value={sticker.x}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) =>
            onChange((current) => updateSticker(current, sticker.id, { x: value }))
          }
        />
        <Slider
          label="Vertical position"
          value={sticker.y}
          min={0}
          max={1}
          step={0.01}
          onChange={(value) =>
            onChange((current) => updateSticker(current, sticker.id, { y: value }))
          }
        />
        <NumberInput
          label="Start (s)"
          value={sticker.startSeconds}
          onChange={(value) =>
            onChange((current) => updateSticker(current, sticker.id, { startSeconds: value }))
          }
        />
        <NumberInput
          label="End (s)"
          value={sticker.endSeconds}
          onChange={(value) =>
            onChange((current) => updateSticker(current, sticker.id, { endSeconds: value }))
          }
        />
        <button
          type="button"
          className="reel-button reel-button-danger"
          onClick={() => {
            onChange((current) => removeSticker(current, sticker.id));
            onSelect({ kind: "project", id: null });
          }}
        >
          Delete sticker
        </button>
      </div>
    );
  }

  if (selection.kind === "caption") {
    const caption = project.captions.find((item) => item.id === selection.id);
    if (!caption) return <p className="reel-empty-note">This caption is no longer available.</p>;
    return (
      <div className="reel-inspector">
        <h3 className="reel-inspector-title">Caption</h3>
        <Field label="Text">
          <textarea
            rows={2}
            value={caption.text}
            onChange={(event) =>
              onChange((current) =>
                updateCaption(current, caption.id, { text: event.target.value }),
              )
            }
          />
        </Field>
        <Slider
          label="Size"
          value={caption.fontSize}
          min={16}
          max={96}
          onChange={(value) =>
            onChange((current) => updateCaption(current, caption.id, { fontSize: value }))
          }
        />
        <Field label="Colour">
          <input
            type="color"
            value={caption.color}
            onChange={(event) =>
              onChange((current) =>
                updateCaption(current, caption.id, { color: event.target.value }),
              )
            }
          />
        </Field>
        <NumberInput
          label="Start (s)"
          value={caption.startSeconds}
          onChange={(value) =>
            onChange((current) => updateCaption(current, caption.id, { startSeconds: value }))
          }
        />
        <NumberInput
          label="End (s)"
          value={caption.endSeconds}
          onChange={(value) =>
            onChange((current) => updateCaption(current, caption.id, { endSeconds: value }))
          }
        />
        <button
          type="button"
          className="reel-button reel-button-danger"
          onClick={() => {
            onChange((current) => removeCaption(current, caption.id));
            onSelect({ kind: "project", id: null });
          }}
        >
          Delete caption
        </button>
      </div>
    );
  }

  if (selection.kind === "audio") {
    const clip = project.audio.find((item) => item.id === selection.id);
    if (!clip) return <p className="reel-empty-note">This track is no longer available.</p>;
    return (
      <div className="reel-inspector">
        <h3 className="reel-inspector-title">Audio</h3>
        <Slider
          label="Volume"
          value={clip.volume}
          min={0}
          max={1}
          step={0.05}
          onChange={(value) =>
            onChange((current) => updateAudioClip(current, clip.id, { volume: value }))
          }
        />
        <Slider
          label="Fade in"
          value={clip.fadeInSeconds}
          min={0}
          max={5}
          step={0.1}
          suffix="s"
          onChange={(value) =>
            onChange((current) => updateAudioClip(current, clip.id, { fadeInSeconds: value }))
          }
        />
        <Slider
          label="Fade out"
          value={clip.fadeOutSeconds}
          min={0}
          max={5}
          step={0.1}
          suffix="s"
          onChange={(value) =>
            onChange((current) => updateAudioClip(current, clip.id, { fadeOutSeconds: value }))
          }
        />
        <NumberInput
          label="Start (s)"
          value={clip.startSeconds}
          onChange={(value) =>
            onChange((current) => updateAudioClip(current, clip.id, { startSeconds: value }))
          }
        />
        <NumberInput
          label="Trim in (s)"
          value={clip.sourceIn}
          onChange={(value) =>
            onChange((current) => updateAudioClip(current, clip.id, { sourceIn: value }))
          }
        />
        <NumberInput
          label="Trim out (s)"
          value={clip.sourceOut}
          onChange={(value) =>
            onChange((current) => updateAudioClip(current, clip.id, { sourceOut: value }))
          }
        />
        <button
          type="button"
          className="reel-button reel-button-danger"
          onClick={() => {
            onChange((current) => removeAudioClip(current, clip.id));
            onSelect({ kind: "project", id: null });
          }}
        >
          Delete track
        </button>
      </div>
    );
  }

  return (
    <div className="reel-inspector">
      <h3 className="reel-inspector-title">Reel</h3>
      <Field label="Name">
        <input
          type="text"
          value={project.name}
          onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
        />
      </Field>
      <Field label="Aspect ratio">
        <select
          value={project.aspectRatio}
          onChange={(event) =>
            onChange((current) => setAspectRatio(current, event.target.value as ReelAspectRatio))
          }
        >
          {aspectOptions.map((ratio) => (
            <option key={ratio} value={ratio}>
              {ratio}
            </option>
          ))}
        </select>
      </Field>
      <NumberInput
        label="Cover frame (s)"
        value={project.coverFrameSeconds}
        onChange={(value) =>
          onChange((current) => ({ ...current, coverFrameSeconds: Math.max(0, value) }))
        }
      />
      <div className="reel-inspector-actions">
        <button
          type="button"
          className="reel-button"
          onClick={() => {
            const result = addTextOverlay(project, { startSeconds: currentTime });
            onChange(result.project);
            onSelect({ kind: "text", id: result.id });
          }}
        >
          Add text
        </button>
        <button
          type="button"
          className="reel-button"
          onClick={() => {
            const result = addSticker(project, { startSeconds: currentTime });
            onChange(result.project);
            onSelect({ kind: "sticker", id: result.id });
          }}
        >
          Add sticker
        </button>
        <button
          type="button"
          className="reel-button"
          onClick={() => {
            const result = addCaption(project, { startSeconds: currentTime });
            onChange(result.project);
            onSelect({ kind: "caption", id: result.id });
          }}
        >
          Add caption
        </button>
      </div>
      <p className="reel-empty-note">
        Select a clip, text, sticker, caption, or audio track to edit its properties.
      </p>
    </div>
  );
}
