import { useEffect, useRef, useState } from "react";
import { Download, Eye } from "lucide-react";
import { Dialog } from "../../../components/ui";
import { composePostMedia } from "../services/compose-post-media";
import type { PostDraft } from "../models";

export function PostPreviewActions({
  draft,
  onError,
}: {
  draft: PostDraft;
  onError: (error?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);
  async function render(download: boolean) {
    setBusy(true);
    onError(undefined);
    try {
      // Preview the exact same full post composition used for publishing.
      // A music post is a continuous video across every slide, not only the active one.
      const files = await composePostMedia(draft);
      const file = files[0];
      if (!file) throw new Error("Add a slide before previewing your post.");
      const next = URL.createObjectURL(file);
      urls.current.forEach(URL.revokeObjectURL);
      urls.current = [next];
      if (download) {
        const link = document.createElement("a");
        link.href = next;
        link.download = file.name;
        link.click();
      } else {
        setUrl(next);
        setOpen(true);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Your preview could not be rendered.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="post-preview-actions">
        <button type="button" onClick={() => void render(false)} disabled={busy}>
          <Eye size={14} />
          {busy ? "Rendering…" : "Preview"}
        </button>
        <button
          type="button"
          onClick={() => void render(true)}
          disabled={busy}
          aria-label="Export post media"
        >
          <Download size={14} /> Export media
        </button>
      </div>
      <Dialog
        open={open}
        title="Your post, ready to share"
        description="This is the rendered artwork that will be published. Your caption stays below the image."
        onClose={() => setOpen(false)}
        className="post-rendered-dialog"
      >
        {draft.soundtrack ? (
          <video
            className="post-rendered-preview"
            src={url}
            controls
            playsInline
            autoPlay
            muted={false}
            aria-label="Rendered post with soundtrack; press play if the browser blocks audio autoplay"
          />
        ) : (
          <img
            className="post-rendered-preview"
            src={url}
            alt="Rendered preview of your current post slide"
          />
        )}
        {draft.caption && <p>{draft.caption}</p>}
        <button className="button button-primary" type="button" onClick={() => setOpen(false)}>
          Back to editing
        </button>
      </Dialog>
    </>
  );
}
