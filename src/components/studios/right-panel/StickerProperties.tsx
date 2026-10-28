import { Trash2 } from "lucide-react";
import "@/styles/tokens.css";
import "./StickerProperties.css";

export type StudioStickerType =
  | "poll"
  | "question"
  | "link"
  | "countdown"
  | "quiz"
  | "slider"
  | "music"
  | "mention"
  | "location"
  | "hashtag"
  | string;

export interface StudioSticker {
  option1?: string;
  option2?: string;
  showResults?: boolean;
  prompt?: string;
  url?: string;
  displayText?: string;
  date?: string;
  time?: string;
  duration?: number;
  position?: string;
  size?: number;
  [property: string]: unknown;
}

export interface StickerPropertiesProps {
  sticker: StudioSticker;
  stickerType: StudioStickerType;
  onChange: (prop: string, value: string | number | boolean) => void;
  onDelete?: () => void;
}

const positions = [
  "Top",
  "Center",
  "Bottom",
  "Top-Left",
  "Top-Right",
  "Bottom-Left",
  "Bottom-Right",
];

const titles: Record<string, string> = {
  poll: "Poll Sticker",
  question: "Question Sticker",
  link: "Link Sticker",
  countdown: "Countdown Sticker",
  quiz: "Quiz Sticker",
  slider: "Slider Sticker",
  music: "Music Sticker",
  mention: "Mention Sticker",
  location: "Location Sticker",
  hashtag: "Hashtag Sticker",
};

export default function StickerProperties({
  sticker,
  stickerType,
  onChange,
  onDelete,
}: StickerPropertiesProps) {
  const title =
    titles[stickerType.toLowerCase()] ??
    `${stickerType.charAt(0).toUpperCase()}${stickerType.slice(1)} Sticker`;
  const supportsDuration = ["poll", "question", "quiz", "slider"].includes(
    stickerType.toLowerCase(),
  );

  return (
    <section className="studio-properties-panel" aria-label={title}>
      <h2 className="studio-properties-title">{title}</h2>

      {stickerType.toLowerCase() === "poll" && (
        <>
          <label className="studio-property-row">
            <span className="studio-property-label">Option 1</span>
            <span className="studio-property-control">
              <input
                value={String(sticker.option1 ?? "")}
                onChange={(event) => onChange("option1", event.target.value)}
              />
            </span>
          </label>
          <label className="studio-property-row">
            <span className="studio-property-label">Option 2</span>
            <span className="studio-property-control">
              <input
                value={String(sticker.option2 ?? "")}
                onChange={(event) => onChange("option2", event.target.value)}
              />
            </span>
          </label>
          <label className="studio-property-row">
            <span className="studio-property-label">Show results</span>
            <span className="studio-property-control">
              <input
                type="checkbox"
                checked={Boolean(sticker.showResults)}
                onChange={(event) => onChange("showResults", event.target.checked)}
              />
            </span>
          </label>
        </>
      )}

      {stickerType.toLowerCase() === "question" && (
        <label className="studio-property-row">
          <span className="studio-property-label">Prompt</span>
          <span className="studio-property-control">
            <input
              value={String(sticker.prompt ?? "")}
              onChange={(event) => onChange("prompt", event.target.value)}
            />
          </span>
        </label>
      )}

      {stickerType.toLowerCase() === "link" && (
        <>
          <label className="studio-property-row">
            <span className="studio-property-label">URL</span>
            <span className="studio-property-control">
              <input
                type="url"
                value={String(sticker.url ?? "")}
                onChange={(event) => onChange("url", event.target.value)}
              />
            </span>
          </label>
          <label className="studio-property-row">
            <span className="studio-property-label">Display text</span>
            <span className="studio-property-control">
              <input
                value={String(sticker.displayText ?? "")}
                onChange={(event) => onChange("displayText", event.target.value)}
              />
            </span>
          </label>
        </>
      )}

      {stickerType.toLowerCase() === "countdown" && (
        <>
          <label className="studio-property-row">
            <span className="studio-property-label">Date</span>
            <span className="studio-property-control">
              <input
                type="date"
                value={String(sticker.date ?? "")}
                onChange={(event) => onChange("date", event.target.value)}
              />
            </span>
          </label>
          <label className="studio-property-row">
            <span className="studio-property-label">Time</span>
            <span className="studio-property-control">
              <input
                type="time"
                value={String(sticker.time ?? "")}
                onChange={(event) => onChange("time", event.target.value)}
              />
            </span>
          </label>
        </>
      )}

      {supportsDuration && (
        <label className="studio-property-row">
          <span className="studio-property-label">Duration</span>
          <span className="studio-property-control">
            <input
              type="number"
              min={0.1}
              max={60}
              step={0.1}
              value={Number(sticker.duration ?? 5)}
              onChange={(event) => onChange("duration", Number(event.target.value))}
            />
          </span>
        </label>
      )}

      <label className="studio-property-row">
        <span className="studio-property-label">Position</span>
        <span className="studio-property-control">
          <select
            value={String(sticker.position ?? "Center")}
            onChange={(event) => onChange("position", event.target.value)}
          >
            {positions.map((position) => (
              <option key={position}>{position}</option>
            ))}
          </select>
        </span>
      </label>

      <div className="studio-property-row">
        <label className="studio-property-label" htmlFor="studio-sticker-size">
          Size
        </label>
        <div className="studio-property-control">
          <input
            id="studio-sticker-size"
            type="range"
            min={0.25}
            max={3}
            step={0.05}
            value={Number(sticker.size ?? 1)}
            onChange={(event) => onChange("size", Number(event.target.value))}
          />
          <span className="studio-property-value">{Number(sticker.size ?? 1).toFixed(2)}x</span>
        </div>
      </div>

      <div className="studio-property-actions">
        <button className="studio-property-action is-danger" type="button" onClick={onDelete}>
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </section>
  );
}
