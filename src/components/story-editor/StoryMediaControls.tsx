import React from "react";

export interface StoryMediaTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  opacity: number;
  fit: "cover" | "contain" | "fill";
}

export interface StoryMediaControlsProps {
  value: StoryMediaTransform;
  onChange: (value: StoryMediaTransform) => void;
  disabled?: boolean;
}

export default function StoryMediaControls({
  value,
  onChange,
  disabled = false,
}: StoryMediaControlsProps) {
  const update = (changes: Partial<StoryMediaTransform>) => {
    onChange({
      ...value,
      ...changes,
    });
  };

  return (
    <section className="velori-media-controls" aria-label="Media adjustments">
      <h3>Media adjustments</h3>

      <label>
        Fit mode
        <select
          disabled={disabled}
          value={value.fit}
          onChange={(event) =>
            update({
              fit: event.target.value as StoryMediaTransform["fit"],
            })
          }
        >
          <option value="cover">Cover</option>
          <option value="contain">Contain</option>
          <option value="fill">Stretch to fill</option>
        </select>
      </label>

      <label>
        Scale: {value.scale.toFixed(2)}
        <input
          disabled={disabled}
          type="range"
          min="0.25"
          max="4"
          step="0.05"
          value={value.scale}
          onChange={(event) => update({ scale: Number(event.target.value) })}
        />
      </label>

      <label>
        Rotation: {Math.round(value.rotation)}°
        <input
          disabled={disabled}
          type="range"
          min="-180"
          max="180"
          value={value.rotation}
          onChange={(event) => update({ rotation: Number(event.target.value) })}
        />
      </label>

      <label>
        Opacity: {Math.round(value.opacity * 100)}%
        <input
          disabled={disabled}
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={value.opacity}
          onChange={(event) => update({ opacity: Number(event.target.value) })}
        />
      </label>

      <div className="velori-media-controls__position">
        <button type="button" disabled={disabled} onClick={() => update({ x: 0.5, y: 0.5 })}>
          Center
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            update({
              x: 0.5,
              y: 0.5,
              width: 1,
              height: 1,
              scale: 1,
              rotation: 0,
              opacity: 1,
              fit: "cover",
            })
          }
        >
          Reset
        </button>
      </div>
    </section>
  );
}
