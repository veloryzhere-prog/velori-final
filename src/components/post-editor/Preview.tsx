import { useEffect, useRef, useState } from "react";
import "./Preview.css";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Expand,
  Heart,
  Maximize2,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Send,
  Sun,
  X,
} from "lucide-react";
import type { DraftMediaRecord } from "../../lib/post-media";

const PLATFORMS = ["Instagram", "Facebook", "LinkedIn", "X", "Pinterest", "Threads"] as const;
type Platform = (typeof PLATFORMS)[number];
type Device = "iPhone" | "Android";

const PLATFORM_LABELS: Record<Platform, string> = {
  Instagram: "IG",
  Facebook: "FB",
  LinkedIn: "in",
  X: "X",
  Pinterest: "P",
  Threads: "@",
};

type PostPreviewProps = {
  open: boolean;
  onClose: () => void;
  body: string;
  media: DraftMediaRecord[];
  authorName: string;
  authorHandle: string;
  avatarUrl?: string | null;
  onConfirm: () => void;
};

export function PostPreview({
  open,
  onClose,
  body,
  media,
  authorName,
  authorHandle,
  avatarUrl,
  onConfirm,
}: PostPreviewProps) {
  const [platform, setPlatform] = useState<Platform>("Instagram");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["Instagram", "Facebook"]);
  const [splitMode, setSplitMode] = useState(false);
  const [dark, setDark] = useState(false);
  const [device, setDevice] = useState<Device>("iPhone");
  const [fullScreen, setFullScreen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [slide, setSlide] = useState(0);
  const scrollers = useRef(new Map<string, HTMLDivElement>());
  const orderedMedia = media.slice().sort((a, b) => a.position - b.position);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (fullScreen) setFullScreen(false);
        else onClose();
        return;
      }
      if (
        !fullScreen ||
        (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName))
      )
        return;
      if (event.key === "ArrowRight")
        setSlide((current) => Math.min(current + 1, orderedMedia.length - 1));
      if (event.key === "ArrowLeft") setSlide((current) => Math.max(current - 1, 0));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, fullScreen, onClose, orderedMedia.length]);

  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setSlide(0);
    } else {
      setFullScreen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!orderedMedia.length) return;
    scrollers.current.forEach((node) => {
      const width = node.clientWidth;
      if (width) node.scrollTo({ left: slide * width, behavior: "smooth" });
    });
  }, [slide, orderedMedia.length]);

  if (!open) return null;

  function togglePlatform(item: Platform) {
    setSelectedPlatforms((current) => {
      if (current.includes(item))
        return current.length > 2 ? current.filter((value) => value !== item) : current;
      return current.length < 4 ? [...current, item] : current;
    });
  }

  function previewCard(item: Platform, compact = false) {
    const key = `${item}-${compact ? "split" : "single"}`;
    return (
      <article
        className={`social-preview-card social-preview-${slug(item)}${compact ? " is-compact" : ""}`}
        key={key}
      >
        <header className="social-preview-author">
          <Avatar name={authorName} src={avatarUrl} />
          <span className="social-preview-author-copy">
            <strong>{authorName}</strong>
            <small>@{authorHandle} · Just now</small>
          </span>
          <MoreHorizontal size={19} aria-hidden="true" />
        </header>
        {body.trim() && <p className="social-preview-body">{body}</p>}
        {orderedMedia.length > 0 ? (
          <div
            className="social-preview-carousel"
            ref={(node) => {
              if (node) scrollers.current.set(key, node);
              else scrollers.current.delete(key);
            }}
            onScroll={(event) => {
              const width = event.currentTarget.clientWidth;
              if (width) setSlide(Math.round(event.currentTarget.scrollLeft / width));
            }}
            aria-label={`Post carousel on ${item}`}
          >
            {orderedMedia.map((asset, index) => (
              <div
                className="social-preview-media"
                key={asset.id}
                aria-label={`Slide ${index + 1} of ${orderedMedia.length}`}
              >
                {asset.media_type === "video" ? (
                  <video src={asset.preview_url} controls playsInline preload="metadata" />
                ) : (
                  <img src={asset.preview_url} alt={asset.alt_text || `Post image ${index + 1}`} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="social-preview-empty-media">
            <span>Post media appears here</span>
          </div>
        )}
        {orderedMedia.length > 1 && (
          <div className="social-preview-dots" role="tablist" aria-label="Carousel slides">
            {orderedMedia.map((asset, index) => (
              <button
                key={asset.id}
                type="button"
                role="tab"
                aria-label={`Go to slide ${index + 1}`}
                aria-selected={slide === index}
                onClick={() => setSlide(index)}
              />
            ))}
          </div>
        )}
        <footer className="social-preview-actions" aria-label="Example feed actions">
          <span>
            <Heart size={18} /> Like
          </span>
          <span>
            <MessageCircle size={18} /> Comment
          </span>
          <span>
            <Send size={17} /> Share
          </span>
        </footer>
      </article>
    );
  }

  return (
    <div
      className={`social-preview-backdrop${fullScreen ? " is-fullscreen" : ""}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`social-preview-dialog${dark ? " is-dark" : ""}${fullScreen ? " is-fullscreen" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-preview-title"
      >
        <header className="social-preview-toolbar">
          <div>
            <span className="social-preview-eyebrow">WYSIWYG preview</span>
            <h2 id="social-preview-title">Review your post</h2>
          </div>
          <div className="social-preview-toolbar-actions">
            <div className="social-preview-toggle" role="group" aria-label="Preview appearance">
              <button
                type="button"
                className={!dark ? "is-active" : ""}
                aria-pressed={!dark}
                onClick={() => setDark(false)}
              >
                <Sun size={15} /> Light
              </button>
              <button
                type="button"
                className={dark ? "is-active" : ""}
                aria-pressed={dark}
                onClick={() => setDark(true)}
              >
                <Moon size={15} /> Dark
              </button>
            </div>
            <button
              className="social-preview-icon-button"
              type="button"
              onClick={() => setFullScreen((value) => !value)}
              aria-label={fullScreen ? "Exit full screen" : "Enter full screen"}
            >
              {fullScreen ? <MinimizeIcon /> : <Maximize2 size={17} />}
            </button>
            <button
              className="social-preview-icon-button"
              type="button"
              onClick={onClose}
              aria-label="Close preview"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="social-preview-controls">
          <div className="social-preview-platforms" role="group" aria-label="Preview platform">
            {PLATFORMS.map((item) => (
              <button
                key={item}
                type="button"
                className={platform === item ? "is-active" : ""}
                aria-pressed={platform === item}
                onClick={() => {
                  setPlatform(item);
                  setSplitMode(false);
                }}
              >
                <b>{PLATFORM_LABELS[item]}</b>
                {item}
              </button>
            ))}
          </div>
          <div className="social-preview-view-options">
            <label>
              Device{" "}
              <select value={device} onChange={(event) => setDevice(event.target.value as Device)}>
                <option>iPhone</option>
                <option>Android</option>
              </select>
            </label>
            <button
              type="button"
              className={splitMode ? "is-active" : ""}
              onClick={() => setSplitMode((value) => !value)}
            >
              <Expand size={15} /> Compare
            </button>
          </div>
        </div>

        {splitMode && (
          <div
            className="social-preview-split-pick"
            role="group"
            aria-label="Choose 2 to 4 platforms to compare"
          >
            <span>Compare 2–4 platforms</span>
            {PLATFORMS.map((item) => (
              <button
                key={item}
                type="button"
                className={selectedPlatforms.includes(item) ? "is-active" : ""}
                aria-pressed={selectedPlatforms.includes(item)}
                onClick={() => togglePlatform(item)}
                disabled={selectedPlatforms.includes(item) && selectedPlatforms.length === 2}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        <div className={`social-preview-stage${splitMode ? " is-split" : ""}`}>
          {splitMode ? (
            selectedPlatforms.map((item) => (
              <div
                className={`social-preview-device social-preview-device-${device.toLowerCase()} is-compare`}
                key={item}
              >
                <div className="social-preview-device-label">{item}</div>
                {previewCard(item, true)}
              </div>
            ))
          ) : (
            <div className={`social-preview-device social-preview-device-${device.toLowerCase()}`}>
              <div className="social-preview-device-label">
                {platform} · {device}
              </div>
              {previewCard(platform)}
            </div>
          )}
          {!splitMode && orderedMedia.length > 1 && (
            <div className="social-preview-nav">
              <button
                type="button"
                aria-label="Previous slide"
                disabled={slide === 0}
                onClick={() => setSlide((value) => Math.max(value - 1, 0))}
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                {slide + 1} / {orderedMedia.length}
              </span>
              <button
                type="button"
                aria-label="Next slide"
                disabled={slide === orderedMedia.length - 1}
                onClick={() => setSlide((value) => Math.min(value + 1, orderedMedia.length - 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        <footer className="social-preview-footer">
          <p>
            {confirmed ? (
              <>
                <Check size={16} /> Preview confirmed. Your editor content matches this view.
              </>
            ) : (
              <>Check your copy and media in each selected platform layout before continuing.</>
            )}
          </p>
          <div>
            <button type="button" className="button button-outline" onClick={onClose}>
              Back to edit
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => {
                setConfirmed(true);
                onConfirm();
              }}
            >
              {confirmed ? (
                <>
                  <Check size={16} /> Confirmed
                </>
              ) : (
                "Confirm WYSIWYG preview"
              )}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
  return (
    <span className="social-preview-avatar">
      {src ? <img src={src} alt="" /> : name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/ /g, "-");
}
function MinimizeIcon() {
  return <ArrowLeft size={17} />;
}
