import React, { useState } from "react";

export interface StoryTextDraft {
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string | null;
  bold: boolean;
  italic: boolean;
  alignment: "left" | "center" | "right";
}

export interface StoryTextStudioProps {
  initialValue?: Partial<StoryTextDraft>;
  onAdd: (draft: StoryTextDraft) => void;
  onClose?: () => void;
}

const FONTS = ["Arial", "Georgia", "Verdana", "Trebuchet MS", "Courier New", "Impact"];

const COLORS = [
  "#FFFFFF",
  "#111111",
  "#FF375F",
  "#FF5CA8",
  "#FF9500",
  "#FFD60A",
  "#34C759",
  "#00C7BE",
  "#0A84FF",
  "#5E5CE6",
  "#BF5AF2",
];

export default function StoryTextStudio({ initialValue, onAdd, onClose }: StoryTextStudioProps) {
  const [content, setContent] = useState(initialValue?.content ?? "");
  const [fontFamily, setFontFamily] = useState(initialValue?.fontFamily ?? "Arial");
  const [fontSize, setFontSize] = useState(initialValue?.fontSize ?? 36);
  const [color, setColor] = useState(initialValue?.color ?? "#FFFFFF");
  const [backgroundColor, setBackgroundColor] = useState<string | null>(
    initialValue?.backgroundColor ?? null,
  );
  const [bold, setBold] = useState(initialValue?.bold ?? false);
  const [italic, setItalic] = useState(initialValue?.italic ?? false);
  const [alignment, setAlignment] = useState<"left" | "center" | "right">(
    initialValue?.alignment ?? "center",
  );

  const addText = () => {
    const trimmed = content.trim();

    if (!trimmed) return;

    onAdd({
      content: trimmed,
      fontFamily,
      fontSize,
      color,
      backgroundColor,
      bold,
      italic,
      alignment,
    });
  };

  return (
    <section className="velori-text-studio" aria-label="Text editor">
      <header className="velori-text-studio__header">
        <h2>Add text</h2>

        {onClose && (
          <button type="button" onClick={onClose}>
            Close
          </button>
        )}
      </header>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Write something..."
        rows={3}
        maxLength={1000}
        autoFocus
      />

      <div className="velori-text-studio__preview">
        <span
          style={{
            fontFamily,
            fontSize: `${Math.min(fontSize, 42)}px`,
            color,
            backgroundColor: backgroundColor ?? "transparent",
            fontWeight: bold ? 700 : 400,
            fontStyle: italic ? "italic" : "normal",
            textAlign: alignment,
          }}
        >
          {content || "Your story text"}
        </span>
      </div>

      <label>
        Font
        <select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>
          {FONTS.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </label>

      <label>
        Size: {fontSize}px
        <input
          type="range"
          min={12}
          max={100}
          value={fontSize}
          onChange={(event) => setFontSize(Number(event.target.value))}
        />
      </label>

      <div className="velori-text-studio__section">
        <span>Text color</span>

        <div className="velori-text-studio__colors">
          {COLORS.map((item) => (
            <button
              key={item}
              type="button"
              title={item}
              aria-label={`Set text color to ${item}`}
              aria-pressed={color === item}
              className={color === item ? "is-active" : ""}
              style={{ backgroundColor: item }}
              onClick={() => setColor(item)}
            />
          ))}
        </div>
      </div>

      <div className="velori-text-studio__section">
        <span>Text background</span>

        <div className="velori-text-studio__backgrounds">
          <button
            type="button"
            aria-pressed={backgroundColor === null}
            onClick={() => setBackgroundColor(null)}
          >
            None
          </button>

          <button
            type="button"
            aria-pressed={backgroundColor === "#111111"}
            onClick={() => setBackgroundColor("#111111")}
          >
            Dark
          </button>

          <button
            type="button"
            aria-pressed={backgroundColor === "#FF5CA8"}
            onClick={() => setBackgroundColor("#FF5CA8")}
          >
            Pink
          </button>

          <button
            type="button"
            aria-pressed={backgroundColor === "#0A84FF"}
            onClick={() => setBackgroundColor("#0A84FF")}
          >
            Blue
          </button>
        </div>
      </div>

      <div className="velori-text-studio__actions">
        <button type="button" aria-pressed={bold} onClick={() => setBold((value) => !value)}>
          Bold
        </button>

        <button type="button" aria-pressed={italic} onClick={() => setItalic((value) => !value)}>
          Italic
        </button>

        {(["left", "center", "right"] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={alignment === item}
            onClick={() => setAlignment(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="velori-text-studio__add"
        disabled={!content.trim()}
        onClick={addText}
      >
        Add to story
      </button>
    </section>
  );
}
