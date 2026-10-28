import { Heart, MessageCircle, Send, Bookmark, Flag, Trash2 } from "lucide-react";
import type { Reel } from "../types";
interface Props {
  reel: Reel;
  visible: boolean;
  busy?: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onReport?: () => void;
  onDelete?: () => void;
}
export function ReelActions(p: Props) {
  const r = p.reel;
  const count = (n: number) =>
    Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return (
    <div className="rv-actions" onClick={(e) => e.stopPropagation()}>
      {r.canLike !== false && (
        <button
          className={"rv-action-button " + (r.isLiked ? "is-liked" : "")}
          aria-label={r.isLiked ? "Unlike reel" : "Like reel"}
          aria-pressed={r.isLiked}
          disabled={p.busy}
          onClick={p.onLike}
        >
          <span>
            <Heart size={25} fill={r.isLiked ? "currentColor" : "none"} strokeWidth={1.7} />
          </span>
          <small>{count(r.likes)}</small>
        </button>
      )}
      {r.canComment !== false && (
        <button className="rv-action-button" aria-label="Open comments" onClick={p.onComment}>
          <span>
            <MessageCircle size={24} strokeWidth={1.7} />
          </span>
          <small>{count(r.commentCount ?? r.comments.length)}</small>
        </button>
      )}
      {r.canShare !== false && (
        <button className="rv-action-button" aria-label="Share reel" onClick={p.onShare}>
          <span>
            <Send size={23} strokeWidth={1.7} />
          </span>
          <small>Share</small>
        </button>
      )}
      {r.canSave !== false && (
        <button
          className={"rv-action-button " + (r.isSaved ? "is-saved" : "")}
          aria-label={r.isSaved ? "Remove saved reel" : "Save reel"}
          aria-pressed={r.isSaved}
          onClick={p.onSave}
          disabled={p.busy}
        >
          <span>
            <Bookmark size={23} strokeWidth={1.7} fill={r.isSaved ? "currentColor" : "none"} />
          </span>
          <small>{r.isSaved ? "Saved" : "Save"}</small>
        </button>
      )}
      {(r.canReport || r.canDelete) && (
        <details className="rv-more">
          <summary aria-label="More reel options">•••</summary>
          <div>
            {r.canReport && p.onReport && (
              <button onClick={p.onReport}>
                <Flag size={15} />
                Report
              </button>
            )}
            {r.canDelete && p.onDelete && (
              <button onClick={p.onDelete}>
                <Trash2 size={15} />
                Delete
              </button>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
