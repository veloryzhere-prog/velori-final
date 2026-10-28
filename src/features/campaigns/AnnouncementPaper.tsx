import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { ArrowUpRight, Check, Feather, X } from "lucide-react";
import { customHtmlDocument } from "../../lib/custom-html-document";
import { safeCampaignUrl } from "./policy.mjs";
import "./campaigns.css";
import "./vintage-scroll.css";
export type AnnouncementCreative = {
  id?: string;
  title: string;
  message: string;
  custom_html?: string;
  custom_css?: string;
  priority?: string;
  media_type?: string;
  media_url?: string;
  media_alt?: string;
  poster_url?: string;
  link?: string;
  cta_label?: string;
  action_type?: string;
  dismissible?: boolean;
  display_mode?: string;
};
export function AnnouncementPaper({
  item,
  preview = false,
  onDismiss,
  onAction,
  onAcknowledge,
}: {
  item: AnnouncementCreative;
  preview?: boolean;
  onDismiss?: () => void;
  onAction?: () => void;
  onAcknowledge?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const id = useId(),
    url = safeCampaignUrl(item.link),
    media = safeCampaignUrl(item.media_url);
  useEffect(() => setFailed(false), [item.media_url]);
  return (
    <article
      className={`cp-paper cp-scroll${item.display_mode === "banner" ? " cp-paper-banner" : ""}`}
      aria-labelledby={item.custom_html ? undefined : id}
      aria-label={item.custom_html ? item.title : undefined}
    >
      <div className="cp-paper-fold" aria-hidden="true">
        <i />
        <span>A LETTER FROM VELORI</span>
        <Feather size={16} />
      </div>
      <div className="cp-scroll-sheet">
        <div className="cp-paper-content">
          <header>
            <span className="cp-paper-seal">v</span>
            <span>
              FROM YOUR VELORI TEAM
              <small>
                {item.priority === "critical"
                  ? "IMPORTANT UPDATE"
                  : "A LITTLE NOTE. A BIG CONNECTION."}
              </small>
            </span>
            {item.dismissible !== false && (onDismiss || preview) && (
              <button
                aria-label={preview ? "Close announcement (preview)" : "Close announcement"}
                onClick={onDismiss}
              >
                <X size={18} />
              </button>
            )}
          </header>
          <div className="cp-letter-body">
            {item.custom_html ? (
              <iframe
                title={item.title + " announcement"}
                sandbox=""
                srcDoc={customHtmlDocument(item.custom_html, item.custom_css || "")}
              />
            ) : (
              <>
                {media &&
                  !failed &&
                  item.media_type !== "none" &&
                  (item.media_type === "video" ? (
                    <video
                      src={media}
                      poster={safeCampaignUrl(item.poster_url) || undefined}
                      controls
                      playsInline
                      preload="metadata"
                      onError={() => setFailed(true)}
                    />
                  ) : (
                    <img src={media} alt={item.media_alt || ""} onError={() => setFailed(true)} />
                  ))}
                <span className="cp-paper-kicker">
                  {item.priority === "critical" ? "PLEASE TAKE A MOMENT" : "JUST BETWEEN US"}
                </span>
                <h2 id={id}>{item.title}</h2>
                <p>{item.message}</p>
              </>
            )}
            {failed && (
              <small className="cp-media-failed" role="status">
                The attachment couldn’t load. You can still read this announcement.
              </small>
            )}
          </div>
          <footer>
            <p className="cp-letter-signature">
              With love, <span>Your Velori team</span>
            </p>
            <div>
              {url &&
                item.action_type !== "none" &&
                (preview ? (
                  <span className="cp-primary">
                    {item.cta_label || "Take a look"}
                    <ArrowUpRight size={16} />
                  </span>
                ) : url.startsWith("/") ? (
                  <Link className="cp-primary" to={url} onClick={onAction}>
                    {item.cta_label || "Take a look"}
                    <ArrowUpRight size={16} />
                  </Link>
                ) : (
                  <a
                    className="cp-primary"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onAction}
                  >
                    {item.cta_label || "Take a look"}
                    <ArrowUpRight size={16} />
                  </a>
                ))}
              {(onAcknowledge || (preview && item.display_mode !== "banner")) && (
                <button
                  className="cp-acknowledge"
                  aria-label={preview ? "Got it (preview)" : undefined}
                  onClick={onAcknowledge}
                >
                  <Check size={15} />
                  Got it
                </button>
              )}
            </div>
            <span>YOUR WORLD. YOUR PEOPLE.</span>
          </footer>
        </div>
      </div>
      <div className="cp-paper-edge" aria-hidden="true">
        <i />
        <span />
        <i />
      </div>
    </article>
  );
}
export function AnnouncementOverlay({
  item,
  onClose,
  onAction,
}: {
  item: AnnouncementCreative;
  onClose: (acknowledged?: boolean) => void;
  onAction: () => void;
}) {
  const box = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = box.current;
    const frame = requestAnimationFrame(() => node?.focus({ preventScroll: true }));
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape" && item.dismissible !== false) {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          node?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],video[controls],iframe",
          ) || [],
        ).filter((x) => x.getClientRects().length);
        if (!nodes.length) {
          e.preventDefault();
          node?.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === nodes[0] || document.activeElement === node)
        ) {
          e.preventDefault();
          nodes.at(-1)?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === nodes.at(-1) || document.activeElement === node)
        ) {
          e.preventDefault();
          nodes[0]?.focus();
        }
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", keyboard);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [item.id, item.dismissible]);
  return createPortal(
    <div
      className="cp-announcement-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && item.dismissible !== false) onClose();
      }}
    >
      <div
        key={item.id || item.title}
        className="cp-letter-arrival"
        ref={box}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label={item.title}
      >
        <AnnouncementPaper
          item={item}
          onDismiss={item.dismissible === false ? undefined : () => onClose()}
          onAcknowledge={() => onClose(true)}
          onAction={onAction}
        />
      </div>
    </div>,
    document.body,
  );
}
