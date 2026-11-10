import { Maximize2, Magnet, Scissors, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  clipDuration,
  clipEnd,
  moveClip,
  projectDuration,
  snapTime,
  trimClipEnd,
  trimClipStart,
} from "../../lib/reel-editor/timeline.ts";
import type { ReelProject } from "../../lib/reel-editor/types.ts";
import type { ReelSelection } from "./types.ts";

type DragMode = "move" | "trim-in" | "trim-out";

interface DragState {
  mode: DragMode;
  kind: "clip" | "text" | "sticker" | "caption" | "audio";
  id: string;
  startX: number;
  scrollStart: number;
  originStart: number;
  originEnd: number;
}

export interface ReelTimelineProps {
  project: ReelProject;
  timeRef: React.RefObject<number>;
  playheadRef: React.RefObject<HTMLDivElement | null>;
  selection: ReelSelection;
  pixelsPerSecond: number;
  currentTime: number;
  onSelect: (selection: ReelSelection) => void;
  onSeek: (seconds: number) => void;
  onPreview: (updater: ReelProject | ((current: ReelProject) => ReelProject)) => void;
  onBeginTransaction: () => void;
  /** Splits the selected clip at the playhead. */
  onSplit: () => void;
  /** Deletes the current selection. */
  onDelete: () => void;
}

const formatRulerTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
};

export default function ReelTimeline({
  project,
  timeRef,
  playheadRef,
  selection,
  pixelsPerSecond,
  currentTime,
  onSelect,
  onSeek,
  onPreview,
  onBeginTransaction,
  onSplit,
  onDelete,
}: ReelTimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [snapOn, setSnapOn] = useState(true);
  const dragRef = useRef<DragState | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const duration = projectDuration(project);
  const scale = pixelsPerSecond * zoom;
  const width = Math.max(duration, 1) * scale + 24;
  const safeTime = Math.max(0, Math.min(duration, Number.isFinite(currentTime) ? currentTime : 0));

  const seekTo = useCallback(
    (seconds: number, reveal = false) => {
      const next = Math.max(0, Math.min(duration, Number.isFinite(seconds) ? seconds : 0));
      timeRef.current = next;
      onSeek(next);
      if (reveal && trackRef.current) {
        trackRef.current.scrollLeft = Math.max(0, next * scale - trackRef.current.clientWidth / 2);
      }
    },
    [duration, onSeek, scale, timeRef],
  );

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const seconds = (clientX - rect.left + track.scrollLeft) / scale;
      seekTo(seconds);
    },
    [scale, seekTo],
  );

  const startDrag = (
    event: React.PointerEvent<HTMLElement>,
    kind: DragState["kind"],
    id: string,
    mode: DragMode,
    originStart: number,
    originEnd: number,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect({ kind, id } as ReelSelection);
    onBeginTransaction();
    dragRef.current = {
      mode,
      kind,
      id,
      startX: event.clientX,
      scrollStart: trackRef.current?.scrollLeft ?? 0,
      originStart,
      originEnd,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const track = trackRef.current;
    if (track) {
      const bounds = track.getBoundingClientRect();
      if (event.clientX < bounds.left + 36) track.scrollLeft = Math.max(0, track.scrollLeft - 12);
      if (event.clientX > bounds.right - 36) track.scrollLeft += 12;
    }
    const delta =
      (event.clientX - drag.startX + (track?.scrollLeft ?? 0) - drag.scrollStart) / scale;
    if (drag.kind === "clip") {
      if (drag.mode === "move") {
        onPreview((current) => {
          const target = Math.max(0, drag.originStart + delta);
          const snapped = snapOn ? snapTime(current, target, 8 / scale) : target;
          return moveClip(current, drag.id, snapped);
        });
      } else if (drag.mode === "trim-in") {
        onPreview((current) => trimClipStart(current, drag.id, drag.originStart + delta));
      } else {
        onPreview((current) => trimClipEnd(current, drag.id, drag.originEnd + delta));
      }
      return;
    }
    const next = Math.max(0, drag.originStart + delta);
    onPreview((current) => {
      if (drag.kind === "text") {
        return {
          ...current,
          texts: current.texts.map((item) =>
            item.id === drag.id
              ? {
                  ...item,
                  startSeconds: next,
                  endSeconds: next + (drag.originEnd - drag.originStart),
                }
              : item,
          ),
        };
      }
      if (drag.kind === "sticker") {
        return {
          ...current,
          stickers: current.stickers.map((item) =>
            item.id === drag.id
              ? {
                  ...item,
                  startSeconds: next,
                  endSeconds: next + (drag.originEnd - drag.originStart),
                }
              : item,
          ),
        };
      }
      if (drag.kind === "caption") {
        return {
          ...current,
          captions: current.captions.map((item) =>
            item.id === drag.id
              ? {
                  ...item,
                  startSeconds: next,
                  endSeconds: next + (drag.originEnd - drag.originStart),
                }
              : item,
          ),
        };
      }
      return {
        ...current,
        audio: current.audio.map((item) =>
          item.id === drag.id ? { ...item, startSeconds: next } : item,
        ),
      };
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const ticks: number[] = [];
  const step = scale > 90 ? 1 : scale > 45 ? 2 : 5;
  for (let second = 0; second <= duration; second += step) ticks.push(second);
  if (duration > 0 && ticks.at(-1) !== duration) ticks.push(duration);

  return (
    <section className="reel-timeline" aria-label="Reel timeline">
      <header className="reel-timeline-toolbar">
        <span className="reel-timeline-title">Timeline</span>
        <span className="reel-timeline-duration">
          {formatRulerTime(safeTime)} / {formatRulerTime(duration)}
        </span>
        <span className="reel-timeline-spacer" />
        <button
          type="button"
          className="reel-icon-button"
          onClick={() => setZoom((value) => Math.max(0.35, value - 0.25))}
          aria-label="Zoom out the timeline"
        >
          −
        </button>
        <span className="reel-timeline-zoom">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="reel-icon-button"
          onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
          aria-label="Zoom in the timeline"
        >
          +
        </button>
        <button
          type="button"
          className="reel-icon-button"
          onClick={() => {
            const track = trackRef.current;
            if (!track || duration <= 0) return;
            setZoom(
              Math.min(3, Math.max(0.35, (track.clientWidth - 56) / (duration * pixelsPerSecond))),
            );
          }}
          aria-label="Fit all clips to the timeline"
        >
          <Maximize2 size={14} />
        </button>
        <button
          type="button"
          className="reel-icon-button"
          onClick={() => setSnapOn((value) => !value)}
          aria-pressed={snapOn}
          aria-label="Toggle snapping"
          data-active={snapOn || undefined}
        >
          <Magnet size={14} />
        </button>
        <button
          type="button"
          className="reel-icon-button"
          onClick={onSplit}
          disabled={selection.kind !== "clip"}
          aria-label="Split the selected clip at the playhead"
        >
          <Scissors size={14} />
        </button>
        <button
          type="button"
          className="reel-icon-button"
          onClick={onDelete}
          disabled={selection.kind === "project"}
          aria-label="Delete the selection"
        >
          <Trash2 size={14} />
        </button>
      </header>

      <div className="reel-timeline-quickseek">
        <label htmlFor="reel-timeline-scrubber">Scrub to any moment</label>
        <input
          id="reel-timeline-scrubber"
          type="range"
          min={0}
          max={Math.max(duration, 0.01)}
          step={0.01}
          value={safeTime}
          disabled={duration <= 0}
          onChange={(event) => seekTo(Number(event.target.value), true)}
          aria-valuetext={formatRulerTime(safeTime)}
        />
        <label className="reel-timestamp-jump">
          <span>Second</span>
          <input
            aria-label="Jump to exact timeline second"
            type="number"
            inputMode="decimal"
            min={0}
            max={duration}
            step={0.1}
            value={Number(safeTime.toFixed(1))}
            onChange={(event) => seekTo(Number(event.target.value), true)}
          />
        </label>
      </div>

      <div
        className="reel-timeline-scroll"
        ref={trackRef}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="reel-timeline-content" style={{ width }}>
          <div
            className="reel-timeline-ruler"
            onPointerDown={(event) => {
              seekFromEvent(event.clientX);
            }}
          >
            {ticks.map((second) => (
              <span key={second} className="reel-timeline-tick" style={{ left: second * scale }}>
                {formatRulerTime(second)}
              </span>
            ))}
          </div>

          <div className="reel-track reel-track-video">
            <span className="reel-track-label">Video</span>
            <div className="reel-track-lane">
              {project.clips.map((clip) => {
                const asset = project.assets[clip.assetId];
                const left = clip.startSeconds * scale;
                const width = Math.max(24, clipDuration(clip) * scale);
                const isSelected = selection.kind === "clip" && selection.id === clip.id;
                return (
                  <div
                    key={clip.id}
                    className={`reel-clip${isSelected ? " is-selected" : ""}`}
                    style={{ left, width }}
                    onPointerDown={(event) =>
                      startDrag(event, "clip", clip.id, "move", clip.startSeconds, clipEnd(clip))
                    }
                  >
                    <span
                      className="reel-clip-handle reel-clip-handle-in"
                      role="slider"
                      tabIndex={0}
                      aria-label={`Trim in point of ${asset?.name ?? "clip"}`}
                      aria-valuemin={0}
                      aria-valuemax={asset?.durationSeconds ?? clip.sourceOut}
                      aria-valuenow={clip.sourceIn}
                      onKeyDown={(event) => {
                        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                        event.preventDefault();
                        onBeginTransaction();
                        const delta =
                          (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 1 : 0.1);
                        onPreview((current) =>
                          trimClipStart(current, clip.id, clip.startSeconds + delta),
                        );
                      }}
                      onPointerDown={(event) =>
                        startDrag(
                          event,
                          "clip",
                          clip.id,
                          "trim-in",
                          clip.startSeconds,
                          clipEnd(clip),
                        )
                      }
                    />
                    <span className="reel-clip-name">{asset?.name ?? "Clip"}</span>
                    <span className="reel-clip-detail">
                      {clip.playbackRate !== 1 ? `${clip.playbackRate}×` : ""}
                      {clip.sourceIn > 0 || clip.sourceOut < (asset?.durationSeconds ?? 0)
                        ? ` ${clip.sourceIn.toFixed(1)}–${clip.sourceOut.toFixed(1)}s`
                        : ""}
                    </span>
                    <span
                      className="reel-clip-handle reel-clip-handle-out"
                      role="slider"
                      tabIndex={0}
                      aria-label={`Trim out point of ${asset?.name ?? "clip"}`}
                      aria-valuemin={0}
                      aria-valuemax={asset?.durationSeconds ?? clip.sourceOut}
                      aria-valuenow={clip.sourceOut}
                      onKeyDown={(event) => {
                        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                        event.preventDefault();
                        onBeginTransaction();
                        const delta =
                          (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 1 : 0.1);
                        onPreview((current) =>
                          trimClipEnd(current, clip.id, clipEnd(clip) + delta),
                        );
                      }}
                      onPointerDown={(event) =>
                        startDrag(
                          event,
                          "clip",
                          clip.id,
                          "trim-out",
                          clip.startSeconds,
                          clipEnd(clip),
                        )
                      }
                    />
                  </div>
                );
              })}
              {project.clips.length ? null : (
                <p className="reel-track-empty">Import a video and add it to the timeline.</p>
              )}
            </div>
          </div>

          <div className="reel-track reel-track-overlay">
            <span className="reel-track-label">Overlays</span>
            <div className="reel-track-lane">
              {project.texts.map((overlay) => (
                <div
                  key={overlay.id}
                  className={`reel-block${
                    selection.kind === "text" && selection.id === overlay.id ? " is-selected" : ""
                  }`}
                  style={{
                    left: overlay.startSeconds * scale,
                    width: Math.max(24, (overlay.endSeconds - overlay.startSeconds) * scale),
                  }}
                  onPointerDown={(event) =>
                    startDrag(
                      event,
                      "text",
                      overlay.id,
                      "move",
                      overlay.startSeconds,
                      overlay.endSeconds,
                    )
                  }
                >
                  <span className="reel-block-name">Text · {overlay.text.slice(0, 18)}</span>
                </div>
              ))}
              {project.stickers.map((sticker) => (
                <div
                  key={sticker.id}
                  className={`reel-block${
                    selection.kind === "sticker" && selection.id === sticker.id
                      ? " is-selected"
                      : ""
                  }`}
                  style={{
                    left: sticker.startSeconds * scale,
                    width: Math.max(24, (sticker.endSeconds - sticker.startSeconds) * scale),
                  }}
                  onPointerDown={(event) =>
                    startDrag(
                      event,
                      "sticker",
                      sticker.id,
                      "move",
                      sticker.startSeconds,
                      sticker.endSeconds,
                    )
                  }
                >
                  <span className="reel-block-name">Sticker {sticker.glyph ?? ""}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="reel-track reel-track-caption">
            <span className="reel-track-label">Captions</span>
            <div className="reel-track-lane">
              {project.captions.map((caption) => (
                <div
                  key={caption.id}
                  className={`reel-block${
                    selection.kind === "caption" && selection.id === caption.id
                      ? " is-selected"
                      : ""
                  }`}
                  style={{
                    left: caption.startSeconds * scale,
                    width: Math.max(24, (caption.endSeconds - caption.startSeconds) * scale),
                  }}
                  onPointerDown={(event) =>
                    startDrag(
                      event,
                      "caption",
                      caption.id,
                      "move",
                      caption.startSeconds,
                      caption.endSeconds,
                    )
                  }
                >
                  <span className="reel-block-name">{caption.text.slice(0, 22)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="reel-track reel-track-audio">
            <span className="reel-track-label">Audio</span>
            <div className="reel-track-lane">
              {project.audio.map((clip) => {
                const asset = project.assets[clip.assetId];
                return (
                  <div
                    key={clip.id}
                    className={`reel-block reel-block-audio${
                      selection.kind === "audio" && selection.id === clip.id ? " is-selected" : ""
                    }`}
                    style={{
                      left: clip.startSeconds * scale,
                      width: Math.max(24, (clip.sourceOut - clip.sourceIn) * scale),
                    }}
                    onPointerDown={(event) =>
                      startDrag(
                        event,
                        "audio",
                        clip.id,
                        "move",
                        clip.startSeconds,
                        clip.sourceOut - clip.sourceIn,
                      )
                    }
                  >
                    <span className="reel-block-name">{asset?.name ?? "Track"}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="reel-playhead"
            ref={playheadRef}
            data-pixels-per-second={scale}
            style={{ transform: `translateX(${timeRef.current * scale}px)` }}
            onPointerDown={(event) => {
              event.stopPropagation();
              seekFromEvent(event.clientX);
            }}
          >
            <span className="reel-playhead-cap" />
          </div>
        </div>
      </div>
    </section>
  );
}
