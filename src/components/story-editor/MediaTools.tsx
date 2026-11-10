import {
  Camera,
  FlipHorizontal,
  FlipVertical,
  ImagePlus,
  RotateCcw,
  RotateCw,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type {
  Slide,
  StoryBackgroundType,
  StorySlideMediaSettings,
} from "../../lib/story-editor/types";
import { clampStoryVideoTrim } from "../../lib/story-editor/media-tools.mjs";

interface MediaToolsProps {
  mode?: "all" | "media" | "background";
  slide: Slide;
  settings: StorySlideMediaSettings;
  error: string;
  onSettingsChange: (patch: Partial<StorySlideMediaSettings>) => void;
  onUploadMedia: (files: File[]) => void;
  onUploadCollage: (files: File[]) => void;
  onUploadBackground: (file: File, type: "image" | "video") => void;
  onCapture: (file: File) => void;
  onBackgroundChange: (type: StoryBackgroundType, value: string | null) => void;
}

const filters = [
  ["none", "Original"],
  ["warm", "Warm"],
  ["cool", "Cool"],
  ["mono", "Mono"],
  ["vivid", "Vivid"],
  ["fade", "Fade"],
] as const;

const backgroundTypes: { type: StoryBackgroundType; label: string }[] = [
  { type: "solid", label: "Solid" },
  { type: "gradient", label: "Gradient" },
  { type: "pattern", label: "Pattern" },
  { type: "image", label: "Image" },
  { type: "video", label: "Video" },
];

function RangeControl({
  label,
  max,
  min,
  onChange,
  suffix = "",
  value,
  step = 1,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix?: string;
  value: number;
  step?: number;
}) {
  return (
    <label className="story-editor-media-range">
      <span>
        {label}{" "}
        <small>
          {value}
          {suffix}
        </small>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

export function MediaTools({
  mode = "all",
  slide,
  settings,
  error,
  onSettingsChange,
  onUploadMedia,
  onUploadCollage,
  onUploadBackground,
  onCapture,
  onBackgroundChange,
}: MediaToolsProps) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<HTMLVideoElement | null>(null);
  const mainInput = useRef<HTMLInputElement | null>(null);
  const collageInput = useRef<HTMLInputElement | null>(null);
  const backgroundImageInput = useRef<HTMLInputElement | null>(null);
  const backgroundVideoInput = useRef<HTMLInputElement | null>(null);
  const hasMedia = Boolean(slide.mediaUrl);
  const isVideo = slide.mediaType === "video";

  useEffect(() => {
    if (!cameraOpen) return undefined;
    let active = true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera capture is not supported by this browser.");
      return undefined;
    }
    void navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (cameraRef.current) cameraRef.current.srcObject = stream;
      })
      .catch((cause: unknown) => {
        if (active) {
          setCameraError(
            cause instanceof Error
              ? `Camera unavailable: ${cause.message}`
              : "Camera unavailable. Check browser permissions and try again.",
          );
        }
      });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  function readFiles(event: ChangeEvent<HTMLInputElement>, callback: (files: File[]) => void) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length) callback(files);
  }

  async function takeCameraPhoto() {
    const video = cameraRef.current;
    if (!video || video.videoWidth < 1 || video.videoHeight < 1) {
      setCameraError("Wait for the camera preview before taking a photo.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("This browser could not prepare the camera image.");
      return;
    }
    context.drawImage(video, 0, 0);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("Photo capture failed."))),
          "image/jpeg",
          0.92,
        );
      });
      onCapture(new File([blob], `story-camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      setCameraOpen(false);
    } catch (cause) {
      setCameraError(cause instanceof Error ? cause.message : "Photo capture failed.");
    }
  }

  function selectBackground(type: StoryBackgroundType) {
    if (type === "image") {
      backgroundImageInput.current?.click();
    } else if (type === "video") {
      backgroundVideoInput.current?.click();
    } else if (type === "gradient") {
      onBackgroundChange(type, "sunset");
    } else if (type === "pattern") {
      onBackgroundChange(type, "dots");
    } else {
      onBackgroundChange(type, slide.backgroundType === "solid" ? slide.background : "#1b2947");
    }
  }

  return (
    <section
      aria-label={mode === "background" ? "Story background tools" : "Media and background tools"}
      className="story-editor-media-tools"
      data-tool-mode={mode}
    >
      <div className="story-editor-section-heading">
        <div>
          <span className="story-editor-eyebrow">
            {mode === "background" ? "BACKGROUND" : "MEDIA"}
          </span>
          <h2>
            {mode === "background"
              ? "Choose a backdrop"
              : hasMedia
                ? "Edit this slide"
                : "Add to canvas"}
          </h2>
        </div>
      </div>

      {mode !== "background" ? (
        <div className="story-editor-media-actions">
          <button
            className="story-editor-tool-button"
            onClick={() => mainInput.current?.click()}
            type="button"
          >
            <Upload size={16} /> {hasMedia ? "Replace media" : "Upload media"}
          </button>
          <button
            className="story-editor-tool-button"
            onClick={() => {
              setCameraError("");
              setCameraOpen(true);
            }}
            type="button"
          >
            <Camera size={16} /> Live camera
          </button>
          <button
            className="story-editor-tool-button"
            onClick={() => collageInput.current?.click()}
            type="button"
          >
            <ImagePlus size={16} /> Create collage
          </button>
        </div>
      ) : null}
      {mode !== "background" ? (
        <>
          <input
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
            hidden
            onChange={(event) => readFiles(event, onUploadMedia)}
            ref={mainInput}
            type="file"
          />
          <input
            accept="image/jpeg,image/png,image/webp"
            hidden
            multiple
            onChange={(event) => readFiles(event, onUploadCollage)}
            ref={collageInput}
            type="file"
          />
        </>
      ) : null}

      {error || cameraError ? (
        <p aria-live="polite" className="story-editor-media-error" role="alert">
          {cameraError || error}
          {cameraError ? (
            <button
              aria-label="Dismiss camera error"
              onClick={() => setCameraError("")}
              type="button"
            >
              <X size={13} />
            </button>
          ) : null}
        </p>
      ) : null}

      {cameraOpen && mode !== "background" ? (
        <div
          aria-label="Live camera capture"
          aria-modal="true"
          className="story-editor-camera-backdrop"
          role="dialog"
        >
          <div className="story-editor-camera-dialog">
            <div className="story-editor-camera-heading">
              <strong>Live camera</strong>
              <button aria-label="Close camera" onClick={() => setCameraOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <video autoPlay playsInline ref={cameraRef} />
            <button
              className="story-editor-tool-button"
              onClick={() => void takeCameraPhoto()}
              type="button"
            >
              <Camera size={16} /> Take photo
            </button>
          </div>
        </div>
      ) : null}

      {hasMedia && mode !== "background" ? (
        <details className="story-editor-tool-section" open>
          <summary>{isVideo ? "Video clip" : "Photo adjustments"}</summary>
          {!isVideo ? (
            <>
              <RangeControl
                label="Crop zoom"
                max={3}
                min={1}
                onChange={(cropZoom) => onSettingsChange({ cropZoom })}
                step={0.01}
                suffix="×"
                value={settings.cropZoom}
              />
              <RangeControl
                label="Crop horizontal"
                max={100}
                min={0}
                onChange={(cropX) => onSettingsChange({ cropX })}
                suffix="%"
                value={settings.cropX}
              />
              <RangeControl
                label="Crop vertical"
                max={100}
                min={0}
                onChange={(cropY) => onSettingsChange({ cropY })}
                suffix="%"
                value={settings.cropY}
              />
              <div className="story-editor-media-actions">
                <button
                  className="story-editor-tool-button"
                  onClick={() => onSettingsChange({ rotation: (settings.rotation - 90) % 360 })}
                  type="button"
                >
                  <RotateCcw size={15} /> Rotate left
                </button>
                <button
                  className="story-editor-tool-button"
                  onClick={() => onSettingsChange({ rotation: (settings.rotation + 90) % 360 })}
                  type="button"
                >
                  <RotateCw size={15} /> Rotate right
                </button>
                <button
                  aria-pressed={settings.flipX}
                  className="story-editor-tool-button"
                  onClick={() => onSettingsChange({ flipX: !settings.flipX })}
                  type="button"
                >
                  <FlipHorizontal size={15} /> Flip H
                </button>
                <button
                  aria-pressed={settings.flipY}
                  className="story-editor-tool-button"
                  onClick={() => onSettingsChange({ flipY: !settings.flipY })}
                  type="button"
                >
                  <FlipVertical size={15} /> Flip V
                </button>
              </div>
              <RangeControl
                label="Brightness"
                max={200}
                min={0}
                onChange={(brightness) => onSettingsChange({ brightness })}
                suffix="%"
                value={settings.brightness}
              />
              <RangeControl
                label="Contrast"
                max={200}
                min={0}
                onChange={(contrast) => onSettingsChange({ contrast })}
                suffix="%"
                value={settings.contrast}
              />
              <RangeControl
                label="Saturation"
                max={200}
                min={0}
                onChange={(saturation) => onSettingsChange({ saturation })}
                suffix="%"
                value={settings.saturation}
              />
              <RangeControl
                label="Blur"
                max={20}
                min={0}
                onChange={(blur) => onSettingsChange({ blur })}
                suffix="px"
                value={settings.blur}
              />
              <label className="story-editor-select">
                <span>Filter</span>
                <select
                  onChange={(event) =>
                    onSettingsChange({
                      filter: event.target.value as StorySlideMediaSettings["filter"],
                    })
                  }
                  value={settings.filter}
                >
                  {filters.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <p className="story-editor-tool-hint">
                Trim up to 15 seconds from a video up to 60 seconds long.
              </p>
              <RangeControl
                label="Trim start"
                max={Math.max(0, settings.sourceDuration - 0.1)}
                min={0}
                onChange={(videoStart) => {
                  const trim = clampStoryVideoTrim(
                    videoStart,
                    settings.videoEnd,
                    settings.sourceDuration,
                  );
                  onSettingsChange({ videoStart: trim.start, videoEnd: trim.end });
                }}
                step={0.1}
                suffix="s"
                value={settings.videoStart}
              />
              <RangeControl
                label="Trim end"
                max={Math.min(settings.sourceDuration, settings.videoStart + 15)}
                min={settings.videoStart + 0.1}
                onChange={(videoEnd) => {
                  const trim = clampStoryVideoTrim(
                    settings.videoStart,
                    videoEnd,
                    settings.sourceDuration,
                  );
                  onSettingsChange({ videoStart: trim.start, videoEnd: trim.end });
                }}
                step={0.1}
                suffix="s"
                value={settings.videoEnd}
              />
              <label className="story-editor-select">
                <span>Playback speed</span>
                <select
                  onChange={(event) => onSettingsChange({ videoSpeed: Number(event.target.value) })}
                  value={settings.videoSpeed}
                >
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}×
                    </option>
                  ))}
                </select>
              </label>
              <label className="story-editor-check">
                <input
                  checked={settings.reverse}
                  onChange={(event) => onSettingsChange({ reverse: event.target.checked })}
                  type="checkbox"
                />
                Reverse preview
              </label>
              <label className="story-editor-check">
                <input
                  checked={settings.stabilize}
                  onChange={(event) => onSettingsChange({ stabilize: event.target.checked })}
                  type="checkbox"
                />
                Stabilization crop
              </label>
              {settings.stabilize ? (
                <p className="story-editor-tool-hint">
                  Adds a small crop in preview to hide edge movement; motion-analysis stabilization
                  requires a render pipeline.
                </p>
              ) : null}
            </>
          )}
        </details>
      ) : null}

      {mode !== "media" ? (
        <details className="story-editor-tool-section" open>
          <summary>Slide background</summary>
          <div className="story-editor-background-options">
            {backgroundTypes.map(({ type, label }) => (
              <button
                aria-pressed={slide.backgroundType === type}
                className="story-editor-background-option"
                key={type}
                onClick={() => selectBackground(type)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <input
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) onUploadBackground(file, "image");
            }}
            ref={backgroundImageInput}
            type="file"
          />
          <input
            accept="video/mp4"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) onUploadBackground(file, "video");
            }}
            ref={backgroundVideoInput}
            type="file"
          />
          {slide.backgroundType === "solid" ? (
            <label className="story-editor-color-input">
              <span>Background color</span>
              <input
                onChange={(event) => onBackgroundChange("solid", event.target.value)}
                type="color"
                value={slide.background ?? "#1b2947"}
              />
            </label>
          ) : null}
          {slide.backgroundType === "gradient" ? (
            <label className="story-editor-select">
              <span>Gradient</span>
              <select
                onChange={(event) => onBackgroundChange("gradient", event.target.value)}
                value={slide.background ?? "sunset"}
              >
                <option value="sunset">Sunset</option>
                <option value="twilight">Twilight</option>
                <option value="coastal">Coastal</option>
              </select>
            </label>
          ) : null}
          {slide.backgroundType === "pattern" ? (
            <label className="story-editor-select">
              <span>Pattern</span>
              <select
                onChange={(event) => onBackgroundChange("pattern", event.target.value)}
                value={slide.background ?? "dots"}
              >
                <option value="dots">Dots</option>
                <option value="grid">Grid</option>
                <option value="diagonal">Diagonal</option>
              </select>
            </label>
          ) : null}
        </details>
      ) : null}

      {mode !== "background" ? (
        <details className="story-editor-tool-section">
          <summary>Multi-image collage</summary>
          <label className="story-editor-select">
            <span>Layout</span>
            <select
              onChange={(event) =>
                onSettingsChange({
                  collageLayout: event.target.value as StorySlideMediaSettings["collageLayout"],
                })
              }
              value={settings.collageLayout}
            >
              <option value="2x2">2 × 2</option>
              <option value="1x3">1 × 3</option>
              <option value="3x1">3 × 1</option>
              <option value="custom">Custom (1–4 photos)</option>
            </select>
          </label>
          <p className="story-editor-tool-hint">
            Select up to four photos.{" "}
            {settings.collageImageUrls.length
              ? `${settings.collageImageUrls.length} selected.`
              : ""}
          </p>
          {settings.collageImageUrls.length ? (
            <button
              className="story-editor-tool-button"
              onClick={() => onSettingsChange({ collageImageUrls: [] })}
              type="button"
            >
              <X size={15} /> Clear collage
            </button>
          ) : null}
        </details>
      ) : null}

      {mode !== "background" ? (
        <details className="story-editor-tool-section">
          <summary>Background blur</summary>
          <RangeControl
            label="Gaussian blur"
            max={32}
            min={0}
            onChange={(backgroundBlur) => onSettingsChange({ backgroundBlur })}
            suffix="px"
            value={settings.backgroundBlur}
          />
        </details>
      ) : null}
    </section>
  );
}
