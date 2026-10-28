import type { Layer, PostDraft, Slide } from "../models";

/**
 * The Figma Post Studio designs layers against a 570 px square canvas
 * (`.post-canvas` width, and the reference for authored font sizes). Published
 * slides are composed at 1080 × 1080 by scaling every value with the same
 * ratio, so the exported image matches the editor preview.
 */
export const POST_DESIGN_SIZE = 570;
export const POST_EXPORT_SIZE = 1080;

type Drawable = CanvasImageSource & { width: number; height: number };

async function loadDrawable(src: string): Promise<Drawable> {
  if (src.startsWith("data:")) {
    return await new Promise<Drawable>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("An image layer could not be decoded."));
      image.src = src;
    });
  }
  // Signed storage URLs are cross-origin; fetch through an authorized request
  // and decode the same-origin blob so the composed canvas is not tainted.
  const response = await fetch(src);
  if (!response.ok) throw new Error("An image layer could not be downloaded for publishing.");
  const bitmap = await createImageBitmap(await response.blob());
  return bitmap;
}

function drawImageCover(context: CanvasRenderingContext2D, layer: Layer, drawable: Drawable) {
  const x = (layer.x / 100) * POST_EXPORT_SIZE;
  const y = (layer.y / 100) * POST_EXPORT_SIZE;
  const width = (layer.width / 100) * POST_EXPORT_SIZE;
  const height = (layer.height / 100) * POST_EXPORT_SIZE;
  const scale = Math.max(width / drawable.width, height / drawable.height);
  const drawWidth = drawable.width * scale;
  const drawHeight = drawable.height * scale;
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.drawImage(
    drawable,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`;
      if (context.measureText(candidate).width <= maxWidth) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawTextLayer(context: CanvasRenderingContext2D, layer: Layer) {
  const x = (layer.x / 100) * POST_EXPORT_SIZE;
  const y = (layer.y / 100) * POST_EXPORT_SIZE;
  const width = (layer.width / 100) * POST_EXPORT_SIZE;
  const height = (layer.height / 100) * POST_EXPORT_SIZE;
  const scale = POST_EXPORT_SIZE / POST_DESIGN_SIZE;
  const fontSize = Math.max(1, (layer.fontSize ?? 20) * scale);
  const lineHeight = fontSize * 1.05;
  context.font = `${layer.fontWeight ?? 800} ${fontSize}px "${layer.fontFamily ?? "Manrope"}", sans-serif`;
  context.textAlign = layer.textAlign ?? "center";
  context.textBaseline = "middle";
  context.fillStyle = layer.color ?? "#26314e";
  const lines = wrapText(context, layer.text ?? "", width);
  const blockHeight = lines.length * lineHeight;
  const firstLineCenter = y + (height - blockHeight) / 2 + lineHeight / 2;
  lines.forEach((line, index) => {
    if (line)
      context.fillText(
        line,
        layer.textAlign === "left" ? x : layer.textAlign === "right" ? x + width : x + width / 2,
        firstLineCenter + index * lineHeight,
        width,
      );
  });
}

async function composeSlide(slide: Slide, index: number): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = POST_EXPORT_SIZE;
  canvas.height = POST_EXPORT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image composition is unavailable in this browser.");
  context.fillStyle = slide.background;
  context.fillRect(0, 0, POST_EXPORT_SIZE, POST_EXPORT_SIZE);
  for (const layer of slide.layers) {
    context.save();
    context.globalAlpha = Math.min(1, Math.max(0, layer.opacity));
    if (layer.rotation) {
      const centerX = ((layer.x + layer.width / 2) / 100) * POST_EXPORT_SIZE;
      const centerY = ((layer.y + layer.height / 2) / 100) * POST_EXPORT_SIZE;
      context.translate(centerX, centerY);
      context.rotate((layer.rotation * Math.PI) / 180);
      context.translate(-centerX, -centerY);
    }
    if (layer.kind === "image" && layer.src) {
      const drawable = await loadDrawable(layer.src);
      drawImageCover(context, layer, drawable);
      if ("close" in drawable && typeof drawable.close === "function") drawable.close();
    } else if (layer.kind === "text" && layer.text) {
      drawTextLayer(context, layer);
    }
    context.restore();
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("A slide could not be composed."))),
      "image/webp",
      0.92,
    );
  });
  return new File([blob], `slide-${index + 1}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

/** Composes every slide of a post draft into the exact published artwork. */
export async function composePostSlides(draft: PostDraft): Promise<File[]> {
  if (document.fonts) await document.fonts.ready;
  const files: File[] = [];
  for (let index = 0; index < draft.slides.length; index += 1) {
    files.push(await composeSlide(draft.slides[index], index));
  }
  return files;
}
