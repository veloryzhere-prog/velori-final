import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  Pause,
  Play,
  Send,
  Volume2,
  VolumeX,
  X,
  MoreHorizontal,
  Flag,
  Trash2,
  RotateCw,
} from "lucide-react";
import { useInterfaceMotion } from "../../motion/InterfaceMotion";
import { MotionSculpture } from "../../motion/MotionSculpture";
import { ProfileLink } from "../../app/social-engagement";
import { storyGesture } from "./navigation.mjs";
import { authorSession } from "./author-session.mjs";
import { storyDisplaySeconds } from "../../lib/composition";
import "./stories.css";

export type StoryMoment = {
  id: string;
  author_id: string;
  caption: string;
  mediaSrc: string;
  media_type: "image" | "video" | "text";
  visual_duration_seconds?: number;
  status?: "active" | "archived";
  audience?: "public" | "followers" | "close_friends" | "private";
  created_at: string;
  allow_reactions: boolean;
  allow_replies: boolean;
  profiles: { username: string; display_name: string; avatar_url: string | null } | null;
};
type Props = {
  stories: StoryMoment[];
  index: number;
  viewerId?: string;
  liked: boolean;
  busy: boolean;
  replyBusy: boolean;
  error: string;
  status: string;
  engagement: ReactNode;
  onIndex: (index: number) => void;
  onClose: () => void;
  onLike: () => void;
  onReply: (text: string) => Promise<boolean>;
  onDelete: () => void;
  onReport: () => void;
  onRetryMedia?: () => Promise<void>;
};
export function StoryExperience(p: Props) {
  const { mode } = useInterfaceMotion();
  const story = p.stories[p.index];
  const session = authorSession(p.stories, p.index);
  const [paused, setPaused] = useState(false),
    [holding, setHolding] = useState(false),
    [hidden, setHidden] = useState(document.hidden);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [muted, setMuted] = useState(false),
    [ready, setReady] = useState(false),
    [playing, setPlaying] = useState(false);
  const [mediaError, setMediaError] = useState(false),
    [retrying, setRetrying] = useState(false),
    [retry, setRetry] = useState(0),
    [progress, setProgress] = useState(0);
  const [reply, setReply] = useState(""),
    [replyFocus, setReplyFocus] = useState(false),
    [menu, setMenu] = useState(false);
  const [heart, setHeart] = useState(0),
    [showHeart, setShowHeart] = useState(false);
  const video = useRef<HTMLVideoElement>(null),
    close = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLDivElement>(null);
  const progressValue = useRef(0),
    pending = useRef(false),
    start = useRef<{ x: number; y: number; time: number } | null>(null),
    suppress = useRef(0);
  const callbacks = useRef(p);
  callbacks.current = p;
  const menuOpen = useRef(menu);
  menuOpen.current = menu;
  const stopped =
    paused || holding || hidden || replyFocus || !!reply.trim() || menu || p.busy || p.replyBusy;
  const move = (amount: number) => {
    if (p.busy || p.replyBusy || reply.trim() || !session) return;
    const next = amount > 0 ? session.nextMoment : session.previousMoment;
    if (next === null) {
      if (amount > 0) p.onClose();
      return;
    }
    p.onIndex(next);
  };
  const moveCreator = (direction: number) => {
    if (p.busy || p.replyBusy || reply.trim() || !session) return;
    const next = direction > 0 ? session.nextAuthor : session.previousAuthor;
    if (next !== null) p.onIndex(next);
  };
  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(() => {
    setReady(story?.media_type === "text");
    setMediaError(story?.media_type !== "text" && !story?.mediaSrc);
    setPlaying(false);
    setProgress(0);
    progressValue.current = 0;
    setReply("");
    setReplyFocus(false);
    setMenu(false);
    setShowHeart(false);
  }, [story?.id, story?.mediaSrc, retry]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const visibility = () => setHidden(document.hidden);
    const keyboard = (event: KeyboardEvent) => {
      const nested = dialog.current?.querySelector<HTMLElement>(".social-dialog");
      if (event.key === "Escape") {
        if (nested) return;
        if (menuOpen.current) {
          event.preventDefault();
          setMenu(false);
          return;
        }
        event.preventDefault();
        callbacks.current.onClose();
        return;
      }
      if (event.key === "Tab") {
        const nodes = Array.from(
          (nested || dialog.current)?.querySelectorAll<HTMLElement>(
            'a[href],button:not(:disabled),input,textarea,summary,[tabindex="0"]',
          ) || [],
        ).filter((x) => x.getClientRects().length);
        const first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }
      if ((event.target as HTMLElement)?.closest('input,textarea,[contenteditable="true"]')) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveRef.current(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveRef.current(-1);
      }
      if (event.code === "Space" && !(event.target as HTMLElement)?.closest("button,a,summary")) {
        event.preventDefault();
        setPaused((x) => !x);
      }
    };
    window.addEventListener("keydown", keyboard);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", keyboard);
      document.removeEventListener("visibilitychange", visibility);
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const node = video.current;
    if (!node) return;
    if (stopped) node.pause();
    else
      void node.play().catch((cause) => {
        if (cause?.name !== "AbortError") {
          setPlaying(false);
          setAudioBlocked(true);
        }
      });
  }, [stopped, story?.id, ready, retry]);
  useEffect(() => {
    if (!ready || stopped || mediaError || (story.media_type === "video" && !playing)) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(),
        elapsed = now - previous;
      previous = now;
      const node = video.current;
      const value =
        story.media_type === "video" && node
          ? node.duration > 0
            ? node.currentTime / node.duration
            : 0
          : progressValue.current +
            elapsed / (storyDisplaySeconds(story.visual_duration_seconds) * 1000);
      progressValue.current = Math.min(1, value);
      setProgress(progressValue.current);
      if (value >= 1 && story.media_type !== "video") {
        clearInterval(timer);
        moveRef.current(1);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [ready, stopped, playing, story?.id, story?.visual_duration_seconds, mediaError]);
  if (!story) return null;
  const own = p.viewerId === story.author_id,
    active = story.status !== "archived";
  const name = story.profiles?.display_name || "@" + (story.profiles?.username || "member");
  const canLike = !!p.viewerId && active && story.allow_reactions;
  const canReply = !!p.viewerId && active && !own && story.allow_replies;
  const authorIndices = session?.indices ?? [p.index];
  const segmentStart = Math.max(
    0,
    Math.min((session?.position ?? 0) - 4, authorIndices.length - 9),
  );
  const thumbnail = (item: StoryMoment, className: string) => (
    <div className={className}>
      {item.mediaSrc && item.media_type === "image" ? (
        <img src={item.mediaSrc} alt="" loading="lazy" />
      ) : (
        <span>{item.caption || "A moment in motion"}</span>
      )}
      <small>@{item.profiles?.username || "member"}</small>
    </div>
  );
  return createPortal(
    <div
      className="sv-world"
      onPointerDownCapture={(event) => {
        if (menu && !(event.target as HTMLElement).closest(".sv-more")) setMenu(false);
      }}
      data-motion={mode}
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={`Story by ${name}`}
    >
      <div className="sv-atmosphere" aria-hidden="true">
        <i />
        <i />
        <span />
      </div>
      <header className="sv-top">
        <Link to="/home" className="sv-wordmark">
          velori<span>✳</span>
        </Link>
        <span>STORIES / A LITTLE CLOSER</span>
        <button ref={close} className="sv-icon" onClick={p.onClose} aria-label="Close story">
          <X size={21} />
        </button>
      </header>
      <div className="sv-layout">
        <aside className="sv-editorial">
          <span className="sv-eyebrow">HERE FOR A MOMENT.</span>
          <h1>
            Stay for
            <br />
            the <em>feeling.</em>
          </h1>
          <p>
            Small windows into
            <br />
            your people’s worlds.
          </p>
          <MotionSculpture compact />
          <div className="sv-instructions">
            <span>← → &nbsp; Move between stories</span>
            <span>Hold &nbsp; Take a little longer</span>
            <span>Space &nbsp; Pause the moment</span>
          </div>
        </aside>
        <section className="sv-stage" aria-label="Story media">
          <div
            className="sv-card"
            data-creator={story.author_id}
            key={story.author_id + ":" + story.id + ":" + retry}
          >
            <div
              className="sv-media"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button,a")) return;
                start.current = { x: e.clientX, y: e.clientY, time: Date.now() };
                setHolding(true);
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                start.current = null;
                setHolding(false);
              }}
              onPointerUp={(e) => {
                const point = start.current;
                start.current = null;
                setHolding(false);
                if (!point) return;
                const action = storyGesture(
                  e.clientX - point.x,
                  e.clientY - point.y,
                  Date.now() - point.time,
                );
                if (action !== "tap") {
                  suppress.current = Date.now() + 400;
                  if (action === "close") p.onClose();
                  if (action === "next") moveCreator(1);
                  if (action === "previous") moveCreator(-1);
                  return;
                }
                if (Date.now() < suppress.current) return;
                const box = e.currentTarget.getBoundingClientRect();
                move(e.clientX - box.left < box.width * 0.3 ? -1 : 1);
              }}
            >
              {story.mediaSrc && story.media_type !== "text" ? (
                story.media_type === "video" ? (
                  <video
                    ref={video}
                    src={story.mediaSrc}
                    muted={muted}
                    playsInline
                    autoPlay
                    preload="metadata"
                    onLoadedData={() => setReady(true)}
                    onCanPlay={() => setReady(true)}
                    onPlaying={() => {
                      setPlaying(true);
                      setAudioBlocked(false);
                    }}
                    onWaiting={() => setPlaying(false)}
                    onPause={() => setPlaying(false)}
                    onError={() => {
                      setMediaError(true);
                      setReady(false);
                    }}
                    onEnded={() => move(1)}
                  />
                ) : (
                  <img
                    src={story.mediaSrc}
                    alt={story.caption || "Story photo"}
                    onLoad={() => setReady(true)}
                    onError={() => {
                      setMediaError(true);
                      setReady(false);
                    }}
                  />
                )
              ) : story.media_type === "text" ? (
                <div className="sv-text-story">
                  <span>THOUGHTS, OUT LOUD.</span>
                  <p>{story.caption || "A moment shared on VELORI."}</p>
                  <i>velori</i>
                </div>
              ) : null}
            </div>
            {!ready && !mediaError && (
              <div className="sv-media-state" role="status">
                <span className="sv-loader" />
                Loading this moment…
              </div>
            )}
            {mediaError && (
              <div className="sv-media-state" role="alert">
                <p>This moment couldn’t load.</p>
                <button
                  disabled={retrying}
                  onClick={async () => {
                    setRetrying(true);
                    try {
                      await p.onRetryMedia?.();
                      setRetry((x) => x + 1);
                    } catch {
                      setMediaError(true);
                    } finally {
                      setRetrying(false);
                    }
                  }}
                >
                  <RotateCw size={16} /> {retrying ? "Loading…" : "Try again"}
                </button>
                <button onClick={() => move(1)}>
                  Next story <ArrowRight size={16} />
                </button>
              </div>
            )}
            <div className="sv-top-overlay">
              <div
                className="sv-progress"
                aria-label={`Story ${(session?.position ?? 0) + 1} of ${authorIndices.length} from ${name}`}
              >
                {authorIndices.slice(segmentStart, segmentStart + 9).map((i) => {
                  const item = p.stories[i];
                  return (
                    <button
                      key={item.id}
                      aria-label={`View ${name} story ${authorIndices.indexOf(i) + 1}`}
                      aria-current={i === p.index ? "step" : undefined}
                      disabled={p.busy || p.replyBusy || !!reply.trim()}
                      onClick={() => p.onIndex(i)}
                    >
                      <i
                        style={{
                          transform: `scaleX(${i < p.index ? 1 : i === p.index ? progress : 0})`,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="sv-author-row">
                <ProfileLink className="sv-author" username={story.profiles?.username}>
                  <span className="sv-avatar">
                    {story.profiles?.avatar_url ? (
                      <img src={story.profiles.avatar_url} alt="" />
                    ) : (
                      name.slice(0, 1)
                    )}
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <small>
                      {new Date(story.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {active ? "24-hour story" : "From your archive"}
                    </small>
                  </span>
                </ProfileLink>
                <button
                  className="sv-icon"
                  aria-label={paused ? "Resume story" : "Pause story"}
                  aria-pressed={paused}
                  onClick={() => setPaused((x) => !x)}
                >
                  {paused ? <Play size={18} /> : <Pause size={18} />}
                </button>
                {story.media_type === "video" && (
                  <button
                    className="sv-icon"
                    aria-label={muted ? "Unmute story" : "Mute story"}
                    onClick={() => setMuted((x) => !x)}
                  >
                    {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                )}
                {p.viewerId && (
                  <div className="sv-more">
                    <button
                      className="sv-icon"
                      aria-label="Story options"
                      aria-expanded={menu}
                      onClick={() => setMenu((x) => !x)}
                    >
                      <MoreHorizontal size={19} />
                    </button>
                    {menu && (
                      <div className="sv-menu">
                        {own ? (
                          <button disabled={p.busy} onClick={p.onDelete}>
                            <Trash2 size={16} />
                            Delete story
                          </button>
                        ) : active ? (
                          <button
                            disabled={p.busy}
                            onClick={() => {
                              p.onReport();
                              setMenu(false);
                            }}
                          >
                            <Flag size={16} />
                            Report story
                          </button>
                        ) : (
                          <span>Archived moment</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {holding && <span className="sv-hold-label">Taking a little longer</span>}
            {(paused || audioBlocked) && (
              <button
                className="sv-play-overlay"
                aria-label="Resume story playback"
                onClick={() => {
                  setPaused(false);
                  setAudioBlocked(false);
                  void video.current?.play().catch(() => setAudioBlocked(true));
                }}
              >
                <Play size={24} />
              </button>
            )}
            {showHeart && mode !== "off" && (
              <div
                key={heart}
                className="sv-love-burst"
                aria-hidden="true"
                onAnimationEnd={() => setShowHeart(false)}
              >
                <Heart size={100} fill="currentColor" strokeWidth={1} />
                <i />
                <i />
                <i />
              </div>
            )}
            <div className="sv-bottom-overlay">
              {story.caption && story.mediaSrc && <p className="sv-caption">{story.caption}</p>}
              {(p.error || p.status) && (
                <p className="sv-feedback" role={p.error ? "alert" : "status"}>
                  {p.error || p.status}
                </p>
              )}
              <div className="sv-engagement" onClickCapture={() => setPaused(true)}>
                {p.engagement}
              </div>
              <div className="sv-reply-row">
                {canReply ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (pending.current || !reply.trim()) return;
                      pending.current = true;
                      const sent = reply;
                      try {
                        if (await p.onReply(sent))
                          setReply((current) => (current === sent ? "" : current));
                      } finally {
                        pending.current = false;
                      }
                    }}
                  >
                    <input
                      aria-label="Reply to this story"
                      placeholder={`Message ${story.profiles?.username || "the author"}…`}
                      value={reply}
                      maxLength={1000}
                      onFocus={() => setReplyFocus(true)}
                      onBlur={() => setReplyFocus(false)}
                      onChange={(e) => setReply(e.target.value)}
                    />
                    <button
                      disabled={p.replyBusy || !reply.trim()}
                      aria-label="Send story reply"
                      type="submit"
                    >
                      <Send size={19} />
                    </button>
                  </form>
                ) : (
                  <span className="sv-reply-note">
                    {own
                      ? !active
                        ? "Your archived story."
                        : story.audience === "private"
                          ? "Only you can see this story."
                          : story.audience === "close_friends"
                            ? "Shared with your close friends."
                            : story.audience === "followers"
                              ? "Shared with your followers."
                              : story.audience === "public"
                                ? "Shared publicly."
                                : "Your story."
                      : active
                        ? "Just a moment worth being here for."
                        : "A memory from your archive."}
                  </span>
                )}
                {canLike && (
                  <button
                    className={`sv-like${p.liked ? " is-liked" : ""}`}
                    disabled={p.busy}
                    aria-label={p.liked ? "Unlike story" : "Like story"}
                    aria-pressed={p.liked}
                    onClick={() => {
                      if (!p.liked) {
                        setHeart((x) => x + 1);
                        setShowHeart(true);
                      }
                      p.onLike();
                    }}
                  >
                    <Heart size={23} fill={p.liked ? "currentColor" : "none"} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <footer className="sv-stage-footer">
            <span>
              {String(p.index + 1).padStart(2, "0")}{" "}
              <i>/ {String(p.stories.length).padStart(2, "0")}</i>
            </span>
            <span>
              {reply.trim()
                ? "Draft ready · send when you’re ready"
                : stopped
                  ? "A moment on pause"
                  : "Tap to explore. Hold to stay."}
            </span>
          </footer>
          <button
            className="sv-step sv-step-back"
            disabled={p.index === 0 || p.busy || p.replyBusy || !!reply.trim()}
            onClick={() => move(-1)}
            aria-label="Previous story"
          >
            <ArrowLeft size={21} />
          </button>
          <button
            className="sv-step sv-step-next"
            disabled={p.busy || p.replyBusy || !!reply.trim()}
            onClick={() => move(1)}
            aria-label={p.index === p.stories.length - 1 ? "Finish stories" : "Next story"}
          >
            <ArrowRight size={21} />
          </button>
        </section>
        <aside className="sv-up-next">
          <span className="sv-eyebrow">IN YOUR CIRCLE</span>
          {p.stories[p.index + 1] ? (
            <button
              disabled={p.busy || p.replyBusy || !!reply.trim()}
              onClick={() => move(1)}
              aria-label="Open next story"
            >
              {thumbnail(p.stories[p.index + 1], "sv-peek")}
              <span>
                Up next <ArrowRight size={16} />
              </span>
            </button>
          ) : (
            <div className="sv-finished">
              <Heart size={28} />
              <p>You’re all caught up.</p>
              <button onClick={p.onClose}>
                Back to your world <ArrowRight size={15} />
              </button>
            </div>
          )}
          <span className="sv-side-note">
            REAL PEOPLE.
            <br />
            FLEETING MOMENTS.
            <br />
            YOUR VELORI.
          </span>
        </aside>
      </div>
    </div>,
    document.body,
  );
}
