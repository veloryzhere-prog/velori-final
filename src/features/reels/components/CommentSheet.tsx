import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, m, useDragControls } from "framer-motion";
import { X, Heart, Send, MessageCircle, ChevronDown, MoreHorizontal } from "lucide-react";
import { useInterfaceMotion } from "../../../motion/InterfaceMotion";
import { ProfileLink } from "../../../app/social-engagement";
import type { Comment } from "../types";
interface Props {
  open: boolean;
  onClose: () => void;
  comments: Comment[];
  total?: number;
  onSubmit: (text: string, parentId?: string) => Promise<boolean>;
  onLikeComment?: (comment: Comment) => void;
  onReply?: (comment: Comment) => void;
  onDeleteComment?: (comment: Comment) => void;
  onReportComment?: (comment: Comment) => void;
  replyTo?: string;
  onCancelReply?: () => void;
  replyParentId?: string;
  status?: string;
  canComment?: boolean;
}
export function CommentSheet(p: Props) {
  const [text, setText] = useState(""),
    [sending, setSending] = useState(false),
    [sendError, setSendError] = useState("");
  const panel = useRef<HTMLElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    close = useRef<HTMLButtonElement>(null),
    pending = useRef(false);
  const reduced = useInterfaceMotion().reduced,
    drag = useDragControls();
  useEffect(() => {
    if (!p.open) return;
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        p.onClose();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),a[href],textarea,summary,[tabindex="0"]',
          ) ?? [],
        ).filter((x) => x.getClientRects().length > 0);
        const first = nodes[0],
          last = nodes.at(-1);
        if (!first) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus();
    };
  }, [p.open, p.onClose]);
  useEffect(() => {
    if (p.open && p.replyParentId) input.current?.focus();
  }, [p.replyParentId, p.open]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || pending.current || !p.canComment) return;
    pending.current = true;
    setSending(true);
    setSendError("");
    try {
      const saved = await p.onSubmit(value, p.replyParentId);
      if (saved) {
        setText((current) => (current.trim() === value ? "" : current));
      } else setSendError("Your comment wasn’t posted. Your draft is here—try again.");
    } catch {
      setSendError("Couldn’t connect. Your draft is saved here. Try again.");
    } finally {
      pending.current = false;
      setSending(false);
    }
  };
  return (
    <AnimatePresence>
      {p.open && (
        <>
          <m.button
            className="reels-sheet-backdrop"
            aria-label="Close comments"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={p.onClose}
          />
          <m.section
            ref={panel}
            className="reels-comment-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reel-comments-title"
            initial={reduced ? false : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : 30 }}
            transition={{ duration: reduced ? 0 : 0.23 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 650) p.onClose();
            }}
          >
            <div className="reels-sheet-handle" onPointerDown={(e) => drag.start(e)}>
              <span />
            </div>
            <header className="reels-sheet-heading">
              <div>
                <span>GOOD CONVERSATIONS START HERE</span>
                <h2 id="reel-comments-title">
                  The conversation <small>{p.total ?? p.comments.length}</small>
                </h2>
              </div>
              <button ref={close} aria-label="Close comments" onClick={p.onClose}>
                <X size={21} />
              </button>
            </header>
            <div className="reels-comment-list">
              {p.status && (
                <p className="reels-comment-status" role="status">
                  {p.status}
                </p>
              )}
              {p.comments.map((c) => (
                <CommentRow key={c.id} comment={c} actions={p} />
              ))}
              {!p.comments.length && !p.status && (
                <div className="rv-comment-empty">
                  <span>
                    <MessageCircle size={30} />
                  </span>
                  <h3>Say a little something.</h3>
                  <p>
                    A kind word can make someone’s day.
                    <br />
                    Be the first to leave one.
                  </p>
                </div>
              )}
            </div>
            <form className="reels-comment-form" onSubmit={(e) => void submit(e)}>
              {p.replyTo && (
                <div className="reels-reply-context">
                  <span>Replying to {p.replyTo}</span>
                  <button type="button" aria-label="Cancel reply" onClick={p.onCancelReply}>
                    <X size={14} />
                  </button>
                </div>
              )}
              {sendError && (
                <p className="rv-comment-error" role="alert">
                  {sendError}
                </p>
              )}
              {p.canComment ? (
                <>
                  <div className="rv-quick-reactions" aria-label="Add an emoji">
                    {["❤️", "🔥", "👏", "😍", "✨"].map((emoji) => (
                      <button
                        type="button"
                        key={emoji}
                        aria-label={"Add " + emoji}
                        onClick={() => {
                          setText((t) => t + emoji);
                          input.current?.focus();
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="rv-comment-input">
                    <textarea
                      ref={input}
                      aria-label={p.replyTo ? "Write a reply" : "Add a comment"}
                      placeholder={p.replyTo ? "Write a reply…" : "Add a little kindness…"}
                      value={text}
                      maxLength={2000}
                      rows={2}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          e.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!text.trim() || sending}
                      aria-label={sending ? "Posting comment" : "Post comment"}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <small>
                    Keep it kind. Keep it you.
                    <span>{text.length ? text.length + "/2000" : "Ctrl + Enter to post"}</span>
                  </small>
                </>
              ) : (
                <p>Comments are turned off for this reel.</p>
              )}
            </form>
          </m.section>
        </>
      )}
    </AnimatePresence>
  );
}
function CommentRow({ comment: c, actions: p }: { comment: Comment; actions: Props }) {
  const [replies, setReplies] = useState(false);
  const username = c.username.replace(/^@/, "");
  return (
    <article id={"reel-comment-" + c.id} className="reels-comment-row">
      <ProfileLink username={username} className="rv-comment-avatar">
        {c.avatarUrl ? <img src={c.avatarUrl} alt="" /> : <span>{username.slice(0, 1)}</span>}
      </ProfileLink>
      <div className="reels-comment-content">
        <header>
          <ProfileLink username={username}>@{username}</ProfileLink>
          <time>{c.timestamp}</time>
          {(c.canDelete || c.canReport) && (
            <details className="rv-comment-more">
              <summary aria-label="Comment options">
                <MoreHorizontal size={16} />
              </summary>
              <div>
                {c.canDelete && <button onClick={() => p.onDeleteComment?.(c)}>Delete</button>}
                {c.canReport && <button onClick={() => p.onReportComment?.(c)}>Report</button>}
              </div>
            </details>
          )}
        </header>
        <p>{c.text}</p>
        <div className="reels-comment-actions">
          <button onClick={() => p.onReply?.(c)}>Reply</button>
          {p.onLikeComment && (
            <button
              className={c.isLiked ? "is-liked" : ""}
              onClick={() => p.onLikeComment?.(c)}
              aria-label={c.isLiked ? "Unlike comment" : "Like comment"}
              aria-pressed={c.isLiked}
            >
              <Heart size={14} fill={c.isLiked ? "currentColor" : "none"} />
              {c.likes || ""}
            </button>
          )}
        </div>
        {Boolean(c.replies?.length) && (
          <>
            <button
              className="rv-show-replies"
              onClick={() => setReplies(!replies)}
              aria-expanded={replies}
            >
              <span />
              {replies ? "Hide replies" : "View " + c.replies!.length + " replies"}
              <ChevronDown size={13} />
            </button>
            {replies && (
              <div className="reels-comment-replies">
                {c.replies!.map((reply) => (
                  <CommentRow key={reply.id} comment={reply} actions={p} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
