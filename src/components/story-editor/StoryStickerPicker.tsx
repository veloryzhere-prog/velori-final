import React, { useMemo, useState } from "react";

import {
  searchStoryStickers,
  type StoryStickerCategory,
  type StoryStickerDefinition,
} from "../../lib/story-editor/sticker-catalog";

export interface StoryStickerPickerProps {
  onSelect: (sticker: StoryStickerDefinition) => void;
  onClose?: () => void;
  className?: string;
}

const CATEGORIES: Array<{
  id: StoryStickerCategory;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "interactive", label: "Interactive" },
  { id: "social", label: "Social" },
  { id: "emoji", label: "Emoji" },
  { id: "decorative", label: "Decorative" },
];

export default function StoryStickerPicker({
  onSelect,
  onClose,
  className,
}: StoryStickerPickerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<StoryStickerCategory>("all");

  const stickers = useMemo(() => searchStoryStickers(query, category), [query, category]);

  return (
    <section className={`velori-sticker-picker ${className ?? ""}`} aria-label="Story stickers">
      <header className="velori-sticker-picker__header">
        <div>
          <h2>Add to your story</h2>
          <p>Choose a sticker or search the collection.</p>
        </div>

        {onClose && (
          <button
            type="button"
            className="velori-sticker-picker__close"
            onClick={onClose}
            aria-label="Close sticker picker"
          >
            ×
          </button>
        )}
      </header>

      <label className="velori-sticker-picker__search">
        <span className="sr-only">Search stickers</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search stickers..."
          autoComplete="off"
        />
      </label>

      <nav className="velori-sticker-picker__categories" aria-label="Sticker categories">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={category === item.id}
            className={
              category === item.id ? "velori-sticker-category is-active" : "velori-sticker-category"
            }
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="velori-sticker-picker__grid">
        {stickers.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            className="velori-sticker-option"
            onClick={() => onSelect(sticker)}
            aria-label={`Add ${sticker.label} sticker`}
          >
            <span className="velori-sticker-option__glyph" aria-hidden="true">
              {sticker.glyph}
            </span>

            <span className="velori-sticker-option__label">{sticker.label}</span>
          </button>
        ))}
      </div>

      {stickers.length === 0 && (
        <p className="velori-sticker-picker__empty">No stickers match your search.</p>
      )}
    </section>
  );
}
