import { Split, Trash2 } from "lucide-react";
import "@/styles/tokens.css";
import "./ClipProperties.css";

export interface StudioClip {
  speed?: number;
  volume?: number;
  crop?: string;
  effects?: string[];
  transitionIn?: string;
  transitionOut?: string;
  duration?: number;
  [property: string]: unknown;
}

export interface ClipPropertiesProps {
  clip: StudioClip;
  onChange: (prop: string, value: string | number | string[]) => void;
  onSplit?: () => void;
  onDelete?: () => void;
}

const transitions = ["None", "Fade", "Slide", "Zoom", "Wipe", "Glitch"];
const crops = ["Original", "9:16", "1:1", "16:9", "4:5"];
const speeds = [0.25, 0.5, 1, 1.5, 2, 4];
const effects = ["Blur", "Sharp", "LUT"];

export default function ClipProperties({ clip, onChange, onSplit, onDelete }: ClipPropertiesProps) {
  const activeEffects = clip.effects ?? [];

  const toggleEffect = (effect: string) => {
    onChange(
      "effects",
      activeEffects.includes(effect)
        ? activeEffects.filter((item) => item !== effect)
        : [...activeEffects, effect],
    );
  };

  return (
    <section className="studio-properties-panel" aria-label="Clip properties">
      <h2 className="studio-properties-title">Clip</h2>

      <label className="studio-property-row">
        <span className="studio-property-label">Speed</span>
        <span className="studio-property-control">
          <select
            value={Number(clip.speed ?? 1)}
            onChange={(event) => onChange("speed", Number(event.target.value))}
          >
            {speeds.map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </select>
        </span>
      </label>

      <div className="studio-property-row">
        <label className="studio-property-label" htmlFor="studio-clip-volume">
          Volume
        </label>
        <div className="studio-property-control">
          <input
            id="studio-clip-volume"
            type="range"
            min={0}
            max={100}
            value={Number(clip.volume ?? 100)}
            onChange={(event) => onChange("volume", Number(event.target.value))}
          />
          <span className="studio-property-value">{Number(clip.volume ?? 100)}%</span>
        </div>
      </div>

      <label className="studio-property-row">
        <span className="studio-property-label">Crop</span>
        <span className="studio-property-control">
          <select
            value={String(clip.crop ?? "Original")}
            onChange={(event) => onChange("crop", event.target.value)}
          >
            {crops.map((crop) => (
              <option key={crop}>{crop}</option>
            ))}
          </select>
        </span>
      </label>

      <hr className="studio-properties-divider" />

      <div className="studio-property-row">
        <span className="studio-property-label">Effects</span>
        <div className="studio-property-control studio-effect-toggles">
          {effects.map((effect) => (
            <button
              key={effect}
              className="studio-effect-toggle"
              type="button"
              aria-pressed={activeEffects.includes(effect)}
              onClick={() => toggleEffect(effect)}
            >
              {effect}
            </button>
          ))}
        </div>
      </div>

      <hr className="studio-properties-divider" />

      <label className="studio-property-row">
        <span className="studio-property-label">Transition In</span>
        <span className="studio-property-control">
          <select
            value={String(clip.transitionIn ?? "None")}
            onChange={(event) => onChange("transitionIn", event.target.value)}
          >
            {transitions.map((transition) => (
              <option key={transition}>{transition}</option>
            ))}
          </select>
        </span>
      </label>

      <label className="studio-property-row">
        <span className="studio-property-label">Transition Out</span>
        <span className="studio-property-control">
          <select
            value={String(clip.transitionOut ?? "None")}
            onChange={(event) => onChange("transitionOut", event.target.value)}
          >
            {transitions.map((transition) => (
              <option key={transition}>{transition}</option>
            ))}
          </select>
        </span>
      </label>

      <label className="studio-property-row">
        <span className="studio-property-label">Duration</span>
        <span className="studio-property-control">
          <input
            type="number"
            min={0.1}
            max={2}
            step={0.1}
            aria-label="Transition duration in seconds"
            value={Number(clip.duration ?? 0.5)}
            onChange={(event) => onChange("duration", Number(event.target.value))}
          />
        </span>
      </label>

      <div className="studio-property-actions">
        <button className="studio-property-action" type="button" onClick={onSplit}>
          <Split size={15} /> Split
        </button>
        <button className="studio-property-action is-danger" type="button" onClick={onDelete}>
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </section>
  );
}
