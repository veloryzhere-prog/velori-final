import { useEffect, useRef, useState } from "react";
import { prepareReelAssets, renderReelCover } from "../../lib/reel-editor/frame-renderer.ts";
import {
  getReelMp4MimeType,
  getReelWebmMimeType,
  renderReelMp4,
} from "../../lib/reel-editor/render-reel.ts";
import {
  publishReel,
  supportedReelMimeType,
  type ReelVisibility,
} from "../../lib/reel-editor/publish.ts";
import { projectDuration } from "../../lib/reel-editor/timeline.ts";
import type { ReelProject } from "../../lib/reel-editor/types.ts";

export interface ReelPublishDialogProps {
  project: ReelProject;
  userId: string;
  onClose: () => void;
  onPublished: (reelId: string) => void;
}

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
};

export default function ReelPublishDialog({
  project,
  userId,
  onClose,
  onPublished,
}: ReelPublishDialogProps) {
  const [title, setTitle] = useState(project.name);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<ReelVisibility>("public");
  const [allowComments, setAllowComments] = useState(true);
  const [allowLikes, setAllowLikes] = useState(true);
  const [allowSharing, setAllowSharing] = useState(true);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const duration = projectDuration(project);

  const mp4Mime = supportedReelMimeType();
  const webmMime = getReelWebmMimeType((type) =>
    typeof MediaRecorder === "undefined" ? false : MediaRecorder.isTypeSupported(type),
  );

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    void (async () => {
      try {
        const assets = await prepareReelAssets(project);
        const blob = await renderReelCover(project, assets, project.coverFrameSeconds);
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setCoverUrl(createdUrl);
      } catch {
        setCoverUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [project, project.coverFrameSeconds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const exportFile = async () => {
    const mimeType = mp4Mime ?? webmMime;
    if (!mimeType) {
      setError("This browser cannot record a video file. Use Chrome, Edge, or Safari.");
      return;
    }
    setBusy(true);
    setError("");
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await renderReelMp4(project, {
        mimeType,
        frameRate: 30,
        onProgress: setProgress,
        onStage: setStatus,
        signal: controller.signal,
      });
      const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      downloadBlob(result.blob, `velori-reel.${extension}`);
      setStatus(
        mimeType.startsWith("video/mp4")
          ? "Your reel was rendered and downloaded."
          : "Your reel was rendered as WebM. MP4 is needed to publish it.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your reel could not be rendered.");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const publish = async () => {
    if (!mp4Mime) {
      setError(
        "This browser cannot record an MP4, so your edited reel cannot be published. Use Chrome, Edge, or Safari.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await publishReel({
        userId,
        project,
        title,
        caption,
        visibility,
        allowComments,
        allowLikes,
        allowSharing,
        onStatus: setStatus,
        onProgress: setProgress,
        signal: controller.signal,
      });
      onPublished(result.reelId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your reel could not be published.");
      setStatus("");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="reel-publish-backdrop" role="presentation">
      <section
        className="reel-publish-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reel-publish-title"
      >
        <header className="reel-publish-header">
          <h2 id="reel-publish-title">Publish your reel</h2>
          <button
            type="button"
            className="reel-icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close the publish dialog"
          >
            ×
          </button>
        </header>

        <div className="reel-publish-body">
          <div className="reel-publish-preview">
            <div className="reel-profile-grid">
              {coverUrl ? (
                <img src={coverUrl} alt="Your reel cover" />
              ) : (
                <span className="reel-profile-grid-empty">Cover preview</span>
              )}
            </div>
            <p className="reel-publish-note">
              This is how your reel appears in the profile grid. Change the cover frame in the
              inspector.
            </p>
            <p className="reel-publish-duration">{duration.toFixed(1)}s reel</p>
          </div>

          <div className="reel-publish-fields">
            <label className="reel-field">
              <span className="reel-field-label">Title</span>
              <input
                type="text"
                maxLength={140}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="reel-field">
              <span className="reel-field-label">Caption</span>
              <textarea
                rows={4}
                maxLength={2500}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="reel-field">
              <span className="reel-field-label">Who can watch</span>
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as ReelVisibility)}
                disabled={busy}
              >
                <option value="public">Everyone</option>
                <option value="followers">Followers</option>
                <option value="private">Only me</option>
              </select>
            </label>
            <label className="reel-field reel-field-inline">
              <input
                type="checkbox"
                checked={allowComments}
                onChange={(event) => setAllowComments(event.target.checked)}
                disabled={busy}
              />
              <span>Allow comments</span>
            </label>
            <label className="reel-field reel-field-inline">
              <input
                type="checkbox"
                checked={allowLikes}
                onChange={(event) => setAllowLikes(event.target.checked)}
                disabled={busy}
              />
              <span>Allow likes</span>
            </label>
            <label className="reel-field reel-field-inline">
              <input
                type="checkbox"
                checked={allowSharing}
                onChange={(event) => setAllowSharing(event.target.checked)}
                disabled={busy}
              />
              <span>Allow sharing</span>
            </label>
          </div>
        </div>

        {status ? (
          <p className="reel-publish-status" role="status">
            {status}
            {busy && progress > 0 ? ` ${progress}%` : ""}
          </p>
        ) : null}
        {error ? (
          <p className="reel-inline-error" role="alert">
            {error}
          </p>
        ) : null}
        {!mp4Mime ? (
          <p className="reel-inline-error" role="alert">
            This browser cannot record MP4, so publishing is unavailable. Export a WebM file
            instead.
          </p>
        ) : null}

        <footer className="reel-publish-footer">
          <button
            type="button"
            className="reel-button"
            onClick={exportFile}
            disabled={busy || !project.clips.length}
          >
            Export file
          </button>
          <span className="reel-publish-spacer" />
          {busy ? (
            <button type="button" className="reel-button" onClick={() => abortRef.current?.abort()}>
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            className="reel-button reel-button-primary"
            onClick={publish}
            disabled={busy || !project.clips.length || !mp4Mime}
          >
            Publish reel
          </button>
        </footer>
      </section>
    </div>
  );
}
