import {
  Clapperboard,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Repeat2,
  Scan,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  drawReelFrame,
  prepareReelAssets,
  type ReelRenderAsset,
} from "../../lib/reel-editor/frame-renderer.ts";
import { activeClipAt, clipSourceAt, projectDuration } from "../../lib/reel-editor/timeline.ts";
import type { ReelProject, ReelSticker, ReelTextOverlay } from "../../lib/reel-editor/types.ts";
import type { ReelSelection } from "./types.ts";

const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = Math.floor(safe % 60);
  const frames = Math.floor((safe % 1) * 30);
  return `${minutes}:${String(rest).padStart(2, "0")}.${String(frames).padStart(2, "0")}`;
};

const clampUnit = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Mirrors the renderer's text layout so selection outlines and hit tests land
 * exactly where the drawn glyphs are.
 */
function measureTextBox(
  context: CanvasRenderingContext2D,
  project: ReelProject,
  overlay: ReelTextOverlay,
): TextBox {
  const fontSize = overlay.fontSize * (project.width / 1080);
  const boxWidth = Math.max(24, overlay.width * project.width);
  const content = overlay.uppercase ? overlay.text.toLocaleUpperCase() : overlay.text;
  context.save();
  context.font = `${overlay.fontWeight} ${fontSize}px "${overlay.fontFamily}", sans-serif`;
  const words = content.split(/\s+/).filter(Boolean);
  let lines = 1;
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= boxWidth) current = candidate;
    else {
      lines += 1;
      current = word;
    }
  }
  if (!words.length) lines = 1;
  context.restore();
  return {
    x: overlay.x * project.width,
    y: overlay.y * project.height,
    width: boxWidth,
    height: lines * fontSize * overlay.lineHeight,
  };
}

function stickerBox(context: CanvasRenderingContext2D, project: ReelProject, sticker: ReelSticker) {
  return {
    cx: sticker.x * project.width,
    cy: sticker.y * project.height,
    size: Math.max(48, project.width * 0.18 * sticker.scale),
  };
}

/** Preview-only selection chrome; never part of an export. */
function drawSelection(
  context: CanvasRenderingContext2D,
  project: ReelProject,
  selection: ReelSelection,
  time: number,
): void {
  const gold = "#d6ad60";
  const line = Math.max(2, project.width / 360);
  const handle = Math.max(8, project.width / 90);
  if (selection.kind === "text") {
    const overlay = project.texts.find(
      (item) => item.id === selection.id && time >= item.startSeconds && time <= item.endSeconds,
    );
    if (!overlay) return;
    const box = measureTextBox(context, project, overlay);
    context.save();
    context.strokeStyle = gold;
    context.lineWidth = line;
    context.strokeRect(box.x - 6, box.y - 6, box.width + 12, box.height + 12);
    context.fillStyle = gold;
    context.beginPath();
    context.arc(box.x + box.width + 6, box.y + box.height + 6, handle / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  if (selection.kind === "sticker") {
    const sticker = project.stickers.find(
      (item) => item.id === selection.id && time >= item.startSeconds && time <= item.endSeconds,
    );
    if (!sticker) return;
    const box = stickerBox(context, project, sticker);
    context.save();
    context.translate(box.cx, box.cy);
    context.rotate((sticker.rotation * Math.PI) / 180);
    context.strokeStyle = gold;
    context.lineWidth = line;
    context.strokeRect(-box.size / 2 - 6, -box.size / 2 - 6, box.size + 12, box.size + 12);
    context.fillStyle = gold;
    context.beginPath();
    context.arc(box.size / 2 + 6, box.size / 2 + 6, handle / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

export interface ReelCanvasProps {
  project: ReelProject;
  timeRef: React.RefObject<number>;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  onSeek: (seconds: number) => void;
  onTimeTick: (seconds: number) => void;
  playheadRef: React.RefObject<HTMLDivElement | null>;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  selection: ReelSelection;
  onSelect: (selection: ReelSelection) => void;
  /** Live updates while dragging; history is recorded once per gesture. */
  onPreview: (updater: ReelProject | ((current: ReelProject) => ReelProject)) => void;
  onBeginTransaction: () => void;
  showSafeZones: boolean;
  onToggleSafeZones: () => void;
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
  /** Reactive playhead position so paused seeks repaint immediately. */
  currentTime: number;
  seekRevision: React.RefObject<number>;
}

export default function ReelCanvas({
  project,
  timeRef,
  playing,
  onPlayingChange,
  onSeek,
  onTimeTick,
  playheadRef,
  muted,
  onMutedChange,
  selection,
  onSelect,
  onPreview,
  onBeginTransaction,
  showSafeZones,
  onToggleSafeZones,
  loop,
  onLoopChange,
  currentTime,
  seekRevision,
}: ReelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const regionRef = useRef<HTMLElement>(null);
  const transportRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const region = regionRef.current;
    const transport = transportRef.current;
    if (!region || !transport) return;
    const fit = () => {
      const availableHeight = Math.max(80, region.clientHeight - transport.offsetHeight - 26);
      const ratio = project.width / project.height;
      const width = Math.min(region.clientWidth - 4, availableHeight * ratio);
      setStageSize({ width, height: width / ratio });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(region);
    observer.observe(transport);
    fit();
    return () => observer.disconnect();
  }, [project.width, project.height]);
  const assetsRef = useRef<Map<string, ReelRenderAsset>>(new Map());
  // The frame renderer intentionally contains images and videos only. Music
  // requires separate media elements synchronized to the same playhead.
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const projectRef = useRef(project);
  const activeClipRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const startTimeRef = useRef(0);
  const lastReportRef = useRef(0);
  const loopRef = useRef(loop);
  const gestureRef = useRef<{
    kind: "text" | "sticker";
    id: string;
    mode: "move" | "resize";
    startNx: number;
    startNy: number;
    originX: number;
    originY: number;
    originWidth: number;
    originScale: number;
    didTransaction: boolean;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [assetError, setAssetError] = useState("");
  const [audioError, setAudioError] = useState("");
  const audioPending = useRef(new Set<HTMLAudioElement>());
  const audioHostRef = useRef<HTMLDivElement>(null);
  const [assetRevision, setAssetRevision] = useState(0);
  const duration = projectDuration(project);
  projectRef.current = project;
  loopRef.current = loop;

  const assetKey = Object.keys(project.assets).sort().join(",");
  const audioKey = project.audio
    .map((clip) => `${clip.id}:${clip.assetId}:${project.assets[clip.assetId]?.url ?? ""}`)
    .join("|");

  useEffect(() => {
    const elements = new Map<string, HTMLAudioElement>();
    for (const clip of projectRef.current.audio) {
      const asset = projectRef.current.assets[clip.assetId];
      if (!asset?.url) continue;
      const element = new Audio(asset.url);
      element.preload = "auto";
      audioHostRef.current?.append(element);
      elements.set(clip.id, element);
    }
    audioElementsRef.current = elements;
    return () => {
      for (const element of elements.values()) {
        element.pause();
        element.removeAttribute("src");
        element.load();
        element.remove();
      }
      if (audioElementsRef.current === elements) audioElementsRef.current = new Map();
    };
  }, [audioKey]);

  useEffect(() => {
    let cancelled = false;
    let loaded: Map<string, ReelRenderAsset> | null = null;
    const release = (assets: Map<string, ReelRenderAsset>) => {
      for (const asset of assets.values())
        if (asset instanceof HTMLVideoElement) {
          asset.pause();
          asset.removeAttribute("src");
          asset.load();
        }
    };
    setReady(false);
    setAssetError("");
    // Only the asset set is watched here. Reloading the media on every project
    // edit would restart the video elements and blank the preview.
    void prepareReelAssets(projectRef.current)
      .then((assets) => {
        loaded = assets;
        if (cancelled) {
          release(assets);
          return;
        }
        assetsRef.current = assets;
        activeClipRef.current = null;
        setReady(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setAssetError(error instanceof Error ? error.message : "Your media could not be loaded.");
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
      if (loaded) release(loaded);
    };
  }, [assetKey, assetRevision]);

  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      // The timeline end is exclusive. Hold the last frame when playback finishes.
      const end = projectDuration(project);
      const frameTime = end > 0 && time >= end ? Math.max(0, end - 0.001) : time;
      drawReelFrame(context, project, assetsRef.current, frameTime, { showSafeZones });
      drawSelection(context, project, selection, frameTime);
    },
    [project, selection, showSafeZones],
  );

  const syncMedia = useCallback(
    (time: number) => {
      const clip = activeClipAt(project, time);
      const clipId = clip?.id ?? null;
      const assets = assetsRef.current;
      for (const asset of project.clips) {
        const element = assets.get(asset.assetId);
        if (!(element instanceof HTMLVideoElement)) continue;
        const isActiveClip = Boolean(clip && clipId && asset.id === clip.id);
        if (isActiveClip && clip) {
          if (activeClipRef.current !== clipId) {
            activeClipRef.current = clipId;
            element.playbackRate = clip.playbackRate;
            element.muted = muted;
          }
          element.muted = muted;
          // Keep the element locked to the timeline: corrects paused seeks and
          // resyncs playback drift instead of trusting the element's own clock.
          const expected =
            clip.sourceIn + (timeRef.current - clip.startSeconds) * clip.playbackRate;
          if (
            timeRef.current >= clip.startSeconds &&
            timeRef.current <=
              clip.startSeconds + (clip.sourceOut - clip.sourceIn) / clip.playbackRate &&
            Math.abs(element.currentTime - expected) > 0.12
          ) {
            try {
              element.currentTime = Math.max(0, expected);
            } catch {
              /* the element settles on its next frame */
            }
          }
          if (playing && element.paused) void element.play().catch(() => undefined);
          if (!playing && !element.paused) element.pause();
        } else if (element !== (clip ? assets.get(clip.assetId) : undefined) && !element.paused) {
          element.pause();
        }
      }
    },
    [muted, playing, project],
  );

  const syncAudio = useCallback(
    (time: number) => {
      const current = projectRef.current;
      for (const clip of current.audio) {
        const element = audioElementsRef.current.get(clip.id);
        if (!element) continue;
        const length = Math.max(0, clip.sourceOut - clip.sourceIn);
        const offset = time - clip.startSeconds;
        const active =
          playing && !muted && offset >= 0 && offset < length && time < projectDuration(current);
        const expected = Math.max(
          clip.sourceIn,
          Math.min(clip.sourceOut, clip.sourceIn + Math.max(0, offset)),
        );
        if (Number.isFinite(expected) && Math.abs(element.currentTime - expected) > 0.18) {
          try {
            element.currentTime = expected;
          } catch {
            /* Media may still be loading. */
          }
        }
        if (!active) {
          if (!element.paused) element.pause();
          continue;
        }
        const fadeIn = clip.fadeInSeconds > 0 ? Math.min(1, offset / clip.fadeInSeconds) : 1;
        const fadeOut =
          clip.fadeOutSeconds > 0 ? Math.min(1, (length - offset) / clip.fadeOutSeconds) : 1;
        element.volume = Math.max(0, Math.min(1, clip.volume * fadeIn * fadeOut));
        if (Math.abs(element.currentTime - expected) > 0.18) {
          try {
            element.currentTime = expected;
          } catch {
            /* media loads asynchronously */
          }
        }
        if (element.paused && !audioPending.current.has(element)) {
          audioPending.current.add(element);
          void element
            .play()
            .catch((cause) => {
              if (cause?.name === "AbortError") return;
              setAudioError(
                "Music could not play. Tap Play to enable audio, or check the selected track.",
              );
              onPlayingChange(false);
            })
            .finally(() => audioPending.current.delete(element));
        }
      }
    },
    [muted, onPlayingChange, playing],
  );

  useEffect(() => {
    if (!playing) {
      activeClipRef.current = null;
      draw(timeRef.current);
      return;
    }
    if (!ready) return;
    startTimeRef.current = timeRef.current;
    startedAtRef.current = performance.now();
    let frame = 0;
    let lastSeekRevision = seekRevision.current;
    const tick = () => {
      const now = performance.now();
      const elapsed = (now - startedAtRef.current) / 1000;
      let time = startTimeRef.current + elapsed;
      // A seek while playing must establish a new playback-clock origin.
      // Without this, the next animation frame jumps back to the old timestamp.
      if (lastSeekRevision !== seekRevision.current) {
        lastSeekRevision = seekRevision.current;
        lastReportRef.current = -1;
        startTimeRef.current = timeRef.current;
        startedAtRef.current = now;
        time = timeRef.current;
      }
      if (time >= duration) {
        if (loopRef.current && duration > 0) {
          // Loop back to the start without dropping the play state.
          startTimeRef.current = 0;
          startedAtRef.current = performance.now();
          activeClipRef.current = null;
          timeRef.current = 0;
          syncAudio(0);
          onTimeTick(0);
          frame = window.requestAnimationFrame(tick);
          return;
        }
        timeRef.current = duration;
        syncAudio(duration);
        draw(duration);
        onTimeTick(duration);
        onPlayingChange(false);
        return;
      }
      timeRef.current = time;
      syncMedia(time);
      syncAudio(time);
      draw(time);
      const playhead = playheadRef.current;
      if (playhead) {
        const pixelsPerSecond = Number(playhead.dataset.pixelsPerSecond ?? 1) || 1;
        playhead.style.transform = `translateX(${time * pixelsPerSecond}px)`;
      }
      if (time - lastReportRef.current > 0.08) {
        lastReportRef.current = time;
        onTimeTick(time);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [
    draw,
    duration,
    onPlayingChange,
    onTimeTick,
    playheadRef,
    playing,
    ready,
    syncMedia,
    syncAudio,
    seekRevision,
    timeRef,
  ]);

  useEffect(() => {
    if (playing) return;
    syncMedia(timeRef.current);
    syncAudio(timeRef.current);
    draw(timeRef.current);
    onTimeTick(timeRef.current);
    // `currentTime` makes ruler/transport seeks repaint the paused frame.
  }, [currentTime, draw, playing, ready, syncMedia, syncAudio, timeRef, onTimeTick]);

  // A seek repaints the video element a frame later, so redraw when it lands.
  useEffect(() => {
    const assets = assetsRef.current;
    const detach: (() => void)[] = [];
    for (const asset of assets.values()) {
      if (!(asset instanceof HTMLVideoElement)) continue;
      const onSeeked = () => draw(timeRef.current);
      asset.addEventListener("seeked", onSeeked);
      detach.push(() => asset.removeEventListener("seeked", onSeeked));
    }
    return () => detach.forEach((off) => off());
  }, [draw, ready, timeRef]);

  const nudge = (delta: number) => {
    const next = Math.max(0, Math.min(duration, timeRef.current + delta));
    timeRef.current = next;
    onSeek(next);
    draw(next);
  };

  const normalizedPosition = (event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      nx: (event.clientX - rect.left) / rect.width,
      ny: (event.clientY - rect.top) / rect.height,
    };
  };

  /** Finds the overlay under the pointer; texts hit before stickers (drawn on top). */
  const hitTest = (context: CanvasRenderingContext2D, nx: number, ny: number) => {
    const px = nx * project.width;
    const py = ny * project.height;
    const time = timeRef.current;
    for (let index = project.texts.length - 1; index >= 0; index -= 1) {
      const overlay = project.texts[index];
      if (time < overlay.startSeconds || time > overlay.endSeconds || overlay.locked) continue;
      const box = measureTextBox(context, project, overlay);
      if (
        px < box.x - 8 ||
        px > box.x + box.width + 8 ||
        py < box.y - 8 ||
        py > box.y + box.height + 8
      )
        continue;
      const nearHandle =
        Math.abs(px - (box.x + box.width)) <= 18 && Math.abs(py - (box.y + box.height)) <= 18;
      return {
        kind: "text" as const,
        id: overlay.id,
        mode: (nearHandle ? "resize" : "move") as "move" | "resize",
        originX: overlay.x,
        originY: overlay.y,
        originWidth: overlay.width,
        originScale: 1,
      };
    }
    for (let index = project.stickers.length - 1; index >= 0; index -= 1) {
      const sticker = project.stickers[index];
      if (time < sticker.startSeconds || time > sticker.endSeconds || sticker.locked) continue;
      const box = stickerBox(context, project, sticker);
      const dx = px - box.cx;
      const dy = py - box.cy;
      const angle = (-sticker.rotation * Math.PI) / 180;
      const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
      const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
      if (Math.abs(lx) > box.size / 2 + 8 || Math.abs(ly) > box.size / 2 + 8) continue;
      const nearHandle = Math.abs(lx - box.size / 2) <= 18 && Math.abs(ly - box.size / 2) <= 18;
      return {
        kind: "sticker" as const,
        id: sticker.id,
        mode: (nearHandle ? "resize" : "move") as "move" | "resize",
        originX: sticker.x,
        originY: sticker.y,
        originWidth: 1,
        originScale: sticker.scale,
      };
    }
    return null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext("2d");
    const position = normalizedPosition(event);
    if (!context || !position) return;
    const hit = hitTest(context, position.nx, position.ny);
    if (!hit) {
      onSelect({ kind: "project", id: null });
      return;
    }
    onSelect({ kind: hit.kind, id: hit.id });
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      kind: hit.kind,
      id: hit.id,
      mode: hit.mode,
      startNx: position.nx,
      startNy: position.ny,
      originX: hit.originX,
      originY: hit.originY,
      originWidth: hit.originWidth,
      originScale: hit.originScale,
      didTransaction: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const gesture = gestureRef.current;
    const position = normalizedPosition(event);
    if (!gesture || !position) return;
    const dx = position.nx - gesture.startNx;
    const dy = position.ny - gesture.startNy;
    if (!gesture.didTransaction) {
      if (Math.abs(dx) + Math.abs(dy) <= 0.003) return;
      gesture.didTransaction = true;
      onBeginTransaction();
    }
    if (gesture.kind === "text") {
      onPreview((current) => ({
        ...current,
        texts: current.texts.map((overlay) => {
          if (overlay.id !== gesture.id) return overlay;
          if (gesture.mode === "resize") {
            return { ...overlay, width: clampUnit(gesture.originWidth + dx, 0.06, 1 - overlay.x) };
          }
          return {
            ...overlay,
            x: clampUnit(gesture.originX + dx, 0, Math.max(0, 1 - overlay.width)),
            y: clampUnit(gesture.originY + dy, 0, 0.95),
          };
        }),
      }));
      return;
    }
    onPreview((current) => ({
      ...current,
      stickers: current.stickers.map((sticker) => {
        if (sticker.id !== gesture.id) return sticker;
        if (gesture.mode === "resize") {
          return { ...sticker, scale: clampUnit(gesture.originScale + dx * 3, 0.3, 6) };
        }
        return {
          ...sticker,
          x: clampUnit(gesture.originX + dx, 0.02, 0.98),
          y: clampUnit(gesture.originY + dy, 0.02, 0.98),
        };
      }),
    }));
  };

  const handlePointerUp = () => {
    gestureRef.current = null;
  };

  return (
    <section ref={regionRef} className="reel-canvas-region" aria-label="Reel preview">
      <div ref={audioHostRef} hidden aria-hidden="true" />
      <div
        className="reel-stage"
        data-aspect={project.aspectRatio}
        style={stageSize.width ? stageSize : undefined}
      >
        <canvas
          ref={canvasRef}
          className="reel-stage-canvas"
          width={project.width}
          height={project.height}
          aria-label="Reel preview canvas"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {audioError && (
          <p className="reel-inline-error" role="alert">
            {audioError}
          </p>
        )}
        {assetError ? (
          <div className="reel-stage-empty" role="alert">
            <p>{assetError}</p>
            <button className="reel-button" onClick={() => setAssetRevision((value) => value + 1)}>
              <RefreshCw size={14} /> Retry media
            </button>
          </div>
        ) : !project.clips.length ? (
          <div className="reel-stage-empty">
            <Clapperboard size={31} strokeWidth={1.1} />
            <strong>Your next reel starts here.</strong>
            <p>Import your media, then add a clip to the timeline.</p>
            <span>9:16 · MADE FOR YOUR POINT OF VIEW</span>
          </div>
        ) : !ready ? (
          <p className="reel-stage-loading">Preparing your media…</p>
        ) : null}
      </div>
      <div ref={transportRef} className="reel-transport">
        <button
          type="button"
          className="reel-transport-button"
          onClick={() => {
            const next = 0;
            timeRef.current = next;
            onSeek(next);
            draw(next);
          }}
          aria-label="Go to the start"
        >
          <SkipBack size={15} />
        </button>
        <button
          type="button"
          className="reel-transport-button"
          onClick={() => nudge(-1 / 30)}
          aria-label="Previous frame"
        >
          <StepBack size={15} />
        </button>
        <button
          type="button"
          className="reel-transport-button reel-transport-play"
          onClick={() => {
            const time = timeRef.current >= duration ? 0 : timeRef.current;
            if (!playing && timeRef.current >= duration && duration > 0) onSeek(0);
            if (!playing && !muted) {
              setAudioError("");
              // Start audible media inside the user's click, before the RAF clock.
              for (const clip of projectRef.current.audio) {
                const element = audioElementsRef.current.get(clip.id);
                const offset = time - clip.startSeconds;
                if (!element || offset < 0 || offset >= clip.sourceOut - clip.sourceIn) continue;
                element.volume = Math.max(0, Math.min(1, clip.volume));
                try {
                  element.currentTime = clip.sourceIn + offset;
                } catch {
                  /* Metadata is loading. */
                }
                audioPending.current.add(element);
                void element
                  .play()
                  .catch((cause) => {
                    if (cause?.name !== "AbortError") {
                      setAudioError("Music could not play. Tap Play again to enable audio.");
                      onPlayingChange(false);
                    }
                  })
                  .finally(() => audioPending.current.delete(element));
              }
            }
            onPlayingChange(!playing);
          }}
          aria-label={
            playing ? "Pause" : currentTime >= duration && duration > 0 ? "Replay" : "Play"
          }
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button
          type="button"
          className="reel-transport-button"
          onClick={() => nudge(1 / 30)}
          aria-label="Next frame"
        >
          <StepForward size={15} />
        </button>
        <button
          type="button"
          className="reel-transport-button"
          aria-label="Go to the end"
          onClick={() => {
            onSeek(duration);
            onPlayingChange(false);
          }}
        >
          <SkipForward size={15} />
        </button>
        <button
          type="button"
          className="reel-transport-button"
          onClick={() => onMutedChange(!muted)}
          aria-label={muted ? "Unmute preview" : "Mute preview"}
          aria-pressed={!muted}
        >
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <button
          type="button"
          className="reel-transport-button"
          onClick={onToggleSafeZones}
          aria-label="Toggle safe-area guides"
          aria-pressed={showSafeZones}
          data-active={showSafeZones || undefined}
        >
          <Scan size={15} />
        </button>
        <button
          type="button"
          className="reel-transport-button"
          onClick={() => onLoopChange(!loop)}
          aria-label="Loop playback"
          aria-pressed={loop}
          data-active={loop || undefined}
        >
          <Repeat2 size={15} />
        </button>
        <span className="reel-transport-time">
          {formatTime(timeRef.current)} / {formatTime(duration)}
        </span>
      </div>
    </section>
  );
}
