const createId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `export-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const EXPORT_FORMATS = ["png", "pdf", "mp4", "zip"];
export const RESOLUTIONS = [1, 2, 3];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function estimateFileSize({
  width = 1080,
  height = 1920,
  scale = 1,
  quality = 0.9,
  slideCount = 1,
  format = "png",
}) {
  const pixelCount = width * height * scale * scale * slideCount;
  const baseBytes = format === "png" ? 0.95 : format === "pdf" ? 1.1 : format === "mp4" ? 9.5 : 0.8;
  const estimatedBytes = pixelCount * baseBytes * Math.max(0.18, quality);
  return {
    bytes: Math.round(estimatedBytes),
    kb: Number((estimatedBytes / 1024).toFixed(2)),
    mb: Number((estimatedBytes / (1024 * 1024)).toFixed(2)),
  };
}

export function createExportJob(input = {}) {
  const format = EXPORT_FORMATS.includes(input.format) ? input.format : "png";
  const resolution = RESOLUTIONS.includes(input.resolution) ? input.resolution : 2;
  const quality = clamp(Number(input.quality ?? 0.88), 0.1, 1);
  const name = input.name ?? "velori-export";
  const slideCount = Number.isFinite(input.slideCount) ? input.slideCount : 1;

  return {
    id: input.id ?? createId(),
    name,
    format,
    resolution,
    quality,
    slideCount,
    width: Number(input.width ?? 1080),
    height: Number(input.height ?? 1920),
    fileSize: estimateFileSize({
      width: Number(input.width ?? 1080),
      height: Number(input.height ?? 1920),
      scale: resolution,
      quality,
      slideCount,
      format,
    }),
    startedAt: input.startedAt ?? new Date().toISOString(),
    status: input.status ?? "queued",
  };
}

export function buildPngExport({
  width = 1080,
  height = 1920,
  resolution = 2,
  quality = 0.88,
  slides = [],
}) {
  const renderedSlides = slides.length ? slides : [{ id: "default-slide", width, height }];
  return {
    kind: "png",
    resolution,
    quality,
    width: width * resolution,
    height: height * resolution,
    frames: renderedSlides.map((slide, index) => ({
      id: slide.id ?? `slide-${index}`,
      fileName: `${slide.id ?? `slide-${index}`}.png`,
      size: estimateFileSize({
        width,
        height,
        scale: resolution,
        quality,
        slideCount: 1,
        format: "png",
      }),
    })),
    status: "ready",
  };
}

export function buildPdfExport({ slides = [], title = "VELORI Carousel" }) {
  return {
    kind: "pdf",
    title,
    pages: slides.map((slide, index) => ({
      index,
      title: slide.title ?? `Slide ${index + 1}`,
      size: estimateFileSize({
        width: 1080,
        height: 1920,
        scale: 1,
        quality: 0.9,
        slideCount: 1,
        format: "pdf",
      }),
    })),
    status: "ready",
  };
}

export function buildMp4Export({
  slides = [],
  fps = 30,
  duration = 3,
  width = 1080,
  height = 1920,
}) {
  return {
    kind: "mp4",
    fps,
    width,
    height,
    duration,
    totalFrames: Math.round((duration || slides.length) * fps),
    fileSize: estimateFileSize({
      width,
      height,
      scale: 2,
      quality: 0.9,
      slideCount: slides.length || 1,
      format: "mp4",
    }),
    status: "ready",
  };
}

export function buildBulkZip({ slides = [] }) {
  return {
    kind: "zip",
    archiveName: "velori-post-export.zip",
    files: slides.map((slide, index) => ({
      id: slide.id ?? `slide-${index}`,
      name: `${slide.id ?? `slide-${index}`}.png`,
      size: estimateFileSize({
        width: 1080,
        height: 1920,
        scale: 2,
        quality: 0.85,
        slideCount: 1,
        format: "png",
      }),
    })),
    status: "ready",
  };
}

export function createExportDialog(input = {}) {
  const job = createExportJob(input);
  const quality = clamp(Number(input.quality ?? 0.88), 0.1, 1);
  return {
    id: job.id,
    format: job.format,
    resolution: job.resolution,
    quality,
    estimate: job.fileSize,
    fileName: `${job.name}.${job.format === "zip" ? "zip" : job.format}`,
    options: {
      png: [1, 2, 3],
      pdf: [1],
      mp4: [1, 2],
      zip: [1, 2],
    },
  };
}

export function exportSlides(post, options = {}) {
  const slides = Array.isArray(post?.slides) ? post.slides : [];
  const format = EXPORT_FORMATS.includes(options.format) ? options.format : "png";
  const resolution = RESOLUTIONS.includes(options.resolution) ? options.resolution : 2;
  const quality = clamp(Number(options.quality ?? 0.88), 0.1, 1);

  if (format === "png")
    return buildPngExport({ width: 1080, height: 1920, resolution, quality, slides });
  if (format === "pdf") return buildPdfExport({ slides, title: post?.title ?? "VELORI" });
  if (format === "mp4")
    return buildMp4Export({
      slides,
      fps: options.fps ?? 30,
      duration: options.duration ?? slides.length * 3,
      width: 1080,
      height: 1920,
    });
  if (format === "zip") return buildBulkZip({ slides });

  return buildPngExport({ width: 1080, height: 1920, resolution, quality, slides });
}
