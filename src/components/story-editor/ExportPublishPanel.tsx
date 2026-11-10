import { createUuid } from "../../lib/uuid.mjs";
import { Download, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  Slide,
  StoryBrandOverlay,
  StoryShape,
  StorySlideMediaSettings,
  StoryTextOverlay,
} from "../../lib/story-editor/types";
import type { StoryDrawingDocument } from "../../lib/story-editor/drawing-engine";
import type { StudioMusicTrack } from "../../lib/studio-catalog";
import {
  formatStorySchedule,
  getStoryExportDimensions,
  getStoryExportFileName,
  getStoryMp4MimeType,
  parseStorySchedule,
  STORY_EXPORT_RESOLUTIONS,
} from "../../lib/story-editor/export.mjs";
import {
  canvasToPng,
  drawStoryExportFrame,
  prepareStoryExportAssets,
  renderStoryMp4,
  type StoryExportFrame,
} from "../../lib/story-editor/export-renderer";

export interface StoryLocalSchedule {
  id: string;
  scheduledAt: string;
  timeZone: string;
  platform: string;
}

interface ExportPublishPanelProps {
  projectId: string;
  slides: Slide[];
  textOverlaysBySlide: Record<string, StoryTextOverlay[]>;
  shapesBySlide: Record<string, StoryShape[]>;
  drawingsBySlide: Record<string, StoryDrawingDocument>;
  mediaSettingsBySlide: Record<string, StorySlideMediaSettings>;
  brand: StoryBrandOverlay;
  soundtrack: StudioMusicTrack | null;
  archived: boolean;
  schedules: StoryLocalSchedule[];
  onArchiveChange: (archived: boolean) => void;
  onSchedulesChange: (schedules: StoryLocalSchedule[]) => void;
  onSaveHighlightCover: (slideId: string, title: string, background: string) => void;
}

const defaultSettings: StorySlideMediaSettings = {
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
  videoEnd: 0,
  sourceDuration: 0,
  videoSpeed: 1,
  reverse: false,
  stabilize: false,
  backgroundBlur: 0,
  backgroundAssetUrl: null,
  collageLayout: "2x2",
  collageImageUrls: [],
};

function download(blob: Blob, fileName: string): File {
  const file = new File([blob], fileName, { type: blob.type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return file;
}

function makeFrames(
  slides: Slide[],
  overlays: Record<string, StoryTextOverlay[]>,
  shapesBySlide: Record<string, StoryShape[]>,
  drawingsBySlide: Record<string, StoryDrawingDocument>,
  settings: Record<string, StorySlideMediaSettings>,
  brand: StoryBrandOverlay,
): StoryExportFrame[] {
  return slides.map((slide) => ({
    slide,
    textOverlays: overlays[slide.id] ?? [],
    shapes: shapesBySlide[slide.id] ?? [],
    drawing: drawingsBySlide[slide.id],
    mediaSettings: settings[slide.id] ?? defaultSettings,
    brand,
  }));
}

export function ExportPublishPanel({
  projectId,
  slides,
  textOverlaysBySlide,
  shapesBySlide,
  drawingsBySlide,
  mediaSettingsBySlide,
  brand,
  soundtrack,
  archived,
  schedules,
  onArchiveChange,
  onSchedulesChange,
  onSaveHighlightCover,
}: ExportPublishPanelProps) {
  const [resolution, setResolution] = useState("1080p");
  const [selectedSlide, setSelectedSlide] = useState(slides[0]?.id ?? "");
  const [coverTitle, setCoverTitle] = useState("");
  const [coverBackground, setCoverBackground] = useState("#262336");
  const [localDateTime, setLocalDateTime] = useState("");
  const [timeZone, setTimeZone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [schedulePlatform, setSchedulePlatform] = useState("Instagram");
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastExport, setLastExport] = useState<File | null>(null);
  const dimensions = getStoryExportDimensions(resolution);
  const mp4Mime = useMemo(
    () =>
      typeof MediaRecorder === "undefined"
        ? null
        : getStoryMp4MimeType((type) => MediaRecorder.isTypeSupported(type)),
    [],
  );
  const frames = useMemo(
    () =>
      makeFrames(
        slides,
        textOverlaysBySlide,
        shapesBySlide,
        drawingsBySlide,
        mediaSettingsBySlide,
        brand,
      ),
    [brand, drawingsBySlide, mediaSettingsBySlide, shapesBySlide, slides, textOverlaysBySlide],
  );

  async function createCanvas() {
    if (!dimensions) throw new Error("Select a supported export resolution.");
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = dimensions;
    const assets = await prepareStoryExportAssets(frames, brand.logoUrl);
    return { canvas, assets };
  }

  async function exportImage(slideIndex: number, asCover = false) {
    setBusy(true);
    setError("");
    setMessage("");
    setProgress(0);
    try {
      const { canvas, assets } = await createCanvas();
      const frame = frames[slideIndex];
      if (!frame) throw new Error("Choose a valid slide to export.");
      drawStoryExportFrame(canvas, frame, assets);
      if (asCover) {
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser could not draw the highlight cover.");
        context.globalAlpha = 0.5;
        context.fillStyle = coverBackground;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.globalAlpha = 1;
        if (coverTitle.trim()) {
          context.fillStyle = "#ffffff";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.font = `700 ${Math.round(canvas.width * 0.075)}px sans-serif`;
          context.fillText(
            coverTitle.trim(),
            canvas.width / 2,
            canvas.height * 0.82,
            canvas.width * 0.82,
          );
        }
      }
      const blob = await canvasToPng(canvas);
      const fileName = getStoryExportFileName(
        coverTitle || `story-${projectId.slice(0, 8)}`,
        asCover ? null : slideIndex + 1,
        resolution,
        "png",
      );
      setLastExport(download(blob, fileName));
      if (asCover) {
        onSaveHighlightCover(frame.slide.id, coverTitle, coverBackground);
        setMessage("Highlight cover downloaded as PNG.");
      } else {
        setMessage(`Slide ${slideIndex + 1} image exported (${Math.round(blob.size / 1024)} KB).`);
      }
      setProgress(100);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image export failed.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setProgress(null), 1200);
    }
  }

  async function exportVideo(slideIndex?: number) {
    if (!mp4Mime) {
      setError(
        "MP4 encoding is not available in this browser. Use a browser with MediaRecorder MP4 support.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    setProgress(0);
    try {
      const exportFrames =
        slideIndex === undefined ? frames : frames.slice(slideIndex, slideIndex + 1);
      if (!dimensions) throw new Error("Select a supported export resolution.");
      const offset =
        slideIndex === undefined
          ? 0
          : frames
              .slice(0, slideIndex)
              .reduce((total, frame) => total + Math.max(1, frame.slide.duration), 0);
      const excerptEnd = soundtrack?.excerptEndSeconds ?? soundtrack?.durationSeconds ?? null;
      const soundtrackMix =
        soundtrack?.audioUrl &&
        (excerptEnd === null || soundtrack.excerptStartSeconds + offset < excerptEnd)
          ? {
              url: soundtrack.audioUrl,
              startSeconds: soundtrack.excerptStartSeconds + offset,
              endSeconds: excerptEnd,
            }
          : undefined;
      const blob = await renderStoryMp4(
        exportFrames,
        dimensions,
        mp4Mime,
        setProgress,
        soundtrackMix,
      );
      const filename = getStoryExportFileName(
        `story-${projectId.slice(0, 8)}`,
        slideIndex === undefined ? null : slideIndex + 1,
        resolution,
        "mp4",
      );
      setLastExport(download(blob, filename));
      setMessage(
        `MP4 exported (${(blob.size / 1_000_000).toFixed(1)} MB)${soundtrackMix ? ` with ${soundtrack?.title} by ${soundtrack?.artistName}` : ""}.`,
      );
      setProgress(100);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "MP4 export failed.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setProgress(null), 1200);
    }
  }

  async function exportAllImages() {
    setBusy(true);
    setError("");
    try {
      const { canvas, assets } = await createCanvas();
      for (let index = 0; index < frames.length; index += 1) {
        drawStoryExportFrame(canvas, frames[index], assets);
        const blob = await canvasToPng(canvas);
        const fileName = getStoryExportFileName(
          `story-${projectId.slice(0, 8)}`,
          index + 1,
          resolution,
          "png",
        );
        setLastExport(download(blob, fileName));
        setProgress(Math.round(((index + 1) / frames.length) * 100));
      }
      setMessage(`${frames.length} slide images exported as individual PNG files.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image export failed.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setProgress(null), 1200);
    }
  }

  function queueSchedule() {
    setError("");
    try {
      const scheduledAt = parseStorySchedule(localDateTime, timeZone);
      onSchedulesChange([
        ...schedules,
        { id: createUuid(), scheduledAt, timeZone, platform: schedulePlatform },
      ]);
      setMessage(
        `Saved a local reminder for ${formatStorySchedule(scheduledAt, timeZone)}. Automatic publishing requires a connected platform integration.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not schedule this story.");
    }
  }

  async function shareTo(platform: string) {
    setError("");
    if (
      lastExport &&
      typeof navigator.share === "function" &&
      navigator.canShare?.({ files: [lastExport] })
    ) {
      try {
        await navigator.share({ files: [lastExport], title: `Share to ${platform}` });
        setMessage(
          "The file was handed to your device's share sheet. Select the platform and confirm publishing there.",
        );
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "The native share action failed.");
        return;
      }
    }
    const urls: Record<string, string> = {
      Instagram: "https://www.instagram.com/",
      Facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
      WhatsApp: `https://wa.me/?text=${encodeURIComponent("Story ready to publish: " + window.location.href)}`,
      Telegram: `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent("Story ready to publish")}`,
    };
    const opened = window.open(urls[platform], "_blank", "noopener,noreferrer");
    if (!opened) {
      setError(`The browser blocked the ${platform} handoff. Allow pop-ups and try again.`);
      return;
    }
    setMessage(
      `Opened ${platform}. Attach the exported media and complete publishing in the platform.`,
    );
  }

  return (
    <section aria-label="Export and share story" className="story-editor-phase10-panel">
      <header>
        <div>
          <span className="story-editor-eyebrow">READY WHEN YOU ARE</span>
          <h2>Share your story</h2>
          <p>Download the video or continue in a sharing app to finish posting.</p>
        </div>
      </header>
      <button
        className="story-editor-post-action story-editor-download-action"
        disabled={busy}
        onClick={() => void exportVideo()}
        type="button"
      >
        <Download size={17} />
        Download MP4
      </button>
      <button
        className="story-editor-share-link"
        disabled={busy}
        onClick={() => void shareTo(schedulePlatform)}
        type="button"
      >
        <Share2 size={15} />
        Share
      </button>
      {!mp4Mime ? (
        <p className="story-editor-phase10-error" role="status">
          Video download is unavailable in this browser.
        </p>
      ) : null}
      {progress !== null ? (
        <div
          aria-label={`Export progress ${progress}%`}
          className="story-editor-phase10-progress"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${progress}%` }} />
          <small>{progress}%</small>
        </div>
      ) : null}
      {error ? (
        <p className="story-editor-phase10-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="story-editor-phase10-note" role="status">
          {message}
        </p>
      ) : null}

      <details className="story-editor-advanced-options">
        <summary>More story options</summary>
        <fieldset>
          <legend>Download slide images</legend>
          <button disabled={busy} onClick={exportAllImages} type="button">
            Download all slides
          </button>
          {slides.map((slide, index) => (
            <button
              disabled={busy}
              key={slide.id}
              onClick={() => void exportImage(index)}
              type="button"
            >
              Download slide {index + 1}
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>Highlight cover</legend>
          <label>
            Slide
            <select
              onChange={(event) => setSelectedSlide(event.target.value)}
              value={selectedSlide}
            >
              {slides.map((slide, index) => (
                <option key={slide.id} value={slide.id}>
                  Slide {index + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cover text
            <input
              maxLength={48}
              onChange={(event) => setCoverTitle(event.target.value)}
              value={coverTitle}
            />
          </label>
          <label>
            Cover color
            <input
              aria-label="Highlight cover color"
              onChange={(event) => setCoverBackground(event.target.value)}
              type="color"
              value={coverBackground}
            />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              void exportImage(
                slides.findIndex((slide) => slide.id === selectedSlide),
                true,
              )
            }
            type="button"
          >
            Download highlight cover
          </button>
        </fieldset>
        <fieldset>
          <legend>Share options</legend>
          <label>
            App
            <select
              onChange={(event) => setSchedulePlatform(event.target.value)}
              value={schedulePlatform}
            >
              {["Instagram", "Facebook", "WhatsApp", "Telegram"].map((platform) => (
                <option key={platform}>{platform}</option>
              ))}
            </select>
          </label>
          <label>
            Local reminder time
            <input
              onChange={(event) => setLocalDateTime(event.target.value)}
              type="datetime-local"
              value={localDateTime}
            />
          </label>
          <label>
            Time zone
            <input onChange={(event) => setTimeZone(event.target.value)} value={timeZone} />
          </label>
          <button onClick={queueSchedule} type="button">
            Save reminder
          </button>
          {schedules.length ? (
            <ul>
              {schedules.map((schedule) => (
                <li key={schedule.id}>
                  {schedule.platform} ·{" "}
                  {formatStorySchedule(schedule.scheduledAt, schedule.timeZone)}
                  <button
                    aria-label={`Remove ${schedule.platform} reminder`}
                    onClick={() =>
                      onSchedulesChange(schedules.filter((item) => item.id !== schedule.id))
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </fieldset>
        <button
          aria-pressed={archived}
          className="story-editor-phase10-archive"
          onClick={() => onArchiveChange(!archived)}
          type="button"
        >
          {archived ? "Restore draft" : "Archive draft"}
        </button>
      </details>
    </section>
  );
}
