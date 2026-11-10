import { useEffect, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, SyntheticEvent } from "react";
import type { StoryBrandOverlay, StoryStickerConfig, Sticker } from "../../lib/story-editor/types";
import type { StoryCanvasTransform } from "../../lib/story-editor/scene-engine.mjs";
import {
  getStoryTextAnimationFrame,
  getStoryTextAnimationState,
} from "../../lib/story-editor/text-tools.mjs";
import {
  getStoryCountdownParts,
  parseStoryStickerConfig,
} from "../../lib/story-editor/stickers.mjs";

interface StickerLayerProps {
  stickers: Sticker[];
  brand: StoryBrandOverlay;
  interactivePreview: boolean;
  editable?: boolean;
  selectedId?: string | null;
  animationPreviewActive?: boolean;
  elapsedSeconds?: number;
  transforms?: Record<string, StoryCanvasTransform>;
  zIndexById?: Record<string, number>;
  onObjectPointerDown?: (
    event: ReactPointerEvent<HTMLDivElement>,
    id: string,
    kind: "sticker",
  ) => void;
  onSelect?: (id: string, kind: "sticker") => void;
  onUpdate: (id: string, patch: Partial<Sticker>) => void;
}

function safeLink(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function updateConfig(
  sticker: Sticker,
  config: StoryStickerConfig,
  patch: Partial<StoryStickerConfig>,
) {
  return { ...sticker, config: JSON.stringify({ ...config, ...patch }) };
}

function StoryStickerView({
  sticker,
  interactivePreview,
  editable,
  selected,
  animationPreviewActive,
  elapsedSeconds,
  transform,
  zIndex,
  onObjectPointerDown,
  onSelect,
  onUpdate,
}: {
  sticker: Sticker;
  interactivePreview: boolean;
  editable: boolean;
  selected: boolean;
  animationPreviewActive: boolean;
  elapsedSeconds: number;
  transform?: StoryCanvasTransform;
  zIndex: number;
  onObjectPointerDown?: (
    event: ReactPointerEvent<HTMLDivElement>,
    id: string,
    kind: "sticker",
  ) => void;
  onSelect?: (id: string, kind: "sticker") => void;
  onUpdate: (patch: Partial<Sticker>) => void;
}) {
  const config = parseStoryStickerConfig(sticker.config);
  const animationState = animationPreviewActive
    ? getStoryTextAnimationState(
        config.animation ?? "none",
        elapsedSeconds,
        config.animationStartAt ?? 0,
        config.animationDuration ?? 0.7,
        config.animationDelay ?? 0,
        config.animationLoop ?? false,
      )
    : { visible: true, progress: 1 };
  const animationFrame = animationPreviewActive
    ? getStoryTextAnimationFrame(
        config.animation ?? "none",
        animationState.progress,
        sticker.rotation,
      )
    : { opacity: 1, x: 0, y: 0, scale: 1, rotation: sticker.rotation };
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (sticker.type !== "countdown" || !config.targetDate) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [config.targetDate, sticker.type]);
  const countdown =
    sticker.type === "countdown" ? getStoryCountdownParts(config.targetDate ?? "", now) : null;
  const options = config.options ?? [];
  const selectedOption = config.selectedOption ?? null;
  const votes = config.votes ?? options.map(() => 0);
  const totalVotes = votes.reduce((total, count) => total + count, 0);
  const url = sticker.type === "link" ? safeLink(config.url) : null;

  function stop(event: SyntheticEvent) {
    event.stopPropagation();
  }

  function chooseOption(index: number) {
    const nextVotes = [...votes];
    if (selectedOption === null) nextVotes[index] = (nextVotes[index] ?? 0) + 1;
    onUpdate(
      updateConfig(sticker, config, {
        votes: nextVotes,
        selectedOption: index,
      }),
    );
  }

  const wrapperStyle: CSSProperties = {
    left: `${transform ? (transform.x + transform.width / 2) * 100 : sticker.x * 100}%`,
    top: `${transform ? (transform.y + transform.height / 2) * 100 : sticker.y * 100}%`,
    zIndex,
    opacity: sticker.visible && animationState.visible ? animationFrame.opacity : 0,
    transform: `translate(-50%, -50%) translate(${animationFrame.x}px, ${animationFrame.y}px) scale(${Number(transform?.scale ?? sticker.scale) * animationFrame.scale}) rotate(${animationFrame.rotation}deg)`,
    pointerEvents: animationPreviewActive ? "none" : undefined,
  };

  return (
    <div
      aria-label={`${sticker.type} sticker`}
      className={`story-editor-canvas-sticker story-editor-canvas-sticker-${sticker.type}`}
      onClick={stop}
      onPointerDown={(event) => {
        if (editable) {
          onSelect?.(sticker.id, "sticker");
          onObjectPointerDown?.(event, sticker.id, "sticker");
        } else {
          stop(event);
        }
      }}
      onPointerUp={(event) => {
        if (!editable) stop(event);
      }}
      data-story-object-id={sticker.id}
      data-story-object-kind="sticker"
      data-selected={selected || undefined}
      style={wrapperStyle}
    >
      {sticker.type === "emoji" && config.assetUrl ? (
        <img
          alt={sticker.content}
          className="story-editor-canvas-custom-sticker"
          src={config.assetUrl}
        />
      ) : null}
      {sticker.type === "emoji" && !config.assetUrl ? (
        <span
          className="story-editor-canvas-library-emoji"
          style={{ color: config.color, background: config.background }}
        >
          {sticker.content}
        </span>
      ) : null}
      {sticker.type === "custom" && config.assetUrl ? (
        <img
          alt={sticker.content}
          className="story-editor-canvas-custom-sticker"
          src={config.assetUrl}
        />
      ) : null}
      {sticker.type === "poll" ? (
        <div className="story-editor-canvas-interaction">
          <strong>{sticker.content}</strong>
          {options.slice(0, 2).map((option, index) => {
            const percentage = totalVotes
              ? Math.round(((votes[index] ?? 0) / totalVotes) * 100)
              : 0;
            return (
              <button
                aria-pressed={selectedOption === index}
                disabled={!interactivePreview}
                key={`${option}-${index}`}
                onClick={() => chooseOption(index)}
                type="button"
              >
                <span
                  style={{ width: config.showResults && totalVotes ? `${percentage}%` : undefined }}
                />
                <b>{option}</b>
                {config.showResults && totalVotes ? <small>{percentage}%</small> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {sticker.type === "question" ? (
        <label className="story-editor-canvas-interaction story-editor-canvas-question">
          <strong>{sticker.content}</strong>
          <input
            onChange={stop}
            onPointerDown={stop}
            placeholder="Type your answer…"
            readOnly={!interactivePreview}
          />
        </label>
      ) : null}
      {sticker.type === "quiz" ? (
        <div className="story-editor-canvas-interaction">
          <strong>{sticker.content}</strong>
          {options.map((option, index) => (
            <button
              aria-pressed={selectedOption === index}
              className={
                selectedOption === index
                  ? index === config.correctAnswer
                    ? "is-correct"
                    : "is-incorrect"
                  : ""
              }
              disabled={!interactivePreview}
              key={`${option}-${index}`}
              onClick={() => chooseOption(index)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
      {sticker.type === "slider" ? (
        <label className="story-editor-canvas-interaction story-editor-canvas-slider">
          <strong>{sticker.content}</strong>
          <span>
            <i>{config.emoji ?? config.reaction ?? "😍"}</i>
            {config.reactionText ? <b>{config.reactionText}</b> : null}
            <input
              aria-label="React with slider"
              disabled={!interactivePreview}
              max={100}
              min={0}
              onChange={(event) =>
                onUpdate(updateConfig(sticker, config, { reaction: event.target.value }))
              }
              onPointerDown={stop}
              type="range"
              value={Number(config.reaction) || 50}
            />
          </span>
        </label>
      ) : null}
      {sticker.type === "link" ? (
        <a
          aria-disabled={!interactivePreview}
          className="story-editor-canvas-link"
          href={interactivePreview ? (url ?? undefined) : undefined}
          onClick={stop}
          rel="noreferrer"
          target="_blank"
        >
          <span>↗</span>
          <strong>{config.displayText || sticker.content}</strong>
        </a>
      ) : null}
      {sticker.type === "countdown" ? (
        <div className="story-editor-canvas-interaction story-editor-canvas-countdown">
          <strong>{sticker.content}</strong>
          <span>
            {countdown
              ? countdown.complete
                ? "It’s time!"
                : `${countdown.days}d ${String(countdown.hours).padStart(2, "0")}h ${String(countdown.minutes).padStart(2, "0")}m ${String(countdown.seconds).padStart(2, "0")}s`
              : "Set a date"}
          </span>
        </div>
      ) : null}
      {sticker.type === "music" ? (
        <div className="story-editor-canvas-music">
          <span aria-hidden="true">♫</span>
          <div>
            <strong>{config.title || "Song title"}</strong>
            <small>{config.artist || "Artist"}</small>
          </div>
          <small>{config.volume ?? 80}%</small>
        </div>
      ) : null}
      {sticker.type === "mention" ? (
        <div className="story-editor-canvas-mention">
          <span>{config.account || sticker.content}</span>
          {config.displayText ? <small>{config.displayText}</small> : null}
        </div>
      ) : null}
      {sticker.type === "location" ? (
        <div className="story-editor-canvas-location">
          <span aria-hidden="true">⌖</span>
          <div>
            <strong>{config.locationName || sticker.content}</strong>
            <small>LOCATION</small>
          </div>
          <i className="story-editor-location-map">
            <b />
          </i>
        </div>
      ) : null}
      {sticker.type === "hashtag" ? (
        <div className="story-editor-canvas-hashtag">{sticker.content}</div>
      ) : null}
    </div>
  );
}

export function StickerLayer({
  stickers,
  brand,
  interactivePreview,
  editable = false,
  selectedId = null,
  animationPreviewActive = false,
  elapsedSeconds = 0,
  transforms = {},
  zIndexById = {},
  onObjectPointerDown,
  onSelect,
  onUpdate,
}: StickerLayerProps) {
  return (
    <>
      {stickers
        .filter((sticker) => sticker.visible)
        .map((sticker) => (
          <StoryStickerView
            key={sticker.id}
            interactivePreview={interactivePreview}
            editable={editable}
            selected={selectedId === sticker.id}
            animationPreviewActive={animationPreviewActive}
            elapsedSeconds={elapsedSeconds}
            transform={transforms[sticker.id]}
            zIndex={zIndexById[sticker.id] ?? sticker.zIndex}
            onObjectPointerDown={onObjectPointerDown}
            onSelect={onSelect}
            onUpdate={(patch) => onUpdate(sticker.id, patch)}
            sticker={sticker}
          />
        ))}
      {brand.logoUrl ? (
        <img
          alt="Brand logo"
          className="story-editor-brand-logo"
          src={brand.logoUrl}
          style={{
            left: `${brand.logoX * 100}%`,
            top: `${brand.logoY * 100}%`,
            opacity: brand.logoOpacity,
            transform: `translate(-50%, -50%) scale(${brand.logoScale})`,
          }}
        />
      ) : null}
      {brand.watermarkText ? (
        <span className="story-editor-watermark" style={{ opacity: brand.watermarkOpacity }}>
          {brand.watermarkText}
        </span>
      ) : null}
    </>
  );
}
