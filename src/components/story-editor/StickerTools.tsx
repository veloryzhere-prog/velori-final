import { ImagePlus, Music2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMotion } from "../../lib/motion-provider";
import { fetchStudioCatalog } from "../../lib/studio-catalog";
import type {
  StoryBrandOverlay,
  StoryStickerConfig,
  StoryStickerType,
  StoryTextAnimation,
  Sticker,
} from "../../lib/story-editor/types";
import {
  parseStoryStickerConfig,
  STORY_INTERACTIVE_STICKER_TYPES,
  STORY_STICKER_LIBRARY,
  MAX_STORY_STICKERS_PER_SLIDE,
  type StoryStickerCatalogItem,
} from "../../lib/story-editor/stickers.mjs";

interface StickerToolsProps {
  mode?: "stickers" | "music" | "brand";
  stickers: Sticker[];
  selectedId: string | null;
  brand: StoryBrandOverlay;
  lockedLogoPosition?: boolean;
  onSelect: (id: string) => void;
  onAdd: (type: StoryStickerType) => void;
  onAddCatalog: (item: StoryStickerCatalogItem) => void;
  onAddCustom: (url: string) => void;
  onUpdate: (id: string, patch: Partial<Sticker>) => void;
  onDelete: (id: string) => void;
  onUploadAsset: (file: File) => Promise<string>;
  onBrandChange: (patch: Partial<StoryBrandOverlay>) => void;
  onBrandUpload: (file: File) => void;
  onError: (message: string) => void;
}

const stickerLabels: Record<StoryStickerType, string> = {
  poll: "Poll",
  question: "Question / Ask",
  quiz: "Quiz",
  slider: "Reaction slider",
  link: "Link",
  countdown: "Countdown",
  music: "Music",
  mention: "Mention",
  location: "Location",
  hashtag: "Hashtag",
  emoji: "Emoji",
  custom: "Custom",
};

const stickerAnimations: { value: StoryTextAnimation | "spin"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade-in", label: "Fade In" },
  { value: "fade-out", label: "Fade Out" },
  { value: "fade-in-out", label: "Fade In and Out" },
  { value: "slide-up", label: "Slide Up" },
  { value: "slide-down", label: "Slide Down" },
  { value: "slide-left", label: "Slide Left" },
  { value: "slide-right", label: "Slide Right" },
  { value: "zoom-in", label: "Zoom In" },
  { value: "zoom-out", label: "Zoom Out" },
  { value: "pop", label: "Pop" },
  { value: "bounce", label: "Bounce" },
  { value: "pulse", label: "Pulse" },
  { value: "rotate-in", label: "Rotate In" },
  { value: "float", label: "Float" },
  { value: "spin", label: "Spin" },
];

function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url" | "datetime-local" | "number";
  min?: number;
  max?: number;
}) {
  return (
    <label className="story-editor-sticker-field">
      <span>{label}</span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        step={type === "number" ? "0.0001" : undefined}
        type={type}
        value={value}
      />
    </label>
  );
}

function Range({
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="story-editor-sticker-range">
      <span>
        {label}{" "}
        <small>
          {value}
          {suffix}
        </small>
      </span>
      <input
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
  );
}

function toDateTimeLocal(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function StickerCatalogGroup({
  label,
  stickers,
  disabled,
  onSelect,
}: {
  label: string;
  stickers: StoryStickerCatalogItem[];
  disabled: boolean;
  onSelect: (sticker: StoryStickerCatalogItem) => void;
}) {
  return (
    <section className="story-editor-sticker-group" aria-label={label}>
      <h3>{label}</h3>
      <div aria-label={`${label} sticker choices`} className="story-editor-sticker-library">
        {stickers.map((sticker) => (
          <button
            aria-label={`${sticker.style} ${sticker.emoji}${sticker.animated ? ", animated" : ""}`}
            className={`story-editor-library-sticker${sticker.animated ? ` story-editor-sticker-animation-${sticker.animation}` : ""}`}
            disabled={disabled}
            key={sticker.id}
            onClick={() => onSelect(sticker)}
            style={{ color: sticker.color, background: sticker.background }}
            title={`${sticker.category} · ${sticker.style}`}
            type="button"
          >
            {sticker.assetUrl ? <img src={sticker.assetUrl} alt="" /> : sticker.emoji}
          </button>
        ))}
      </div>
      {!stickers.length ? (
        <p className="story-editor-tool-hint">No stickers match this search.</p>
      ) : null}
    </section>
  );
}

export function StickerTools({
  mode = "stickers",
  stickers,
  selectedId,
  brand,
  lockedLogoPosition = false,
  onSelect,
  onAdd,
  onAddCatalog,
  onAddCustom,
  onUpdate,
  onDelete,
  onUploadAsset,
  onBrandChange,
  onBrandUpload,
  onError,
}: StickerToolsProps) {
  const { config: motionConfig } = useMotion();
  const [catalogStickers, setCatalogStickers] = useState<StoryStickerCatalogItem[]>([]);
  useEffect(() => {
    let active = true;
    void fetchStudioCatalog({ studio: "story", limit: 100 })
      .then((catalog) => {
        if (!active) return;
        setCatalogStickers(
          catalog.stickers.flatMap((sticker) =>
            sticker.assetUrl
              ? [
                  {
                    id: `catalog-${sticker.id}`,
                    category: sticker.category,
                    emoji: "✦",
                    style: sticker.name,
                    color: "#17131b",
                    background: "#ffffff",
                    animation: "none" as const,
                    animated: sticker.animated,
                    assetUrl: sticker.assetUrl,
                  },
                ]
              : [],
          ),
        );
      })
      .catch(() => {
        if (active) setCatalogStickers([]);
      });
    return () => {
      active = false;
    };
  }, []);
  const stickerLibrary = useMemo<StoryStickerCatalogItem[]>(
    () => [
      ...STORY_STICKER_LIBRARY,
      ...catalogStickers,
      ...motionConfig.creatorStudio.stickers
        .filter((sticker) => sticker.enabled && sticker.editors.includes("story"))
        .map((sticker) => ({
          id: `managed-${sticker.id}`,
          category: sticker.category,
          emoji: sticker.emoji,
          style: sticker.name || sticker.style,
          color: sticker.color,
          background: sticker.background,
          animation: "none" as const,
          animated: false,
        })),
    ],
    [catalogStickers, motionConfig.creatorStudio.stickers],
  );
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const logoRef = useRef<HTMLInputElement | null>(null);
  const matchingStickers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return stickerLibrary.filter((sticker) => {
      const matchesQuery =
        !normalizedQuery ||
        `${sticker.emoji} ${sticker.category} ${sticker.style}`
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesQuery;
    });
  }, [query, stickerLibrary]);
  const selected = stickers.find((sticker) => sticker.id === selectedId) ?? null;
  const config = selected ? parseStoryStickerConfig(selected.config) : {};
  const selectedMusic =
    selected?.type === "music"
      ? selected
      : (stickers.find((sticker) => sticker.type === "music") ?? null);
  const recentStickers = [
    ...recentIds
      .map((id) => stickerLibrary.find((sticker) => sticker.id === id))
      .filter((sticker): sticker is StoryStickerCatalogItem => Boolean(sticker)),
    ...stickerLibrary.filter((sticker) => !recentIds.includes(sticker.id)),
  ].slice(0, 12);
  const trendingStickers = matchingStickers.slice(0, 8);

  function updateConfig(patch: Partial<StoryStickerConfig>) {
    if (!selected) return;
    onUpdate(selected.id, { config: JSON.stringify({ ...config, ...patch }) });
  }

  function updateContent(content: string) {
    if (selected) onUpdate(selected.id, { content });
  }

  function readUpload(event: ChangeEvent<HTMLInputElement>, callback: (file: File) => void) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) callback(file);
  }

  function addCustomSticker(file: File) {
    void onUploadAsset(file)
      .then(onAddCustom)
      .catch((cause: unknown) =>
        onError(cause instanceof Error ? cause.message : "Custom sticker upload failed."),
      );
  }

  function updateLogo(file: File) {
    onBrandUpload(file);
  }

  if (mode === "music") {
    const musicConfig = selectedMusic ? parseStoryStickerConfig(selectedMusic.config) : {};
    return (
      <section aria-label="Story music" className="story-editor-sticker-tools">
        <header className="story-editor-tool-panel-heading">
          <span className="story-editor-eyebrow">MUSIC</span>
          <h2>Add a music sticker</h2>
          <p>Music is shown as a story sticker; no soundtrack is attached to the video export.</p>
        </header>
        {selectedMusic ? (
          <>
            <Field
              label="Track title"
              onChange={(title) =>
                onUpdate(selectedMusic.id, {
                  config: JSON.stringify({ ...musicConfig, title }),
                })
              }
              value={musicConfig.title ?? ""}
            />
            <Field
              label="Artist"
              onChange={(artist) =>
                onUpdate(selectedMusic.id, {
                  config: JSON.stringify({ ...musicConfig, artist }),
                })
              }
              value={musicConfig.artist ?? ""}
            />
            <Range
              label="Sticker volume"
              max={100}
              min={0}
              onChange={(volume) =>
                onUpdate(selectedMusic.id, {
                  config: JSON.stringify({ ...musicConfig, volume }),
                })
              }
              suffix="%"
              value={musicConfig.volume ?? 80}
            />
            <button
              className="story-editor-danger-button"
              onClick={() => onDelete(selectedMusic.id)}
              type="button"
            >
              <Trash2 size={14} /> Remove music sticker
            </button>
          </>
        ) : (
          <button
            className="story-editor-tool-button"
            disabled={stickers.length >= MAX_STORY_STICKERS_PER_SLIDE}
            onClick={() => onAdd("music")}
            type="button"
          >
            <Music2 size={16} /> Add music sticker
          </button>
        )}
      </section>
    );
  }

  if (mode === "brand") {
    return (
      <section aria-label="Brand logo and watermark" className="story-editor-sticker-tools">
        <header className="story-editor-tool-panel-heading">
          <span className="story-editor-eyebrow">BRAND KIT</span>
          <h2>Logo and watermark</h2>
        </header>
        <button
          className="story-editor-tool-button"
          onClick={() => logoRef.current?.click()}
          type="button"
        >
          <ImagePlus size={15} /> {brand.logoUrl ? "Replace logo" : "Upload logo"}
        </button>
        <input
          accept="image/png,image/svg+xml,.svg"
          hidden
          onChange={(event) => readUpload(event, updateLogo)}
          ref={logoRef}
          type="file"
        />
        {brand.logoUrl ? (
          <>
            <img
              alt="Logo preview"
              className="story-editor-custom-sticker-preview"
              src={brand.logoUrl}
            />
            <Range
              label="Logo horizontal position"
              disabled={lockedLogoPosition}
              max={100}
              min={0}
              onChange={(logoX) => onBrandChange({ logoX: logoX / 100 })}
              suffix="%"
              value={Math.round(brand.logoX * 100)}
            />
            <Range
              label="Logo vertical position"
              disabled={lockedLogoPosition}
              max={100}
              min={0}
              onChange={(logoY) => onBrandChange({ logoY: logoY / 100 })}
              suffix="%"
              value={Math.round(brand.logoY * 100)}
            />
            <Range
              label="Logo size"
              max={2}
              min={0.2}
              onChange={(logoScale) => onBrandChange({ logoScale })}
              suffix="×"
              value={brand.logoScale}
            />
            <Range
              label="Logo opacity"
              max={100}
              min={0}
              onChange={(value) => onBrandChange({ logoOpacity: value / 100 })}
              suffix="%"
              value={Math.round(brand.logoOpacity * 100)}
            />
            <button
              className="story-editor-danger-button"
              onClick={() => onBrandChange({ logoUrl: null })}
              type="button"
            >
              <Trash2 size={14} /> Remove logo
            </button>
          </>
        ) : null}
        <Field
          label="Watermark text"
          onChange={(watermarkText) => onBrandChange({ watermarkText })}
          value={brand.watermarkText}
        />
        <Range
          label="Watermark opacity"
          max={100}
          min={0}
          onChange={(value) => onBrandChange({ watermarkOpacity: value / 100 })}
          suffix="%"
          value={Math.round(brand.watermarkOpacity * 100)}
        />
      </section>
    );
  }

  return (
    <section
      aria-label="Interactive stickers and brand overlays"
      className="story-editor-sticker-tools"
    >
      <div className="story-editor-section-heading">
        <div>
          <span className="story-editor-eyebrow">STICKERS</span>
          <h2>Add a detail</h2>
        </div>
      </div>

      <input
        aria-label="Search stickers"
        className="story-editor-sticker-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search stickers"
        type="search"
        value={query}
      />
      <div aria-label="Sticker categories" className="story-editor-sticker-categories">
        {(
          [
            ["all", "All"],
            ["recent", "Recent"],
            ["interactive", "Interactive"],
            ["upload", "Upload"],
          ] as const
        ).map(([id, label]) => (
          <button
            aria-pressed={category === id}
            key={id}
            onClick={() => setCategory(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {category === "all" || category === "recent" ? (
        <StickerCatalogGroup
          label="Recent picks"
          stickers={recentStickers.filter((item) => matchingStickers.includes(item))}
          disabled={stickers.length >= MAX_STORY_STICKERS_PER_SLIDE}
          onSelect={(item) => {
            setRecentIds((current) =>
              [item.id, ...current.filter((id) => id !== item.id)].slice(0, 12),
            );
            onAddCatalog(item);
          }}
        />
      ) : null}
      {category === "all" ? (
        <StickerCatalogGroup
          label="Trending"
          stickers={trendingStickers}
          disabled={stickers.length >= MAX_STORY_STICKERS_PER_SLIDE}
          onSelect={(item) => {
            setRecentIds((current) =>
              [item.id, ...current.filter((id) => id !== item.id)].slice(0, 12),
            );
            onAddCatalog(item);
          }}
        />
      ) : null}
      {category === "interactive" ? (
        <>
          <label className="story-editor-select">
            <span>Add a story interaction</span>
            <select
              disabled={stickers.length >= MAX_STORY_STICKERS_PER_SLIDE}
              onChange={(event) => {
                if (event.target.value) onAdd(event.target.value as StoryStickerType);
                event.target.value = "";
              }}
              value=""
            >
              <option value="">Choose a sticker…</option>
              {STORY_INTERACTIVE_STICKER_TYPES.filter((type) => type !== "music").map((type) => (
                <option key={type} value={type}>
                  {stickerLabels[type]}
                </option>
              ))}
            </select>
          </label>
          {stickers.length ? (
            <div aria-label="Slide stickers" className="story-editor-sticker-list">
              {stickers.map((sticker, index) => (
                <button
                  aria-pressed={sticker.id === selectedId}
                  key={sticker.id}
                  onClick={() => onSelect(sticker.id)}
                  type="button"
                >
                  {stickerLabels[sticker.type]} {index + 1}
                </button>
              ))}
            </div>
          ) : (
            <p className="story-editor-tool-hint">
              Add a poll, question, link, or other interaction.
            </p>
          )}
        </>
      ) : null}
      {category === "upload" ? (
        <label className="story-editor-tool-button story-editor-upload-sticker">
          <ImagePlus size={15} /> Upload PNG or SVG
          <input
            accept="image/png,image/svg+xml,.svg"
            hidden
            onChange={(event) => readUpload(event, addCustomSticker)}
            ref={uploadRef}
            type="file"
          />
        </label>
      ) : null}

      {selected ? (
        <details className="story-editor-tool-section" open>
          <summary>Edit {stickerLabels[selected.type]}</summary>
          {selected.type !== "emoji" && selected.type !== "custom" ? (
            <Field
              label={
                selected.type === "question"
                  ? "Question prompt"
                  : selected.type === "poll" || selected.type === "quiz"
                    ? "Question"
                    : selected.type === "hashtag"
                      ? "Hashtag"
                      : "Sticker text"
              }
              onChange={updateContent}
              value={selected.content}
            />
          ) : null}
          {selected.type === "poll" || selected.type === "quiz" ? (
            <>
              {(config.options ?? []).map((option, index) => (
                <Field
                  key={`${selected.id}-option-${index}`}
                  label={`Option ${index + 1}`}
                  onChange={(value) => {
                    const options = [...(config.options ?? [])];
                    options[index] = value;
                    updateConfig({ options });
                  }}
                  value={option}
                />
              ))}
              {selected.type === "quiz" ? (
                <label className="story-editor-select">
                  <span>Correct answer</span>
                  <select
                    onChange={(event) =>
                      updateConfig({ correctAnswer: Number(event.target.value) })
                    }
                    value={config.correctAnswer ?? 0}
                  >
                    {(config.options ?? []).map((option, index) => (
                      <option key={`${option}-${index}`} value={index}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="story-editor-check">
                  <input
                    checked={config.showResults ?? true}
                    onChange={(event) => updateConfig({ showResults: event.target.checked })}
                    type="checkbox"
                  />
                  Show poll results
                </label>
              )}
            </>
          ) : null}
          {selected.type === "slider" ? (
            <>
              <Field
                label="Reaction emoji"
                onChange={(emoji) => updateConfig({ emoji, reaction: emoji })}
                value={config.emoji ?? "😍"}
              />
              <Field
                label="Reaction text"
                onChange={(reactionText) => updateConfig({ reactionText })}
                value={config.reactionText ?? ""}
              />
            </>
          ) : null}
          {selected.type === "link" ? (
            <>
              <Field
                label="URL"
                onChange={(url) => updateConfig({ url })}
                type="url"
                value={config.url ?? ""}
              />
              <Field
                label="Display text"
                onChange={(displayText) => updateConfig({ displayText })}
                value={config.displayText ?? ""}
              />
            </>
          ) : null}
          {selected.type === "countdown" ? (
            <Field
              label="Date and time"
              onChange={(value) =>
                updateConfig({ targetDate: value ? new Date(value).toISOString() : "" })
              }
              type="datetime-local"
              value={toDateTimeLocal(config.targetDate)}
            />
          ) : null}
          {selected.type === "music" ? (
            <>
              <Field
                label="Title"
                onChange={(title) => updateConfig({ title })}
                value={config.title ?? ""}
              />
              <Field
                label="Artist"
                onChange={(artist) => updateConfig({ artist })}
                value={config.artist ?? ""}
              />
              <Range
                label="Volume"
                max={100}
                min={0}
                onChange={(volume) => updateConfig({ volume })}
                suffix="%"
                value={config.volume ?? 80}
              />
            </>
          ) : null}
          {selected.type === "mention" ? (
            <>
              <Field
                label="@ account"
                onChange={(account) => updateConfig({ account })}
                value={config.account ?? ""}
              />
              <Field
                label="Custom label"
                onChange={(displayText) => updateConfig({ displayText })}
                value={config.displayText ?? ""}
              />
            </>
          ) : null}
          {selected.type === "location" ? (
            <>
              <Field
                label="Place name"
                onChange={(locationName) => updateConfig({ locationName })}
                value={config.locationName ?? ""}
              />
              <div className="story-editor-text-control-grid">
                <Field
                  label="Latitude"
                  max={90}
                  min={-90}
                  onChange={(latitude) =>
                    updateConfig({ latitude: latitude ? Number(latitude) : undefined })
                  }
                  type="number"
                  value={String(config.latitude ?? 37.7749)}
                />
                <Field
                  label="Longitude"
                  max={180}
                  min={-180}
                  onChange={(longitude) =>
                    updateConfig({ longitude: longitude ? Number(longitude) : undefined })
                  }
                  type="number"
                  value={String(config.longitude ?? -122.4194)}
                />
              </div>
              <div aria-label="Location map preview" className="story-editor-location-map">
                <span />
                <strong>{config.locationName || "Location preview"}</strong>
                <small>
                  {Number(config.latitude ?? 37.7749).toFixed(4)},{" "}
                  {Number(config.longitude ?? -122.4194).toFixed(4)}
                </small>
              </div>
            </>
          ) : null}
          {selected.type === "emoji" ? (
            <Field
              label="Emoji"
              onChange={(emoji) => updateContent(emoji)}
              value={selected.content}
            />
          ) : null}
          {selected.type === "custom" && config.assetUrl ? (
            <img
              alt="Custom sticker preview"
              className="story-editor-custom-sticker-preview"
              src={config.assetUrl}
            />
          ) : null}
          <details className="story-editor-tool-section" open>
            <summary>Animation</summary>
            <label className="story-editor-select">
              <span>Effect</span>
              <select
                value={config.animation ?? "none"}
                onChange={(event) =>
                  updateConfig({ animation: event.target.value as StoryTextAnimation | "spin" })
                }
              >
                {stickerAnimations.map((animation) => (
                  <option key={animation.value} value={animation.value}>
                    {animation.label}
                  </option>
                ))}
              </select>
            </label>
            <Range
              label="Start time"
              max={14.9}
              min={0}
              onChange={(animationStartAt) => updateConfig({ animationStartAt })}
              suffix="s"
              value={config.animationStartAt ?? 0}
            />
            <Range
              label="Duration"
              max={3}
              min={0.1}
              onChange={(animationDuration) => updateConfig({ animationDuration })}
              suffix="s"
              value={config.animationDuration ?? 0.7}
            />
            <Range
              label="Delay"
              max={5}
              min={0}
              onChange={(animationDelay) => updateConfig({ animationDelay })}
              suffix="s"
              value={config.animationDelay ?? 0}
            />
            <label className="story-editor-check">
              <input
                type="checkbox"
                checked={config.animationLoop ?? false}
                onChange={(event) => updateConfig({ animationLoop: event.target.checked })}
              />
              Loop animation
            </label>
          </details>
          <div className="story-editor-sticker-placement">
            <Range
              label="Horizontal position"
              max={100}
              min={0}
              onChange={(x) => onUpdate(selected.id, { x: x / 100 })}
              suffix="%"
              value={Math.round(selected.x * 100)}
            />
            <Range
              label="Vertical position"
              max={100}
              min={0}
              onChange={(y) => onUpdate(selected.id, { y: y / 100 })}
              suffix="%"
              value={Math.round(selected.y * 100)}
            />
            <Range
              label="Size"
              max={3}
              min={0.4}
              onChange={(scale) => onUpdate(selected.id, { scale })}
              suffix="×"
              value={selected.scale}
            />
            <Range
              label="Rotation"
              max={180}
              min={-180}
              onChange={(rotation) => onUpdate(selected.id, { rotation })}
              suffix="°"
              value={selected.rotation}
            />
          </div>
          <button
            className="story-editor-danger-button"
            onClick={() => onDelete(selected.id)}
            type="button"
          >
            <Trash2 size={14} /> Remove sticker
          </button>
        </details>
      ) : null}
    </section>
  );
}
