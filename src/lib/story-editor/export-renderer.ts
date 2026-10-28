import { storyMediaPlacement } from "./media-tools.mjs";
import { orderStoryObjects } from "./scene-engine.mjs";
import type {
  Slide,
  StoryBrandOverlay,
  StoryShape,
  StorySlideMediaSettings,
  StoryTextOverlay,
} from "./types";
import { parseStoryStickerConfig } from "./stickers.mjs";
import { renderStoryDrawing, type StoryDrawingDocument } from "./drawing-engine";
import { getStoryTextAnimationFrame, getStoryTextAnimationState } from "./text-tools.mjs";

export interface StoryExportFrame {
  slide: Slide;
  textOverlays: StoryTextOverlay[];
  shapes: StoryShape[];
  mediaSettings: StorySlideMediaSettings;
  brand: StoryBrandOverlay;
  drawing?: StoryDrawingDocument;
}

export type StoryRenderAsset = HTMLImageElement | HTMLVideoElement;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!url.startsWith("blob:") && !url.startsWith("data:")) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A story image could not be loaded for export."));
    image.src = url;
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    // Metadata alone does not guarantee that a drawable video frame exists.
    // Resolve only after loadeddata; otherwise the first exported frame can be blank.
    if (!url.startsWith("blob:") && !url.startsWith("data:")) video.crossOrigin = "anonymous";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("A story video could not be loaded for export."));
    video.src = url;
    video.load();
  });
}

export async function prepareStoryExportAssets(
  frames: StoryExportFrame[],
  logoUrl: string | null,
): Promise<Map<string, StoryRenderAsset>> {
  const urls = new Map<string, boolean>();
  for (const { slide, mediaSettings } of frames) {
    if (slide.mediaUrl) urls.set(slide.mediaUrl, slide.mediaType === "video");
    if (mediaSettings.backgroundAssetUrl) {
      urls.set(mediaSettings.backgroundAssetUrl, slide.backgroundType === "video");
    }
    for (const url of mediaSettings.collageImageUrls) urls.set(url, false);
    for (const sticker of slide.stickers) {
      const stickerAssetUrl = parseStoryStickerConfig(sticker.config).assetUrl;
      if (stickerAssetUrl) urls.set(stickerAssetUrl, false);
    }
  }
  if (logoUrl) urls.set(logoUrl, false);
  const entries = await Promise.all(
    [...urls].map(
      async ([url, video]) => [url, video ? await loadVideo(url) : await loadImage(url)] as const,
    ),
  );
  return new Map(entries);
}

function drawCover(
  context: CanvasRenderingContext2D,
  asset: CanvasImageSource,
  width: number,
  height: number,
  x = 0,
  y = 0,
  boxWidth = width,
  boxHeight = height,
) {
  const source = asset as HTMLImageElement | HTMLVideoElement;
  const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const sourceHeight =
    source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!sourceWidth || !sourceHeight) return;
  const scale = Math.max(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(
    asset,
    x + (boxWidth - drawWidth) / 2,
    y + (boxHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

export function drawStoryExportFrame(
  canvas: HTMLCanvasElement,
  frame: StoryExportFrame,
  assets: Map<string, StoryRenderAsset>,
  timeSeconds = 0,
  animate = false,
): void {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not create a story export canvas.");
  const { slide, mediaSettings, brand, textOverlays } = frame;
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  const gradients: Record<string, string[]> = {
    sunset: ["#f1a46d", "#c64d72", "#67417e"],
    twilight: ["#1b3158", "#705caa", "#d183a4"],
    coastal: ["#a7d9c3", "#498da1", "#263b68"],
  };
  const colors = gradients[slide.background ?? "sunset"];
  if (slide.backgroundType === "gradient" && colors) {
    const gradient = context.createLinearGradient(0, 0, width * 0.7, height);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(0.55, colors[1]);
    gradient.addColorStop(1, colors[2]);
    context.fillStyle = gradient;
  } else {
    context.fillStyle =
      slide.backgroundType === "pattern" ? "#29345a" : (slide.background ?? "#272638");
  }
  context.fillRect(0, 0, width, height);
  if (slide.backgroundType === "pattern") {
    context.save();
    context.fillStyle = "rgba(255,255,255,.18)";
    context.strokeStyle = "rgba(255,255,255,.12)";
    if (slide.background === "grid") {
      for (let x = 0; x < width; x += width / 45) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y < height; y += height / 80) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
    } else if (slide.background === "diagonal") {
      context.lineWidth = Math.max(1, width / 1080);
      for (let offset = -height; offset < width; offset += width / 50) {
        context.beginPath();
        context.moveTo(offset, 0);
        context.lineTo(offset + height, height);
        context.stroke();
      }
    } else {
      for (let x = 0; x < width; x += width / 40) {
        for (let y = 0; y < height; y += height / 70) {
          context.beginPath();
          context.arc(x, y, Math.max(1, width / 400), 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    context.restore();
  }

  const backgroundAsset = mediaSettings.backgroundAssetUrl
    ? assets.get(mediaSettings.backgroundAssetUrl)
    : undefined;
  if (backgroundAsset) drawCover(context, backgroundAsset, width, height);

  if (mediaSettings.collageImageUrls.length) {
    const columns =
      mediaSettings.collageLayout === "1x3" ? 1 : mediaSettings.collageLayout === "3x1" ? 3 : 2;
    const rows =
      mediaSettings.collageLayout === "1x3" ? 3 : mediaSettings.collageLayout === "3x1" ? 1 : 2;
    mediaSettings.collageImageUrls.forEach((url, index) => {
      const asset = assets.get(url);
      if (!asset) return;
      const cellWidth = width / columns;
      const cellHeight = height / rows;
      drawCover(
        context,
        asset,
        width,
        height,
        (index % columns) * cellWidth,
        Math.floor(index / columns) * cellHeight,
        cellWidth,
        cellHeight,
      );
    });
  } else if (slide.mediaUrl) {
    const asset = assets.get(slide.mediaUrl);
    if (asset) {
      const video = asset instanceof HTMLVideoElement ? asset : null;
      if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        const clipStart = mediaSettings.videoStart;
        const clipEnd = mediaSettings.videoEnd || video.duration;
        const clipDuration = Math.max(0.1, clipEnd - clipStart);
        if (video.currentTime < clipStart || video.currentTime >= clipEnd) {
          try {
            video.currentTime = clipStart + (timeSeconds % clipDuration);
          } catch {
            video.currentTime = clipStart;
          }
        }
      }
      context.save();
      context.globalAlpha = mediaSettings.mediaOpacity ?? 1;
      context.filter = [
        `brightness(${mediaSettings.brightness}%)`,
        `contrast(${mediaSettings.contrast}%)`,
        `saturate(${mediaSettings.saturation}%)`,
        mediaSettings.blur ? `blur(${mediaSettings.blur}px)` : "",
        mediaSettings.filter === "mono" ? "grayscale(1)" : "",
        mediaSettings.filter === "warm" ? "sepia(.3)" : "",
      ]
        .filter(Boolean)
        .join(" ");
      context.translate(width / 2, height / 2);
      context.rotate((mediaSettings.rotation * Math.PI) / 180);
      context.scale(
        mediaSettings.flipX ? -mediaSettings.cropZoom : mediaSettings.cropZoom,
        mediaSettings.flipY ? -mediaSettings.cropZoom : mediaSettings.cropZoom,
      );
      const sourceWidth = video ? video.videoWidth : (asset as HTMLImageElement).naturalWidth;
      const sourceHeight = video ? video.videoHeight : (asset as HTMLImageElement).naturalHeight;
      const placement = storyMediaPlacement(
        width,
        height,
        sourceWidth,
        sourceHeight,
        mediaSettings.mediaFit,
        mediaSettings.cropX,
        mediaSettings.cropY,
      );
      context.drawImage(asset, placement.x, placement.y, placement.width, placement.height);
      context.restore();
    }
  }

  const sceneObjects = orderStoryObjects([
    ...textOverlays
      .filter((item) => item.visible !== false)
      .map((overlay, index) => ({
        id: overlay.id,
        kind: "text" as const,
        zIndex: overlay.zIndex ?? index,
        overlay,
      })),
    ...frame.shapes
      .filter((shape) => shape.visible)
      .map((shape) => ({ id: shape.id, kind: "shape" as const, zIndex: shape.zIndex, shape })),
    ...slide.stickers
      .filter((sticker) => sticker.visible)
      .map((sticker) => ({
        id: sticker.id,
        kind: "sticker" as const,
        zIndex: sticker.zIndex,
        sticker,
      })),
  ]);

  for (const item of sceneObjects) {
    if (item.kind === "text") {
      const { overlay } = item;
      const animationState = animate
        ? getStoryTextAnimationState(
            overlay.animation,
            timeSeconds,
            overlay.startAt,
            overlay.animationDuration,
            overlay.animationDelay,
            overlay.animationLoop,
          )
        : { visible: true, progress: 1 };
      if (!animationState.visible) continue;
      const animationFrame = animate
        ? getStoryTextAnimationFrame(
            overlay.animation,
            animationState.progress,
            overlay.rotation ?? 0,
          )
        : { opacity: 1, x: 0, y: 0, scale: 1, rotation: overlay.rotation ?? 0 };
      let text = overlay.uppercase ? overlay.content.toLocaleUpperCase() : overlay.content;
      if (animate && overlay.animation === "typewriter") {
        text = text.slice(0, Math.ceil(text.length * animationState.progress));
      }
      const fontSize = Math.max(12, (overlay.fontSize / 1080) * width);
      context.save();
      context.font = `${overlay.italic ? "italic " : ""}${overlay.fontWeight} ${fontSize}px ${overlay.fontFamily}`;
      context.textAlign = overlay.align;
      context.textBaseline = "middle";
      context.globalAlpha = (overlay.opacity ?? 1) * animationFrame.opacity;
      const boxWidth = (overlay.width / 100) * width;
      const lines = wrapText(context, text, boxWidth);
      const lineHeight = fontSize * overlay.lineHeight;
      const x = (overlay.x / 100) * width + (animationFrame.x * width) / 390;
      const y = (overlay.y / 100) * height + (animationFrame.y * height) / 844;
      context.shadowColor = overlay.shadow ? "rgba(0,0,0,.45)" : "transparent";
      context.shadowBlur = overlay.shadow ? 12 * (width / 390) : 0;
      context.translate(x, y);
      context.rotate((animationFrame.rotation * Math.PI) / 180);
      context.scale(animationFrame.scale, animationFrame.scale);
      const firstY = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, index) => {
        const lineY = firstY + index * lineHeight;
        if (overlay.background) {
          const metrics = context.measureText(line);
          context.fillStyle = overlay.background;
          context.globalAlpha =
            (overlay.opacity ?? 1) * (overlay.backgroundOpacity ?? 1) * animationFrame.opacity;
          const radius = (overlay.backgroundRadius ?? 8) * (width / 390);
          const left = -metrics.width / 2 - 12;
          const top = lineY - lineHeight / 2;
          const boxWidth = metrics.width + 24;
          context.beginPath();
          context.roundRect(left, top, boxWidth, lineHeight, radius);
          context.fill();
          context.globalAlpha = (overlay.opacity ?? 1) * animationFrame.opacity;
        }
        if (overlay.stroke) {
          context.strokeStyle = overlay.stroke;
          context.lineWidth = Math.max(2, fontSize * 0.06);
          context.strokeText(line, 0, lineY);
        }
        context.fillStyle = overlay.color;
        context.fillText(line, 0, lineY);
      });
      context.restore();
      continue;
    }

    if (item.kind === "shape") {
      const { shape } = item;
      const x = shape.x * width;
      const y = shape.y * height;
      const shapeWidth = shape.width * width;
      const shapeHeight = shape.height * height;
      context.save();
      context.translate(x + shapeWidth / 2, y + shapeHeight / 2);
      context.rotate((shape.rotation * Math.PI) / 180);
      context.beginPath();
      if (shape.shape === "ellipse") {
        context.ellipse(0, 0, shapeWidth / 2, shapeHeight / 2, 0, 0, Math.PI * 2);
      } else {
        context.rect(-shapeWidth / 2, -shapeHeight / 2, shapeWidth, shapeHeight);
      }
      context.fillStyle = shape.fill;
      context.fill();
      if (shape.strokeWidth > 0) {
        context.strokeStyle = shape.stroke;
        context.lineWidth = shape.strokeWidth;
        context.stroke();
      }
      context.restore();
      continue;
    }

    const { sticker } = item;
    const stickerConfig = parseStoryStickerConfig(sticker.config);
    const stickerAnimation = stickerConfig.animation ?? "none";
    const stickerState = animate
      ? getStoryTextAnimationState(
          stickerAnimation,
          timeSeconds,
          stickerConfig.animationStartAt ?? 0,
          stickerConfig.animationDuration ?? 0.7,
          stickerConfig.animationDelay ?? 0,
          stickerConfig.animationLoop ?? false,
        )
      : { visible: true, progress: 1 };
    if (!stickerState.visible) continue;
    const stickerFrame = animate
      ? getStoryTextAnimationFrame(stickerAnimation, stickerState.progress, sticker.rotation)
      : { opacity: 1, x: 0, y: 0, scale: 1, rotation: sticker.rotation };
    const x = (sticker.x / 100) * width;
    const y = (sticker.y / 100) * height;
    const stickerAssetUrl = stickerConfig.assetUrl;
    const stickerAsset = stickerAssetUrl ? assets.get(stickerAssetUrl) : undefined;
    context.save();
    context.globalAlpha = stickerFrame.opacity;
    context.translate(x + (stickerFrame.x * width) / 390, y + (stickerFrame.y * height) / 844);
    context.rotate((stickerFrame.rotation * Math.PI) / 180);
    context.scale(stickerFrame.scale, stickerFrame.scale);
    if (stickerAsset) {
      const size = Math.max(48, width * 0.22 * sticker.scale);
      drawCover(context, stickerAsset, width, height, -size / 2, -size / 2, size, size);
      context.restore();
      continue;
    }
    context.font = `600 ${Math.max(18, 28 * sticker.scale * (width / 1080))}px sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.strokeStyle = "rgba(0,0,0,.45)";
    context.lineWidth = 4;
    context.strokeText(sticker.content, 0, 0, width * 0.7);
    context.fillText(sticker.content, 0, 0, width * 0.7);
    context.restore();
  }

  if (frame.drawing?.strokes.length) {
    const drawingCanvas = document.createElement("canvas");
    drawingCanvas.width = width;
    drawingCanvas.height = height;
    const drawingContext = drawingCanvas.getContext("2d");
    if (drawingContext) {
      const strokeScale = width / 390;
      const exportDrawing = {
        ...frame.drawing,
        strokes: frame.drawing.strokes.map((stroke) => ({
          ...stroke,
          width: stroke.width * strokeScale,
        })),
      };
      renderStoryDrawing(drawingContext, exportDrawing, width, height);
      context.drawImage(drawingCanvas, 0, 0);
    }
  }

  const logo = brand.logoUrl ? assets.get(brand.logoUrl) : undefined;
  if (logo) {
    context.save();
    context.globalAlpha = brand.logoOpacity;
    const logoWidth = width * 0.16 * brand.logoScale;
    const logoHeight = logo instanceof HTMLVideoElement ? logo.videoHeight : logo.naturalHeight;
    const logoNaturalWidth = logo instanceof HTMLVideoElement ? logo.videoWidth : logo.naturalWidth;
    if (logoNaturalWidth && logoHeight) {
      context.drawImage(
        logo,
        brand.logoX * width - logoWidth / 2,
        brand.logoY * height - (logoWidth * logoHeight) / logoNaturalWidth / 2,
        logoWidth,
        (logoWidth * logoHeight) / logoNaturalWidth,
      );
    }
    context.restore();
  }
  if (brand.watermarkText) {
    context.save();
    context.globalAlpha = brand.watermarkOpacity;
    context.fillStyle = "#ffffff";
    context.font = `${Math.max(16, width * 0.026)}px sans-serif`;
    context.textAlign = "right";
    context.fillText(brand.watermarkText, width * 0.95, height * 0.96);
    context.restore();
  }
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The browser could not create the PNG export."));
    }, "image/png");
  });
}

export async function renderStoryMp4(
  frames: StoryExportFrame[],
  dimensions: [number, number],
  mimeType: string,
  onProgress: (progress: number) => void = () => {},
  soundtrack?: { url: string; startSeconds: number; endSeconds: number | null; volume?: number },
): Promise<Blob> {
  if (!frames.length) throw new Error("There are no slides to export.");
  const canvas = document.createElement("canvas");
  [canvas.width, canvas.height] = dimensions;
  const assets = await prepareStoryExportAssets(frames, frames[0].brand.logoUrl);
  for (const asset of assets.values()) {
    if (asset instanceof HTMLVideoElement) {
      try {
        await asset.play();
      } catch {
        throw new Error("A story video could not start playback for MP4 rendering.");
      }
    }
  }
  if (typeof canvas.captureStream !== "function") {
    throw new Error("This browser cannot capture the story canvas for MP4 rendering.");
  }

  // Avoid an empty first frame while the recorder and audio context initialize.
  drawStoryExportFrame(canvas, frames[0], assets, 0, true);
  const stream = canvas.captureStream(30);
  let soundtrackAudio: HTMLAudioElement | null = null;
  let audioContext: AudioContext | null = null;
  let recorder: MediaRecorder | null = null;
  let animationFrame = 0;
  try {
    if (soundtrack) {
      soundtrackAudio = new Audio();
      soundtrackAudio.crossOrigin = "anonymous";
      soundtrackAudio.preload = "auto";
      soundtrackAudio.src = soundtrack.url;
      await new Promise<void>((resolve, reject) => {
        soundtrackAudio!.onloadedmetadata = () => resolve();
        soundtrackAudio!.onerror = () =>
          reject(new Error("The selected music could not be loaded for export."));
        soundtrackAudio!.load();
      });
      if (soundtrack.startSeconds >= soundtrackAudio.duration) {
        throw new Error("The selected music excerpt starts after the track ends.");
      }
      soundtrackAudio.currentTime = Math.max(0, soundtrack.startSeconds);
      audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(soundtrackAudio);
      const destination = audioContext.createMediaStreamDestination();
      const gain = audioContext.createGain();
      gain.gain.value = Math.max(0, Math.min(1, soundtrack.volume ?? 0.8));
      source.connect(gain);
      gain.connect(destination);
      for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
      soundtrackAudio.ontimeupdate = () => {
        if (
          soundtrack.endSeconds !== null &&
          soundtrackAudio &&
          soundtrackAudio.currentTime >= soundtrack.endSeconds
        ) {
          soundtrackAudio.pause();
        }
      };
    }
    const chunks: BlobPart[] = [];
    recorder = new MediaRecorder(stream, { mimeType });
    const completed = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder!.onerror = () =>
        reject(new Error("The browser encountered an error while encoding MP4."));
      recorder!.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    recorder.start(500);
    if (soundtrackAudio && audioContext) {
      await audioContext.resume();
      await soundtrackAudio.play();
    }
    const durations = frames.map(({ slide }) => Math.max(1, slide.duration) * 1000);
    const durationMs = durations.reduce((total, duration) => total + duration, 0);
    const startedAt = performance.now();
    await new Promise<void>((resolve, reject) => {
      const draw = (now: number) => {
        try {
          const elapsed = Math.min(durationMs, now - startedAt);
          let position = elapsed;
          let index = 0;
          while (index < durations.length - 1 && position >= durations[index]) {
            position -= durations[index];
            index += 1;
          }
          drawStoryExportFrame(canvas, frames[index], assets, position / 1000, true);
          onProgress(Math.min(99, Math.round((elapsed / durationMs) * 100)));
          if (elapsed >= durationMs) {
            resolve();
            return;
          }
          animationFrame = window.requestAnimationFrame(draw);
        } catch (cause) {
          reject(cause);
        }
      };
      animationFrame = window.requestAnimationFrame(draw);
    });
    recorder.stop();
    const blob = await completed;
    if (!blob.size) throw new Error("The browser completed MP4 rendering without video data.");
    onProgress(100);
    return blob;
  } catch (cause) {
    cancelAnimationFrame(animationFrame);
    if (recorder?.state === "recording") recorder.stop();
    throw cause;
  } finally {
    soundtrackAudio?.pause();
    for (const asset of assets.values())
      if (asset instanceof HTMLVideoElement) {
        asset.pause();
        asset.removeAttribute("src");
        asset.load();
      }
    if (audioContext && audioContext.state !== "closed") await audioContext.close();
    stream.getTracks().forEach((track) => track.stop());
  }
}
