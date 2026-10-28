export const MAX_STORY_MEDIA_BYTES = 100 * 1024 * 1024;
export const MAX_STORY_VIDEO_SECONDS = 60;
export const MAX_STORY_SLIDE_SECONDS = 20;

export const DEFAULT_STORY_MEDIA_SETTINGS = Object.freeze({
  cropZoom: 1,
  cropX: 50,
  cropY: 50,
  rotation: 0,
  flipX: false,
  flipY: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  filter: "none",
  videoStart: 0,
  videoEnd: 15,
  sourceDuration: 15,
  videoSpeed: 1,
  reverse: false,
  stabilize: false,
  backgroundBlur: 0,
  backgroundAssetUrl: null,
  collageLayout: "2x2",
  collageImageUrls: [],
});

export function validateStoryMediaHeader(file, headerBytes) {
  if (!file || typeof file.type !== "string") {
    throw new TypeError("Choose a JPEG, PNG, WebP, GIF, or MP4 file.");
  }
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error("This file is empty.");
  if (file.size > MAX_STORY_MEDIA_BYTES) {
    throw new Error("Story media must be smaller than 100 MB.");
  }

  const bytes = headerBytes instanceof Uint8Array ? headerBytes : new Uint8Array(headerBytes);
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  const valid =
    (file.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (file.type === "image/png" &&
      bytes[0] === 0x89 &&
      ascii(1, 4) === "PNG" &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a) ||
    (file.type === "image/webp" && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") ||
    (file.type === "image/gif" && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) ||
    (file.type === "video/mp4" && ascii(4, 8) === "ftyp");
  if (!valid) throw new Error("The file contents do not match a supported story media type.");
  return file.type === "video/mp4" ? "video" : file.type === "image/gif" ? "gif" : "image";
}

export function clampStoryVideoTrim(start, end, mediaDuration) {
  const duration = Number.isFinite(mediaDuration)
    ? Math.min(Math.max(mediaDuration, 0), MAX_STORY_VIDEO_SECONDS)
    : MAX_STORY_SLIDE_SECONDS;
  const safeStart = Number.isFinite(start)
    ? Math.min(Math.max(start, 0), Math.max(0, duration - 0.1))
    : 0;
  const safeEnd = Number.isFinite(end)
    ? Math.min(Math.max(end, safeStart + 0.1), duration, safeStart + MAX_STORY_SLIDE_SECONDS)
    : Math.min(duration, safeStart + MAX_STORY_SLIDE_SECONDS);
  return { start: safeStart, end: Math.max(safeStart + 0.1, safeEnd) };
}

export function getStoryCollageGrid(layout, itemCount) {
  const count = Math.min(Math.max(Math.trunc(itemCount) || 1, 1), 4);
  if (layout === "1x3") return { columns: 1, rows: count };
  if (layout === "3x1") return { columns: count, rows: 1 };
  if (layout === "custom") {
    const columns = Math.min(2, count);
    return { columns, rows: Math.ceil(count / columns) };
  }
  return { columns: 2, rows: Math.ceil(count / 2) };
}

export function getStoryMediaFilter(settings) {
  const filters = [
    `brightness(${settings.brightness}%)`,
    `contrast(${settings.contrast}%)`,
    `saturate(${settings.saturation}%)`,
    `blur(${settings.blur}px)`,
  ];
  const presets = {
    none: "",
    warm: "sepia(0.18) saturate(1.12)",
    cool: "hue-rotate(12deg) saturate(0.92)",
    mono: "grayscale(1)",
    vivid: "saturate(1.35) contrast(1.08)",
    fade: "saturate(0.78) contrast(0.9) brightness(1.08)",
  };
  if (presets[settings.filter]) filters.push(presets[settings.filter]);
  return filters.join(" ");
}

/** CSS object-fit/object-position geometry, shared by publish rendering and export. */
export function storyMediaPlacement(
  width,
  height,
  sourceWidth,
  sourceHeight,
  fit = "cover",
  cropX = 50,
  cropY = 50,
) {
  if (
    ![width, height, sourceWidth, sourceHeight].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new Error("Story media has no drawable dimensions.");
  const scale =
    fit === "contain"
      ? Math.min(width / sourceWidth, height / sourceHeight)
      : Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = fit === "fill" ? width : sourceWidth * scale;
  const drawHeight = fit === "fill" ? height : sourceHeight * scale;
  const position = (value) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 50)) / 100;
  return {
    x: -width / 2 + (width - drawWidth) * position(cropX),
    y: -height / 2 + (height - drawHeight) * position(cropY),
    width: drawWidth,
    height: drawHeight,
  };
}
