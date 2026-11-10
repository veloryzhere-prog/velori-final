import { Copy, Eye, EyeOff, LockKeyhole, Trash2, UnlockKeyhole } from "lucide-react";
import type { PostEditorLayer } from "../../../../types/post-editor";
import "./LayerProperties.css";

type ChangeValue = string | number | boolean;

export interface LayerPropertiesProps {
  layer: PostEditorLayer;
  onChange: (property: string, value: ChangeValue) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onVisibilityToggle?: () => void;
  onLockToggle?: () => void;
  showAppearance?: boolean;
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="post-studio-property-field">
      <span>{label}</span>
      <span className="post-studio-number-input-wrap">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (Number.isFinite(next)) onChange(next);
          }}
        />
        {suffix ? <small>{suffix}</small> : null}
      </span>
    </label>
  );
}

export default function LayerProperties({
  layer,
  onChange,
  onDuplicate,
  onDelete,
  onVisibilityToggle,
  onLockToggle,
  showAppearance = true,
}: LayerPropertiesProps) {
  const update = (property: string, value: ChangeValue) => onChange(property, value);
  return (
    <section className="post-studio-properties-card" aria-label={`${layer.name} layer properties`}>
      <header className="post-studio-properties-card-heading">
        <div>
          <span className="post-studio-panel-eyebrow">SELECTED LAYER</span>
          <h3>{layer.name || `${layer.type} layer`}</h3>
        </div>
        <div className="post-studio-property-state-actions">
          {onVisibilityToggle ? (
            <button
              type="button"
              title={layer.visible ? "Hide layer" : "Show layer"}
              aria-label={layer.visible ? "Hide layer" : "Show layer"}
              onClick={onVisibilityToggle}
            >
              {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          ) : null}
          {onLockToggle ? (
            <button
              type="button"
              title={layer.locked ? "Unlock layer" : "Lock layer"}
              aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
              onClick={onLockToggle}
            >
              {layer.locked ? <LockKeyhole size={15} /> : <UnlockKeyhole size={15} />}
            </button>
          ) : null}
        </div>
      </header>
      <section className="post-studio-property-section" aria-label="Position and size">
        <h4>Position &amp; size</h4>
        <div className="post-studio-property-grid">
          <NumberField
            label="X position"
            value={layer.x}
            onChange={(value) => update("x", value)}
          />
          <NumberField
            label="Y position"
            value={layer.y}
            onChange={(value) => update("y", value)}
          />
          <NumberField
            label="Width"
            value={layer.width}
            min={24}
            onChange={(value) => update("width", Math.max(24, value))}
          />
          <NumberField
            label="Height"
            value={layer.height}
            min={24}
            onChange={(value) => update("height", Math.max(24, value))}
          />
          <NumberField
            label="Rotation"
            value={layer.rotation ?? 0}
            min={-360}
            max={360}
            onChange={(value) => update("rotation", value)}
            suffix="°"
          />
          <NumberField
            label="Opacity"
            value={Math.round((layer.opacity ?? 1) * 100)}
            min={0}
            max={100}
            onChange={(value) => update("opacity", Math.max(0, Math.min(100, value)) / 100)}
            suffix="%"
          />
        </div>
      </section>
      {showAppearance && layer.type === "image" ? (
        <section className="post-studio-property-section" aria-label="Image appearance">
          <h4>Image appearance</h4>
          <label className="post-studio-property-field">
            <span>Image fit</span>
            <select
              value={layer.image?.fit ?? "cover"}
              onChange={(event) => update("image.fit", event.target.value)}
            >
              <option value="cover">Fill frame</option>
              <option value="contain">Fit entire image</option>
            </select>
          </label>
          {(
            [
              {
                label: "Brightness",
                key: "image.brightness",
                value: layer.image?.brightness ?? 100,
                min: 0,
                max: 200,
                suffix: "%",
              },
              {
                label: "Contrast",
                key: "image.contrast",
                value: layer.image?.contrast ?? 100,
                min: 0,
                max: 200,
                suffix: "%",
              },
              {
                label: "Saturation",
                key: "image.saturation",
                value: layer.image?.saturation ?? 100,
                min: 0,
                max: 200,
                suffix: "%",
              },
              {
                label: "Blur",
                key: "image.blur",
                value: layer.image?.blur ?? 0,
                min: 0,
                max: 20,
                suffix: "px",
              },
            ] as const
          ).map((item) => (
            <label className="post-studio-property-range" key={item.key}>
              <span>
                {item.label}
                <strong>
                  {item.value}
                  {item.suffix}
                </strong>
              </span>
              <input
                type="range"
                min={item.min}
                max={item.max}
                value={item.value}
                onChange={(event) => update(item.key, Number(event.target.value))}
              />
            </label>
          ))}
          <p className="post-studio-property-note">
            These filters update the editor preview. Publishing or export must use the same
            composition pipeline to include them in the final media.
          </p>
        </section>
      ) : null}
      {showAppearance && layer.type === "shape" ? (
        <section className="post-studio-property-section" aria-label="Shape appearance">
          <h4>Shape appearance</h4>
          <label className="post-studio-property-field">
            <span>Shape</span>
            <select
              value={layer.shape?.shapeType ?? "rectangle"}
              onChange={(event) => update("shape.shapeType", event.target.value)}
            >
              <option value="rectangle">Rectangle</option>
              <option value="rounded-rectangle">Rounded rectangle</option>
              <option value="circle">Circle</option>
              <option value="ellipse">Ellipse</option>
              <option value="triangle">Triangle</option>
              <option value="diamond">Diamond</option>
              <option value="line">Line</option>
            </select>
          </label>
          <label className="post-studio-property-field">
            <span>Fill color</span>
            <span className="post-studio-color-input-wrap">
              <input
                type="color"
                value={layer.shape?.fill ?? "#f1dc78"}
                onChange={(event) => update("shape.fill", event.target.value)}
              />
              <code>{layer.shape?.fill ?? "#f1dc78"}</code>
            </span>
          </label>
          <label className="post-studio-property-field">
            <span>Outline</span>
            <span className="post-studio-color-input-wrap">
              <input
                type="color"
                value={
                  layer.shape?.stroke && layer.shape.stroke !== "transparent"
                    ? layer.shape.stroke
                    : "#1c1c18"
                }
                onChange={(event) => update("shape.stroke", event.target.value)}
              />
              <code>{layer.shape?.stroke ?? "transparent"}</code>
            </span>
          </label>
          <NumberField
            label="Outline width"
            value={layer.shape?.strokeWidth ?? 0}
            min={0}
            max={24}
            onChange={(value) => update("shape.strokeWidth", value)}
            suffix="px"
          />
          <NumberField
            label="Corner radius"
            value={layer.shape?.radius ?? 20}
            min={0}
            max={160}
            onChange={(value) => update("shape.radius", value)}
            suffix="px"
          />
        </section>
      ) : null}
      <footer className="post-studio-property-footer">
        {onDuplicate ? (
          <button type="button" onClick={onDuplicate}>
            <Copy size={14} /> Duplicate
          </button>
        ) : null}
        {onDelete ? (
          <button type="button" className="is-danger" onClick={onDelete}>
            <Trash2 size={14} /> Delete layer
          </button>
        ) : null}
      </footer>
    </section>
  );
}
