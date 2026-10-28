import { activeClipAt, clipDuration, clipSourceAt } from "./timeline.ts";
import {
  REEL_FILTERS_BY_ID,
  type ReelAdjustments,
  type ReelClip,
  type ReelProject,
  type ReelTextOverlay,
} from "./types.ts";

export type ReelRenderAsset = HTMLImageElement | HTMLVideoElement;

export interface ReelFrameOptions {
  /** Draws safe-area guides. Preview only, never part of an export. */
  showSafeZones?: boolean;
}

/**
 * Builds the CSS filter list for a clip. The same string drives the DOM preview
 * and the canvas export, so a filter can never look different once rendered.
 */
export function buildMediaFilter(adjustments: ReelAdjustments, filterId: string | null): string {
  const parts = [
    `brightness(${adjustments.brightness}%)`,
    `contrast(${adjustments.contrast}%)`,
    `saturate(${adjustments.saturation}%)`,
  ];
  if (adjustments.blur > 0) parts.push(`blur(${adjustments.blur}px)`);
  if (adjustments.temperature > 0) {
    parts.push(`sepia(${(adjustments.temperature / 300).toFixed(3)})`);
    parts.push(`saturate(${(1 + adjustments.temperature / 400).toFixed(3)})`);
  } else if (adjustments.temperature < 0) {
    parts.push(`hue-rotate(${Math.round(adjustments.temperature * 0.45)}deg)`);
    parts.push(`saturate(${(1 + Math.abs(adjustments.temperature) / 350).toFixed(3)})`);
  }
  const preset = filterId ? REEL_FILTERS_BY_ID.get(filterId) : undefined;
  if (preset?.css) parts.push(preset.css);
  return parts.join(" ");
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!url.startsWith("blob:") && !url.startsWith("data:")) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("An image in this reel could not be loaded."));
    image.src = url;
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.preload = "auto";
    video.muted = true;
    // `loadeddata` means the first frame is decoded, so a draw right after this
    // resolves never paints a blank frame.
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("A video in this reel could not be loaded."));
    video.src = url;
    video.load();
  });
}

/** Loads every image and video the project references, keyed by asset id. */
export async function prepareReelAssets(
  project: ReelProject,
): Promise<Map<string, ReelRenderAsset>> {
  const entries = await Promise.all(
    Object.values(project.assets).map(async (asset) => {
      if (asset.kind === "audio") return null;
      const element =
        asset.kind === "video" ? await loadVideo(asset.url) : await loadImage(asset.url);
      return [asset.id, element] as const;
    }),
  );
  return new Map(entries.filter((entry): entry is readonly [string, ReelRenderAsset] => !!entry));
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

function transitionState(
  clip: ReelClip,
  timeSeconds: number,
): { alpha: number; offsetX: number; scale: number } {
  const state = { alpha: 1, offsetX: 0, scale: 1 };
  const duration = clipDuration(clip);
  const sinceStart = timeSeconds - clip.startSeconds;
  const untilEnd = clip.startSeconds + duration - timeSeconds;
  const apply = (transition: { id: string; durationSeconds: number } | null, elapsed: number) => {
    if (!transition || transition.durationSeconds <= 0) return;
    if (transition.id === "none") return;
    const progress = Math.max(0, Math.min(1, elapsed / transition.durationSeconds));
    if (transition.id === "fade") state.alpha = progress;
    if (transition.id === "slide-left") state.offsetX = (1 - progress) * 0.25;
    if (transition.id === "slide-right") state.offsetX = -(1 - progress) * 0.25;
    if (transition.id === "zoom") state.scale = 0.85 + progress * 0.15;
  };
  apply(clip.transitionIn, sinceStart);
  apply(clip.transitionOut, untilEnd);
  return state;
}

function drawGrain(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
) {
  const count = Math.round(420 * intensity);
  if (count <= 0) return;
  let seed = 20260101;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  context.save();
  context.globalCompositeOperation = "overlay";
  for (let index = 0; index < count; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const size = 1 + random() * 2;
    const tone = random() > 0.5 ? 255 : 0;
    context.fillStyle = `rgba(${tone},${tone},${tone},${0.16 * intensity})`;
    context.fillRect(x, y, size, size);
  }
  context.restore();
}

function drawVignette(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
) {
  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.22,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${Math.min(0.92, intensity * 0.92)})`);
  context.save();
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

function drawClip(
  context: CanvasRenderingContext2D,
  project: ReelProject,
  assets: Map<string, ReelRenderAsset>,
  clip: ReelClip,
  timeSeconds: number,
): void {
  const asset = project.assets[clip.assetId];
  const rendered = assets.get(clip.assetId);
  if (!asset || !rendered) return;
  const { width, height } = project;
  const sourceWidth =
    rendered instanceof HTMLVideoElement ? rendered.videoWidth : rendered.naturalWidth;
  const sourceHeight =
    rendered instanceof HTMLVideoElement ? rendered.videoHeight : rendered.naturalHeight;
  if (!sourceWidth || !sourceHeight) return;

  const state = transitionState(clip, timeSeconds);
  const fitScale =
    clip.transform.fit === "contain"
      ? Math.min(width / sourceWidth, height / sourceHeight)
      : Math.max(width / sourceWidth, height / sourceHeight);
  const effects = clip.effects ?? {};
  const zoomEffect = effects.zoom ?? 0;
  const clipLength = Math.max(0.001, clipDuration(clip));
  const zoomProgress = Math.min(1, Math.max(0, (timeSeconds - clip.startSeconds) / clipLength));
  const zoomScale = 1 + zoomEffect * 0.3 * zoomProgress;
  const scale = fitScale * clip.transform.scale * state.scale * zoomScale;
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;

  context.save();
  context.globalAlpha = state.alpha;
  context.filter = buildMediaFilter(clip.adjustments, clip.filterId);
  context.translate(
    width / 2 + clip.transform.offsetX * width,
    height / 2 + clip.transform.offsetY * height + state.offsetX * width,
  );
  context.rotate((clip.transform.rotation * Math.PI) / 180);
  context.scale(clip.transform.flipX ? -1 : 1, clip.transform.flipY ? -1 : 1);
  context.drawImage(rendered, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

  const glow = effects.glow ?? 0;
  if (glow > 0) {
    context.save();
    context.globalCompositeOperation = "lighter";
    context.filter = `blur(${Math.max(2, 18 * glow)}px) brightness(1.2)`;
    context.globalAlpha = state.alpha * 0.35 * glow;
    context.drawImage(rendered, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
  }
  context.restore();

  if (effects.vignette) {
    drawVignette(context, width, height, effects.vignette);
  }
  if (effects.grain) {
    drawGrain(context, width, height, effects.grain);
  }
}

function drawTextOverlay(
  context: CanvasRenderingContext2D,
  project: ReelProject,
  overlay: ReelTextOverlay,
): void {
  const { width, height } = project;
  const fontSize = overlay.fontSize * (width / 1080);
  const boxWidth = Math.max(24, overlay.width * width);
  const content = overlay.uppercase ? overlay.text.toLocaleUpperCase() : overlay.text;
  context.save();
  context.font = `${overlay.fontWeight} ${fontSize}px "${overlay.fontFamily}", sans-serif`;
  context.textAlign = overlay.align;
  context.textBaseline = "middle";
  const lines = wrapText(context, content, boxWidth);
  const lineHeight = fontSize * overlay.lineHeight;
  const x = overlay.x * width + (overlay.align === "center" ? boxWidth / 2 : 0);
  const y = overlay.y * height + (lines.length * lineHeight) / 2;
  const anchor =
    overlay.align === "center" ? "center" : overlay.align === "right" ? "right" : "left";
  context.textAlign = anchor;

  lines.forEach((line, index) => {
    const lineY = y - ((lines.length - 1) * lineHeight) / 2 + index * lineHeight;
    if (overlay.background) {
      const metrics = context.measureText(line);
      const padding = fontSize * 0.24;
      const left =
        anchor === "right"
          ? x - metrics.width - padding
          : anchor === "center"
            ? x - metrics.width / 2 - padding
            : x - padding;
      context.fillStyle = overlay.background;
      context.beginPath();
      context.roundRect(left, lineY - lineHeight / 2, metrics.width + padding * 2, lineHeight, 8);
      context.fill();
    }
    if (overlay.shadow) {
      context.shadowColor = "rgba(0,0,0,.45)";
      context.shadowBlur = fontSize * 0.18;
    }
    if (overlay.stroke) {
      context.strokeStyle = overlay.stroke;
      context.lineWidth = Math.max(2, fontSize * 0.05);
      context.strokeText(line, x, lineY);
    }
    context.shadowColor = "transparent";
    context.fillStyle = overlay.color;
    context.fillText(line, x, lineY);
  });
  context.restore();
}

function drawSticker(
  context: CanvasRenderingContext2D,
  project: ReelProject,
  assets: Map<string, ReelRenderAsset>,
  sticker: ReelProject["stickers"][number],
): void {
  const { width, height } = project;
  const size = Math.max(48, width * 0.18 * sticker.scale);
  const x = sticker.x * width;
  const y = sticker.y * height;
  const rendered = sticker.assetId ? assets.get(sticker.assetId) : undefined;
  context.save();
  context.translate(x, y);
  context.rotate((sticker.rotation * Math.PI) / 180);
  if (rendered) {
    const sourceWidth =
      rendered instanceof HTMLVideoElement ? rendered.videoWidth : rendered.naturalWidth;
    const sourceHeight =
      rendered instanceof HTMLVideoElement ? rendered.videoHeight : rendered.naturalHeight;
    if (sourceWidth && sourceHeight) {
      const scale = Math.min(size / sourceWidth, size / sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      context.drawImage(rendered, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    }
  } else if (sticker.glyph) {
    context.font = `${Math.max(18, size * 0.9)}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(sticker.glyph, 0, 0);
  }
  context.restore();
}

function drawCaption(
  context: CanvasRenderingContext2D,
  project: ReelProject,
  caption: ReelProject["captions"][number],
): void {
  const { width, height } = project;
  const fontSize = caption.fontSize * (width / 1080);
  context.save();
  context.font = `700 ${fontSize}px "DM Sans", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const metrics = context.measureText(caption.text);
  const padding = fontSize * 0.3;
  const x = caption.x * width;
  const y = caption.y * height;
  if (caption.background) {
    context.fillStyle = caption.background;
    context.beginPath();
    context.roundRect(
      x - metrics.width / 2 - padding,
      y - fontSize * 0.7,
      metrics.width + padding * 2,
      fontSize * 1.4,
      fontSize * 0.35,
    );
    context.fill();
  }
  context.fillStyle = caption.color;
  context.fillText(caption.text, x, y);
  context.restore();
}

/**
 * Renders one frame of the reel. The preview canvas and the MP4 encoder both
 * call this, so what the creator sees is exactly what gets published.
 */
export function drawReelFrame(
  context: CanvasRenderingContext2D,
  project: ReelProject,
  assets: Map<string, ReelRenderAsset>,
  timeSeconds: number,
  options: ReelFrameOptions = {},
): void {
  const { width, height } = project;
  context.save();
  context.filter = "none";
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);

  const clip = activeClipAt(project, timeSeconds);
  if (clip) drawClip(context, project, assets, clip, timeSeconds);

  for (const sticker of project.stickers) {
    if (timeSeconds < sticker.startSeconds || timeSeconds > sticker.endSeconds) continue;
    drawSticker(context, project, assets, sticker);
  }
  for (const overlay of project.texts) {
    if (timeSeconds < overlay.startSeconds || timeSeconds > overlay.endSeconds) continue;
    drawTextOverlay(context, project, overlay);
  }
  for (const caption of project.captions) {
    if (timeSeconds < caption.startSeconds || timeSeconds > caption.endSeconds) continue;
    drawCaption(context, project, caption);
  }

  if (options.showSafeZones) {
    context.strokeStyle = "rgba(214,173,96,.65)";
    context.lineWidth = Math.max(2, width / 540);
    context.setLineDash([12, 10]);
    context.strokeRect(width * 0.111, height * 0.115, width * 0.778, height * 0.77);
    context.setLineDash([]);
  }
  context.restore();
}

/** Source time a clip should be showing at a given timeline position. */
export function sourceTimeForClip(clip: ReelClip, timeSeconds: number): number {
  return clipSourceAt(clip, timeSeconds);
}

/** Renders a still frame of the reel, used for the cover image. */
export async function renderReelCover(
  project: ReelProject,
  assets: Map<string, ReelRenderAsset>,
  timeSeconds: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = project.width;
  canvas.height = project.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not create a canvas for the cover.");
  drawReelFrame(context, project, assets, timeSeconds);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The browser could not create the reel cover."));
      },
      "image/jpeg",
      0.9,
    );
  });
}
