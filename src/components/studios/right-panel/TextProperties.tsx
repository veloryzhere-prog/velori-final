import { AlignCenter, AlignLeft, AlignRight, Copy, Trash2 } from "lucide-react";
import "@/styles/tokens.css";
import "./TextProperties.css";

export interface StudioTextElement {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  color: string;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  animation?: string;
  animationDuration?: number;
  easing?: string;
  [property: string]: unknown;
}

export interface TextPropertiesProps {
  textElement: StudioTextElement;
  customFonts?: string[];
  onChange: (prop: string, value: string | number) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

const weights = [
  { label: "Light", value: "300" },
  { label: "Regular", value: "400" },
  { label: "Medium", value: "500" },
  { label: "Bold", value: "700" },
];
const animations = ["None", "Fade In", "Slide Up", "Pop", "Typewriter", "Bounce"];
const easings = ["Linear", "Ease In", "Ease Out", "Ease In-Out"];

export default function TextProperties({
  textElement,
  customFonts = [],
  onChange,
  onDuplicate,
  onDelete,
}: TextPropertiesProps) {
  const fonts = [...new Set(["Inter", "Poppins", "Montserrat", ...customFonts])];

  return (
    <section className="studio-properties-panel" aria-label="Text properties">
      <h2 className="studio-properties-title">Text</h2>

      <label className="studio-property-row">
        <span className="studio-property-label">Font</span>
        <span className="studio-property-control">
          <select
            value={String(textElement.fontFamily ?? fonts[0])}
            onChange={(event) => onChange("fontFamily", event.target.value)}
          >
            {fonts.map((font) => (
              <option key={font}>{font}</option>
            ))}
          </select>
        </span>
      </label>

      <div className="studio-property-row">
        <label className="studio-property-label" htmlFor="studio-text-size">
          Size
        </label>
        <div className="studio-property-control">
          <input
            id="studio-text-size"
            type="number"
            min={12}
            max={200}
            value={Number(textElement.fontSize ?? 32)}
            onChange={(event) => onChange("fontSize", Number(event.target.value))}
          />
          <input
            type="range"
            min={12}
            max={200}
            aria-label="Text size slider"
            value={Number(textElement.fontSize ?? 32)}
            onChange={(event) => onChange("fontSize", Number(event.target.value))}
          />
        </div>
      </div>

      <label className="studio-property-row">
        <span className="studio-property-label">Weight</span>
        <span className="studio-property-control">
          <select
            value={String(textElement.fontWeight ?? "400")}
            onChange={(event) => onChange("fontWeight", event.target.value)}
          >
            {weights.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </span>
      </label>

      <div className="studio-property-row">
        <span className="studio-property-label">Color</span>
        <div className="studio-property-control">
          <label className="studio-text-color-wrap" aria-label="Text color">
            <span
              className="studio-text-color-swatch"
              style={{ backgroundColor: textElement.color }}
            >
              <input
                type="color"
                aria-label="Choose text color"
                value={textElement.color}
                onChange={(event) => onChange("color", event.target.value)}
              />
            </span>
          </label>
          <span className="studio-property-value">{textElement.color}</span>
        </div>
      </div>

      <div className="studio-property-row">
        <span className="studio-property-label">Align</span>
        <div
          className="studio-property-control studio-text-align"
          role="group"
          aria-label="Text alignment"
        >
          {(
            [
              ["left", AlignLeft],
              ["center", AlignCenter],
              ["right", AlignRight],
            ] as const
          ).map(([align, Icon]) => (
            <button
              key={align}
              type="button"
              aria-label={`Align ${align}`}
              aria-pressed={(textElement.align ?? "left") === align}
              onClick={() => onChange("align", align)}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      <label className="studio-property-row">
        <span className="studio-property-label">Spacing</span>
        <span className="studio-property-control">
          <input
            type="number"
            min={0.8}
            max={3}
            step={0.1}
            aria-label="Line height"
            value={Number(textElement.lineHeight ?? 1.2)}
            onChange={(event) => onChange("lineHeight", Number(event.target.value))}
          />
        </span>
      </label>

      <hr className="studio-properties-divider" />

      <label className="studio-property-row">
        <span className="studio-property-label">Animation</span>
        <span className="studio-property-control">
          <select
            value={String(textElement.animation ?? "None")}
            onChange={(event) => onChange("animation", event.target.value)}
          >
            {animations.map((animation) => (
              <option key={animation}>{animation}</option>
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
            max={3}
            step={0.1}
            aria-label="Animation duration in seconds"
            value={Number(textElement.animationDuration ?? 0.5)}
            onChange={(event) => onChange("animationDuration", Number(event.target.value))}
          />
        </span>
      </label>

      <label className="studio-property-row">
        <span className="studio-property-label">Easing</span>
        <span className="studio-property-control">
          <select
            value={String(textElement.easing ?? "Linear")}
            onChange={(event) => onChange("easing", event.target.value)}
          >
            {easings.map((easing) => (
              <option key={easing}>{easing}</option>
            ))}
          </select>
        </span>
      </label>

      <div className="studio-property-actions">
        <button className="studio-property-action" type="button" onClick={onDuplicate}>
          <Copy size={15} /> Duplicate
        </button>
        <button className="studio-property-action is-danger" type="button" onClick={onDelete}>
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </section>
  );
}
