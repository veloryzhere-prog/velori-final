import { ChevronLeft, ChevronRight, MessageCircle, MoveUp, Pause, Play, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  Slide,
  StoryBrandOverlay,
  StoryStickerConfig,
  StorySlideMediaSettings,
  StoryTransitionType,
  StoryTextOverlay,
  StoryShape,
  Sticker,
} from "../../lib/story-editor/types";
import {
  moveStoryTransform,
  orderStoryObjects,
  resizeStoryTransform,
  rotateStoryTransform,
  storyCanvasPoint,
} from "../../lib/story-editor/scene-engine.mjs";
import type { StoryCanvasTransform } from "../../lib/story-editor/scene-engine.mjs";
import {
  getStoryAutoFontSize,
  getStoryTextAnimationFrame,
  getStoryTextAnimationState,
  getStoryTypewriterText,
} from "../../lib/story-editor/text-tools.mjs";
import { getStoryCollageGrid, getStoryMediaFilter } from "../../lib/story-editor/media-tools.mjs";
import { StickerLayer } from "./StickerLayer";
import StoryDrawingLayer from "./StoryDrawingLayer";
import StoryStickerObject from "./StoryStickerObject";
import type { StoryDrawingDocument } from "../../lib/story-editor/drawing-engine";
import { createDrawingDocument } from "../../lib/story-editor/drawing-engine";
import { parseStoryStickerConfig } from "../../lib/story-editor/stickers.mjs";

interface CanvasProps {
  slides: Slide[];
  activeIndex: number;
  progress: number;
  playing: boolean;
  animationPreviewActive: boolean;
  safeZonesVisible: boolean;
  tapAreasVisible: boolean;
  textOverlays: StoryTextOverlay[];
  shapes: StoryShape[];
  selectedObjectId: string | null;
  editable: boolean;
  drawing?: StoryDrawingDocument;
  drawingActive?: boolean;
  onDrawingChange?: (value: StoryDrawingDocument) => void;
  onDrawingActiveChange?: (active: boolean) => void;
  onCatalogStickerTransformChange: (
    id: string,
    transform: { x: number; y: number; scale: number; rotation: number },
  ) => void;
  onCatalogStickerTransformEnd: (
    id: string,
    transform: { x: number; y: number; scale: number; rotation: number },
  ) => void;
  mediaSettings: StorySlideMediaSettings;
  brand: StoryBrandOverlay;
  onStickerUpdate: (id: string, patch: Partial<Sticker>) => void;
  onSelectObject: (id: string | null, type?: "text" | "sticker" | "shape") => void;
  onObjectTransform: (
    id: string,
    type: "text" | "sticker" | "shape",
    transform: StoryCanvasTransform,
  ) => void;
  onObjectOrder: (id: string, direction: "forward" | "backward" | "front" | "back") => void;
  onEmptyCanvasClick: (point: { x: number; y: number }) => void;
  onDeleteObject: (id: string, type: "text" | "sticker" | "shape") => void;
  transition: StoryTransitionType;
  transitionDuration: number;
  transitionSequence: number;
  transitionFromLeft: boolean;
  elapsedMs: number;
  onMediaError: (message: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
  interactivePreview: boolean;
  immersive: boolean;
  onTogglePlayback: () => void;
  onStartPreview: () => void;
  onAddMedia?: () => void;
  onExitImmersive: () => void;
  onClosePreview: () => void;
}

interface CanvasGesture {
  pointerId: number;
  id: string;
  kind: "text" | "sticker" | "shape";
  mode: "move" | "resize" | "rotate";
  handle?: "nw" | "ne" | "sw" | "se";
  startPoint: { x: number; y: number };
  startTransform: StoryCanvasTransform;
  previewTransform?: StoryCanvasTransform;
  center: { x: number; y: number };
  startAngle: number;
  preserveAspectRatio: boolean;
}

function readObjectTransform(
  id: string,
  kind: CanvasGesture["kind"],
  textOverlays: StoryTextOverlay[],
  stickers: Sticker[],
  shapes: StoryShape[],
): StoryCanvasTransform | null {
  if (kind === "text") {
    const overlay = textOverlays.find((item) => item.id === id);
    if (!overlay) return null;
    const width = Math.max(0.1, overlay.width / 100);
    const height = Math.max(0.08, overlay.height / 100);
    return {
      x: overlay.x / 100 - width / 2,
      y: overlay.y / 100 - height / 2,
      width,
      height,
      rotation: overlay.rotation ?? 0,
    };
  }
  if (kind === "shape") {
    const shape = shapes.find((item) => item.id === id);
    return shape
      ? {
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
          rotation: shape.rotation,
        }
      : null;
  }
  const sticker = stickers.find((item) => item.id === id);
  if (!sticker) return null;
  const width = 0.36 * sticker.scale;
  const height = 0.16 * sticker.scale;
  return {
    x: sticker.x - width / 2,
    y: sticker.y - height / 2,
    width,
    height,
    rotation: sticker.rotation,
    scale: sticker.scale,
  };
}

function getBackgroundStyle(slide: Slide): CSSProperties {
  if (slide.backgroundType === "solid") {
    return { background: slide.background ?? "#1b2947" };
  }
  if (slide.backgroundType === "gradient") {
    const gradients: Record<string, string> = {
      sunset: "linear-gradient(145deg, #f1a46d, #c64d72 55%, #67417e)",
      twilight: "linear-gradient(145deg, #1b3158, #705caa 58%, #d183a4)",
      coastal: "linear-gradient(145deg, #a7d9c3, #498da1 55%, #263b68)",
    };
    return { background: gradients[slide.background ?? "sunset"] ?? gradients.sunset };
  }
  if (slide.backgroundType === "pattern") {
    const patterns: Record<string, string> = {
      dots: "radial-gradient(rgba(255,255,255,.18) 1.4px, transparent 1.4px)",
      grid: "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
      diagonal:
        "repeating-linear-gradient(135deg, rgba(255,255,255,.14) 0 1px, transparent 1px 14px)",
    };
    return {
      backgroundColor: "#29345a",
      backgroundImage: patterns[slide.background ?? "dots"] ?? patterns.dots,
      backgroundSize: slide.background === "grid" ? "24px 24px" : "18px 18px",
    };
  }
  return {};
}

function getMediaStyle(settings: StorySlideMediaSettings): CSSProperties {
  const stabilizeScale = settings.stabilize ? 1.06 : 1;
  return {
    filter: getStoryMediaFilter(settings),
    objectPosition: `${settings.cropX}% ${settings.cropY}%`,
    objectFit: settings.mediaFit ?? "cover",
    opacity: settings.mediaOpacity ?? 1,
    transform: `scale(${settings.cropZoom * stabilizeScale}) rotate(${settings.rotation}deg) scaleX(${settings.flipX ? -1 : 1}) scaleY(${settings.flipY ? -1 : 1})`,
  };
}

export function StoryCanvas({
  slides,
  activeIndex,
  progress,
  playing,
  animationPreviewActive,
  safeZonesVisible,
  tapAreasVisible,
  textOverlays,
  shapes,
  selectedObjectId,
  editable,
  drawing = createDrawingDocument(),
  drawingActive = false,
  onDrawingChange,
  onDrawingActiveChange,
  onCatalogStickerTransformChange,
  onCatalogStickerTransformEnd,
  mediaSettings,
  brand,
  onStickerUpdate,
  onSelectObject,
  onObjectTransform,
  onObjectOrder,
  onEmptyCanvasClick,
  onDeleteObject,
  transition,
  transitionDuration,
  transitionSequence,
  transitionFromLeft,
  elapsedMs,
  onMediaError,
  onPrevious,
  onNext,
  containerRef,
  interactivePreview,
  immersive,
  onTogglePlayback,
  onStartPreview,
  onAddMedia,
  onExitImmersive,
  onClosePreview,
}: CanvasProps) {
  const pointerStart = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<CanvasGesture | null>(null);
  const suppressCanvasClickRef = useRef(false);
  const [previewTransforms, setPreviewTransforms] = useState<Record<string, StoryCanvasTransform>>(
    {},
  );
  const reverseSyncAt = useRef(0);
  const slide = slides[activeIndex];
  const shouldAnimateObjects =
    animationPreviewActive &&
    !(
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  const [renderElapsedMs, setRenderElapsedMs] = useState(elapsedMs);
  const [videoElapsedMs, setVideoElapsedMs] = useState(elapsedMs);
  const clipStart = Math.max(0, mediaSettings.videoStart);
  const clipEnd = Math.min(mediaSettings.sourceDuration, mediaSettings.videoEnd, clipStart + 15);
  const clipDuration = Math.max(0.1, clipEnd - clipStart);
  const visibleTextOverlays = textOverlays.filter((item) => item.visible !== false);
  const visibleShapes = shapes.filter((item) => item.visible);
  const orderedObjects = orderStoryObjects([
    ...visibleTextOverlays.map((item, index) => ({
      id: item.id,
      kind: "text" as const,
      zIndex: item.zIndex ?? index,
    })),
    ...visibleShapes.map((item) => ({
      id: item.id,
      kind: "shape" as const,
      zIndex: item.zIndex,
    })),
    ...slide.stickers
      .filter((item) => item.visible)
      .map((item) => ({ id: item.id, kind: "sticker" as const, zIndex: item.zIndex })),
  ]);
  const zIndexById = Object.fromEntries(orderedObjects.map((item, index) => [item.id, 8 + index]));

  function currentTransform(id: string, kind: CanvasGesture["kind"]) {
    if (previewTransforms[id]) return previewTransforms[id];
    const transform = readObjectTransform(id, kind, textOverlays, slide.stickers, shapes);
    if (kind !== "sticker" || !transform) return transform;
    const sticker = slide.stickers.find((item) => item.id === id);
    const element = containerRef.current?.querySelector<HTMLElement>(
      `[data-story-object-id="${CSS.escape(id)}"]`,
    );
    const canvas = canvasRef.current;
    if (!sticker || !element || !canvas) return transform;
    const rect = canvas.getBoundingClientRect();
    const width = (element.offsetWidth * sticker.scale) / rect.width;
    const height = (element.offsetHeight * sticker.scale) / rect.height;
    return {
      ...transform,
      x: sticker.x - width / 2,
      y: sticker.y - height / 2,
      width,
      height,
    };
  }

  function beginObjectGesture(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string,
    kind: CanvasGesture["kind"],
  ) {
    if (!editable || event.button !== 0) return;
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>("[data-story-handle]")?.dataset.storyHandle;
    if (event.currentTarget.classList.contains("story-editor-selection-box") && !handle) return;
    if (target.closest(".story-editor-selection-actions")) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current;
    const transform = currentTransform(id, kind);
    if (!canvas || !transform) return;
    const rect = canvas.getBoundingClientRect();
    const point = storyCanvasPoint(rect, event.clientX, event.clientY);
    const center = { x: transform.x + transform.width / 2, y: transform.y + transform.height / 2 };
    const mode = handle === "rotate" ? "rotate" : handle ? "resize" : "move";
    const gesture: CanvasGesture = {
      pointerId: event.pointerId,
      id,
      kind,
      mode,
      handle: handle && handle !== "rotate" ? (handle as CanvasGesture["handle"]) : undefined,
      startPoint: point,
      startTransform: transform,
      center,
      startAngle: Math.atan2(point.y - center.y, point.x - center.x),
      preserveAspectRatio: kind === "sticker",
    };
    suppressCanvasClickRef.current = true;
    gestureRef.current = gesture;
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectObject(id, kind);
  }

  function updateObjectGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    const canvas = canvasRef.current;
    if (!gesture || !canvas || gesture.pointerId !== event.pointerId) return;
    const point = storyCanvasPoint(canvas.getBoundingClientRect(), event.clientX, event.clientY);
    const deltaX = point.x - gesture.startPoint.x;
    const deltaY = point.y - gesture.startPoint.y;
    let transform: StoryCanvasTransform;
    if (gesture.mode === "resize" && gesture.handle) {
      transform = resizeStoryTransform(
        gesture.startTransform,
        gesture.handle,
        deltaX,
        deltaY,
        gesture.preserveAspectRatio,
      );
      if (gesture.kind === "sticker") {
        transform.scale =
          (gesture.startTransform.scale as number) *
          (transform.width / gesture.startTransform.width);
      }
    } else if (gesture.mode === "rotate") {
      const angle = Math.atan2(point.y - gesture.center.y, point.x - gesture.center.x);
      transform = rotateStoryTransform(
        gesture.startTransform,
        gesture.center,
        gesture.startAngle,
        angle,
      );
    } else {
      transform = moveStoryTransform(gesture.startTransform, deltaX, deltaY);
    }
    setPreviewTransforms((current) => ({ ...current, [gesture.id]: transform }));
    gestureRef.current = { ...gesture, previewTransform: transform };
  }

  function finishObjectGesture(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const transform = gesture.previewTransform ?? previewTransforms[gesture.id];
    gestureRef.current = null;
    if (!cancelled) {
      suppressCanvasClickRef.current = true;
      window.setTimeout(() => {
        suppressCanvasClickRef.current = false;
      }, 0);
    }
    setPreviewTransforms((current) => {
      const next = { ...current };
      delete next[gesture.id];
      return next;
    });
    if (!cancelled && transform) onObjectTransform(gesture.id, gesture.kind, transform);
  }

  function cancelObjectGesture(pointerId: number) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== pointerId) return;
    gestureRef.current = null;
    suppressCanvasClickRef.current = false;
    setPreviewTransforms((current) => {
      const next = { ...current };
      delete next[gesture.id];
      return next;
    });
  }

  useEffect(() => {
    if (playing) return undefined;
    setRenderElapsedMs(elapsedMs);
    return undefined;
  }, [elapsedMs, playing]);

  useEffect(() => {
    if (!playing) return undefined;
    const startedAt = performance.now() - elapsedMs;
    let lastVideoUpdate = 0;
    let frame = 0;
    const tick = (now: number) => {
      const nextElapsed = now - startedAt;
      setRenderElapsedMs(nextElapsed);
      if (now - lastVideoUpdate >= 100) {
        lastVideoUpdate = now;
        setVideoElapsedMs(nextElapsed);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, slide?.id]);

  useEffect(() => {
    if (playing) return undefined;
    setVideoElapsedMs(elapsedMs);
    return undefined;
  }, [elapsedMs, playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || slide?.mediaType !== "video") return;
    const elapsedVideoTime = Math.min(
      clipDuration,
      (videoElapsedMs / 1000) * mediaSettings.videoSpeed,
    );
    const targetTime = mediaSettings.reverse
      ? Math.max(clipStart, clipEnd - elapsedVideoTime)
      : Math.min(clipEnd, clipStart + elapsedVideoTime);
    video.playbackRate = mediaSettings.videoSpeed;
    if (mediaSettings.reverse) {
      video.pause();
      const now = performance.now();
      if (now - reverseSyncAt.current >= 80 && Math.abs(video.currentTime - targetTime) > 0.05) {
        video.currentTime = targetTime;
        reverseSyncAt.current = now;
      }
    } else if (playing && renderElapsedMs / 1000 < clipDuration / mediaSettings.videoSpeed) {
      if (Math.abs(video.currentTime - targetTime) > 0.6) video.currentTime = targetTime;
      if (video.paused) {
        void video.play().catch((cause: unknown) => {
          onMediaError(cause instanceof Error ? cause.message : "Video playback could not start.");
        });
      }
    } else {
      video.pause();
      if (Math.abs(video.currentTime - targetTime) > 0.05) video.currentTime = targetTime;
    }
  }, [
    clipDuration,
    clipEnd,
    clipStart,
    videoElapsedMs,
    mediaSettings.reverse,
    mediaSettings.videoSpeed,
    onMediaError,
    playing,
    slide,
  ]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (drawingActive) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".story-editor-editable-object")) return;
    pointerStart.current = event.clientX;
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (gestureRef.current) {
      finishObjectGesture(event);
      return;
    }
    if (pointerStart.current === null) return;
    const distance = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(distance) < 48) return;
    if (distance < 0) onNext();
    else onPrevious();
  }

  return (
    <div className="story-editor-canvas-column" ref={containerRef}>
      <div
        aria-label={`Story preview, slide ${activeIndex + 1} of ${slides.length}`}
        className="story-editor-canvas"
        data-editable={editable ? "true" : "false"}
        ref={canvasRef}
        onPointerCancel={() => {
          pointerStart.current = null;
          const gesture = gestureRef.current;
          if (gesture) cancelObjectGesture(gesture.pointerId);
        }}
        onLostPointerCapture={(event) => {
          if (gestureRef.current?.pointerId === event.pointerId)
            cancelObjectGesture(event.pointerId);
        }}
        onPointerMove={updateObjectGesture}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={(event) => {
          if (suppressCanvasClickRef.current) {
            suppressCanvasClickRef.current = false;
            return;
          }
          if (
            drawingActive ||
            !editable ||
            (event.target as HTMLElement).closest(".story-editor-editable-object")
          ) {
            return;
          }
          onSelectObject(null);
          onEmptyCanvasClick(
            storyCanvasPoint(
              event.currentTarget.getBoundingClientRect(),
              event.clientX,
              event.clientY,
            ),
          );
        }}
        role="group"
      >
        <div
          className={[
            "story-editor-slide-content",
            transitionSequence > 0 ? `story-editor-enter-${transition}` : "",
            transitionFromLeft ? "story-editor-enter-from-left" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={`${slide.id}-${transitionSequence}`}
          style={{ animationDuration: `${transitionDuration}s` }}
        >
          <div
            aria-hidden="true"
            className={`story-editor-background story-editor-background-${slide.backgroundType}`}
            style={getBackgroundStyle(slide)}
          >
            {slide.backgroundType === "image" && mediaSettings.backgroundAssetUrl ? (
              <img alt="" src={mediaSettings.backgroundAssetUrl} />
            ) : null}
            {slide.backgroundType === "video" && mediaSettings.backgroundAssetUrl ? (
              <video autoPlay loop muted playsInline src={mediaSettings.backgroundAssetUrl} />
            ) : null}
          </div>
          {slide.mediaUrl && mediaSettings.backgroundBlur > 0 ? (
            slide.mediaType === "video" ? (
              <video
                aria-hidden="true"
                autoPlay
                className="story-editor-blurred-background"
                loop
                muted
                playsInline
                src={slide.mediaUrl}
                style={{ filter: `blur(${mediaSettings.backgroundBlur}px)` }}
              />
            ) : (
              <img
                alt=""
                aria-hidden="true"
                className="story-editor-blurred-background"
                src={slide.mediaUrl}
                style={{ filter: `blur(${mediaSettings.backgroundBlur}px)` }}
              />
            )
          ) : null}
          {mediaSettings.collageImageUrls.length ? (
            <div
              aria-label="Photo collage"
              className="story-editor-collage"
              style={{
                gridTemplateColumns: `repeat(${getStoryCollageGrid(mediaSettings.collageLayout, mediaSettings.collageImageUrls.length).columns}, 1fr)`,
                gridTemplateRows: `repeat(${getStoryCollageGrid(mediaSettings.collageLayout, mediaSettings.collageImageUrls.length).rows}, 1fr)`,
              }}
            >
              {mediaSettings.collageImageUrls.map((url, index) => (
                <img alt={`Collage photo ${index + 1}`} key={url} src={url} />
              ))}
            </div>
          ) : slide.mediaUrl ? (
            slide.mediaType === "video" ? (
              <video
                aria-label={`Slide ${activeIndex + 1} video`}
                className="story-editor-canvas-media"
                key={slide.mediaUrl}
                muted
                onError={() => onMediaError("This video could not be previewed.")}
                playsInline
                ref={videoRef}
                src={slide.mediaUrl}
                style={getMediaStyle(mediaSettings)}
              />
            ) : (
              <img
                alt={`Slide ${activeIndex + 1}`}
                className="story-editor-canvas-media"
                onError={() => onMediaError("This image could not be previewed.")}
                src={slide.mediaUrl}
                style={getMediaStyle(mediaSettings)}
              />
            )
          ) : (
            <div className="story-editor-canvas-empty">
              {onAddMedia ? (
                <button
                  className="story-editor-add-media-prompt"
                  onClick={onAddMedia}
                  type="button"
                >
                  <span aria-hidden="true">+</span>
                  <small>Add a photo or video</small>
                </button>
              ) : (
                <span className="story-editor-add-media-prompt"></span>
              )}
            </div>
          )}

          <div aria-label="Story text overlays" className="story-editor-text-layer">
            {visibleTextOverlays.map((overlay) => {
              const transform =
                currentTransform(overlay.id, "text") ??
                readObjectTransform(overlay.id, "text", textOverlays, slide.stickers, shapes);
              if (!transform) return null;
              const animationState = shouldAnimateObjects
                ? getStoryTextAnimationState(
                    overlay.animation,
                    renderElapsedMs / 1000,
                    overlay.startAt,
                    overlay.animationDuration,
                    overlay.animationDelay,
                    overlay.animationLoop,
                  )
                : { visible: true, progress: 1 };
              if (!animationState.visible) return null;
              const positionX = (transform.x + transform.width / 2) * 100;
              const positionY = (transform.y + transform.height / 2) * 100;
              const width = Math.min(Math.max(transform.width * 100, 10), 100);
              const autoFontSize = overlay.autoSize
                ? getStoryAutoFontSize(overlay.content, overlay.fontSize, width, overlay.height)
                : overlay.fontSize;
              const animationProgress = animationState.progress;
              const animationFrame = shouldAnimateObjects
                ? getStoryTextAnimationFrame(
                    overlay.animation,
                    animationProgress,
                    transform.rotation,
                  )
                : { opacity: 1, x: 0, y: 0, scale: 1, rotation: transform.rotation };
              const text =
                shouldAnimateObjects && overlay.animation === "typewriter"
                  ? getStoryTypewriterText(overlay.content, animationProgress)
                  : overlay.content;
              return (
                <div
                  aria-label={overlay.content || "Text overlay"}
                  aria-pressed={selectedObjectId === overlay.id}
                  className={`story-editor-text-overlay story-editor-editable-object${selectedObjectId === overlay.id ? " is-selected" : ""}`}
                  key={overlay.id}
                  data-story-object-id={overlay.id}
                  data-story-object-kind="text"
                  onKeyDown={(event) => {
                    if (event.key === "Delete" || event.key === "Backspace") {
                      event.preventDefault();
                      onDeleteObject(overlay.id, "text");
                    } else if (event.key.startsWith("Arrow")) {
                      event.preventDefault();
                      const step = event.shiftKey ? 0.05 : 0.01;
                      const deltaX =
                        event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
                      const deltaY =
                        event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
                      onSelectObject(overlay.id, "text");
                      onObjectTransform(
                        overlay.id,
                        "text",
                        moveStoryTransform(transform, deltaX, deltaY),
                      );
                    }
                  }}
                  onPointerDown={(event) => beginObjectGesture(event, overlay.id, "text")}
                  role="button"
                  tabIndex={editable ? 0 : -1}
                  style={{
                    left: `${positionX}%`,
                    top: `${positionY}%`,
                    width: `${width}%`,
                    zIndex: zIndexById[overlay.id],
                    opacity: (overlay.opacity ?? 1) * animationFrame.opacity,
                    transform: `translate(-50%, -50%) translate(${animationFrame.x}px, ${animationFrame.y}px) rotate(${animationFrame.rotation}deg) scale(${animationFrame.scale})`,
                    pointerEvents: editable ? "auto" : "none",
                    fontFamily: overlay.fontFamily,
                    fontSize: `${autoFontSize / 10.8}cqw`,
                    fontWeight: overlay.fontWeight,
                    color: overlay.color,
                    textAlign: overlay.align,
                    letterSpacing: `${overlay.letterSpacing / 10.8}cqw`,
                    lineHeight: overlay.lineHeight,
                    fontStyle: overlay.italic ? "italic" : "normal",
                    textTransform: overlay.uppercase ? "uppercase" : "none",
                    background: overlay.background
                      ? `color-mix(in srgb, ${overlay.background} ${Math.round((overlay.backgroundOpacity ?? 1) * 100)}%, transparent)`
                      : "transparent",
                    borderRadius: `${overlay.backgroundRadius ?? 8}px`,
                    WebkitTextStroke: overlay.stroke ? `1.5px ${overlay.stroke}` : undefined,
                    textShadow: overlay.shadow ?? undefined,
                  }}
                >
                  {text}
                </div>
              );
            })}
          </div>

          {visibleShapes.map((shape) => {
            const transform =
              currentTransform(shape.id, "shape") ??
              readObjectTransform(shape.id, "shape", textOverlays, slide.stickers, shapes);
            if (!transform) return null;
            return (
              <div
                aria-label={`${shape.shape} shape`}
                aria-pressed={selectedObjectId === shape.id}
                className="story-editor-shape-object story-editor-editable-object"
                data-story-object-id={shape.id}
                data-story-object-kind="shape"
                key={shape.id}
                onKeyDown={(event) => {
                  if (event.key === "Delete" || event.key === "Backspace") {
                    event.preventDefault();
                    onDeleteObject(shape.id, "shape");
                  } else if (event.key.startsWith("Arrow")) {
                    event.preventDefault();
                    const step = event.shiftKey ? 0.05 : 0.01;
                    const deltaX =
                      event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
                    const deltaY =
                      event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
                    onSelectObject(shape.id, "shape");
                    onObjectTransform(
                      shape.id,
                      "shape",
                      moveStoryTransform(transform, deltaX, deltaY),
                    );
                  }
                }}
                onPointerDown={(event) => beginObjectGesture(event, shape.id, "shape")}
                role="button"
                tabIndex={editable ? 0 : -1}
                style={{
                  left: `${transform.x * 100}%`,
                  top: `${transform.y * 100}%`,
                  width: `${transform.width * 100}%`,
                  height: `${transform.height * 100}%`,
                  background: shape.fill,
                  border: `${shape.strokeWidth}px solid ${shape.stroke}`,
                  borderRadius: shape.shape === "ellipse" ? "50%" : "0.35rem",
                  transform: `rotate(${transform.rotation}deg)`,
                  zIndex: zIndexById[shape.id],
                }}
              />
            );
          })}

          <StickerLayer
            brand={brand}
            animationPreviewActive={shouldAnimateObjects}
            elapsedSeconds={renderElapsedMs / 1000}
            interactivePreview={interactivePreview}
            editable={editable}
            selectedId={selectedObjectId}
            transforms={previewTransforms}
            zIndexById={zIndexById}
            onObjectPointerDown={beginObjectGesture}
            onSelect={onSelectObject}
            onUpdate={onStickerUpdate}
            stickers={
              editable
                ? slide.stickers.filter(
                    (sticker) => !parseStoryStickerConfig(sticker.config).catalogId,
                  )
                : slide.stickers
            }
          />
          {editable
            ? slide.stickers
                .filter(
                  (sticker) =>
                    sticker.visible && Boolean(parseStoryStickerConfig(sticker.config).catalogId),
                )
                .map((sticker) => {
                  const catalogConfig = parseStoryStickerConfig(
                    sticker.config,
                  ) as StoryStickerConfig & {
                    catalogGlyph?: string;
                    staticText?: boolean;
                  };
                  return (
                    <StoryStickerObject
                      key={sticker.id}
                      selected={selectedObjectId === sticker.id}
                      sticker={{
                        id: sticker.id,
                        type: sticker.type,
                        content: sticker.content,
                        transform: {
                          x: sticker.x,
                          y: sticker.y,
                          scale: sticker.scale,
                          rotation: sticker.rotation,
                        },
                        zIndex: zIndexById[sticker.id] ?? sticker.zIndex,
                        config: catalogConfig as Record<string, unknown>,
                      }}
                      onSelect={(id) => onSelectObject(id, "sticker")}
                      onRemove={() => onDeleteObject(sticker.id, "sticker")}
                      onOrder={onObjectOrder}
                      onTransformChange={onCatalogStickerTransformChange}
                      onTransformEnd={onCatalogStickerTransformEnd}
                    >
                      <>
                        {catalogConfig.assetUrl ? (
                          <img src={String(catalogConfig.assetUrl)} alt="" />
                        ) : catalogConfig.staticText ? (
                          sticker.content
                        ) : (
                          String(catalogConfig.catalogGlyph ?? sticker.content)
                        )}
                      </>
                    </StoryStickerObject>
                  );
                })
            : null}
          {editable && onDrawingChange ? (
            <StoryDrawingLayer
              active={drawingActive}
              onActiveChange={(active) => {
                onDrawingActiveChange?.(active);
                if (!active) onSelectObject(null);
              }}
              onChange={onDrawingChange}
              value={drawing}
            />
          ) : null}
          {editable && selectedObjectId
            ? (() => {
                const catalogSticker = slide.stickers.some(
                  (item) =>
                    item.id === selectedObjectId &&
                    Boolean(parseStoryStickerConfig(item.config).catalogId),
                );
                const kind = catalogSticker
                  ? null
                  : visibleTextOverlays.some((item) => item.id === selectedObjectId)
                    ? "text"
                    : visibleShapes.some((item) => item.id === selectedObjectId)
                      ? "shape"
                      : slide.stickers.some((item) => item.id === selectedObjectId && item.visible)
                        ? "sticker"
                        : null;
                if (!kind) return null;
                const transform =
                  currentTransform(selectedObjectId, kind) ??
                  readObjectTransform(selectedObjectId, kind, textOverlays, slide.stickers, shapes);
                if (!transform) return null;
                return (
                  <div
                    aria-label="Selected story object controls"
                    className="story-editor-selection-box story-editor-editable-object"
                    role="group"
                    onPointerDown={(event) => beginObjectGesture(event, selectedObjectId, kind)}
                    style={{
                      left: `${transform.x * 100}%`,
                      top: `${transform.y * 100}%`,
                      width: `${transform.width * 100}%`,
                      height: `${transform.height * 100}%`,
                      transform: `rotate(${transform.rotation}deg)`,
                    }}
                  >
                    {(["nw", "ne", "sw", "se"] as const).map((handle) => (
                      <button
                        aria-label={`Resize selected object ${handle}`}
                        data-story-handle={handle}
                        key={handle}
                        type="button"
                      />
                    ))}
                    <button
                      aria-label="Rotate selected object"
                      className="story-editor-rotate-handle"
                      data-story-handle="rotate"
                      type="button"
                    />
                    <div
                      className="story-editor-selection-actions"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <button
                        aria-label="Delete selected object"
                        onClick={() => onDeleteObject(selectedObjectId, kind)}
                        type="button"
                      >
                        Delete
                      </button>
                      <button
                        aria-label="Send selected object backward"
                        onClick={() => onObjectOrder(selectedObjectId, "backward")}
                        type="button"
                      >
                        Back
                      </button>
                      <button
                        aria-label="Bring selected object forward"
                        onClick={() => onObjectOrder(selectedObjectId, "forward")}
                        type="button"
                      >
                        Forward
                      </button>
                      <button
                        aria-label="Send selected object to back"
                        onClick={() => onObjectOrder(selectedObjectId, "back")}
                        type="button"
                      >
                        To back
                      </button>
                      <button
                        aria-label="Bring selected object to front"
                        onClick={() => onObjectOrder(selectedObjectId, "front")}
                        type="button"
                      >
                        To front
                      </button>
                    </div>
                  </div>
                );
              })()
            : null}
        </div>

        <div aria-label="Story slide progress" className="story-editor-progress">
          {slides.map((item, index) => (
            <span className="story-editor-progress-track" key={item.id}>
              <span
                className="story-editor-progress-fill"
                style={{
                  transform: `scaleX(${
                    index < activeIndex ? 1 : index === activeIndex ? progress : 0
                  })`,
                }}
              />
            </span>
          ))}
        </div>

        {!playing && !immersive && !editable ? (
          <button
            aria-label="Play story preview"
            className="story-editor-canvas-play"
            onClick={onStartPreview}
            type="button"
          >
            <Play size={25} fill="currentColor" />
          </button>
        ) : null}

        <div className="story-editor-preview-top">
          <span className="story-editor-preview-avatar" aria-hidden="true">
            {brand.logoUrl ? <img alt="" src={brand.logoUrl} /> : "V"}
          </span>
          <span className="story-editor-preview-identity">
            <strong>Story preview</strong>
            <small>{playing ? "Now" : `${slide?.duration ?? 15}s`}</small>
          </span>
          {!editable ? (
            <button
              aria-label="Close story preview"
              className="story-editor-preview-close"
              onClick={onClosePreview}
              type="button"
            >
              <X size={17} />
            </button>
          ) : null}
        </div>

        {safeZonesVisible ? (
          <div aria-label="Safe zone guides" className="story-editor-safe-zones">
            <div className="story-editor-safe-zone story-editor-safe-zone-top">
              <span>TOP SAFE ZONE · 250 PX</span>
            </div>
            <div className="story-editor-safe-zone story-editor-safe-zone-bottom">
              <span>BOTTOM SAFE ZONE · 250 PX</span>
            </div>
          </div>
        ) : null}

        {tapAreasVisible ? (
          <div aria-label="Story interaction indicators" className="story-editor-tap-areas">
            <div className="story-editor-swipe-indicator">
              <MoveUp size={17} />
              <span>SWIPE UP</span>
            </div>
            <div className="story-editor-reply-indicator">
              <MessageCircle size={16} />
              <input aria-label="Reply to story preview" placeholder="Reply to story…" />
            </div>
          </div>
        ) : null}
        {immersive ? (
          <div className="story-editor-immersive-controls">
            <button
              aria-label={playing ? "Pause story preview" : "Play story preview"}
              onClick={onTogglePlayback}
              type="button"
            >
              {playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
              {playing ? "Pause" : "Play"}
            </button>
            <button aria-label="Exit full-screen preview" onClick={onExitImmersive} type="button">
              Exit full screen
            </button>
          </div>
        ) : null}
      </div>

      <div className="story-editor-canvas-controls">
        <button
          aria-label="Previous slide"
          className="story-editor-round-button"
          disabled={activeIndex === 0}
          onClick={onPrevious}
          type="button"
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          <strong>{String(activeIndex + 1).padStart(2, "0")}</strong>
          <span> / {String(slides.length).padStart(2, "0")}</span>
        </span>
        <button
          aria-label="Next slide"
          className="story-editor-round-button"
          disabled={activeIndex === slides.length - 1}
          onClick={onNext}
          type="button"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
