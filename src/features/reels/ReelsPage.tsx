import { SponsoredCard, useAdvertisement, type AdCreative } from "../campaigns/SponsoredCard";
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, m } from "framer-motion";
import { ArrowDown, ArrowUp, Clapperboard, Heart, Mouse, Plus } from "lucide-react";
import { useInterfaceMotion } from "../../motion/InterfaceMotion";
import { ReelCard } from "./components/ReelCard";
import { CommentSheet } from "./components/CommentSheet";
import { ReelsHeader } from "./components/ReelsHeader";
import { reelSwipeDirection, reelWheelDirection } from "./gestures.mjs";
import { REEL_DEACTIVATE_EVENT } from "./reel-video-events.mjs";
import type { Comment, Reel } from "./types";
export interface ReelsPageProps {
  advertisement?: AdCreative | null;
  reels: Reel[];
  currentIndex?: number;
  commentsOpen?: boolean;
  loading?: boolean;
  loadingMore?: boolean;
  actionBusy?: boolean;
  error?: string;
  hasMore?: boolean;
  onBack?: () => void;
  onDismiss?: () => void;
  onRetry?: () => void;
  onLoadMore?: () => void;
  onIndexChange?: (index: number) => void;
  onCommentsOpenChange?: (open: boolean) => void;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onShare: (id: string) => void;
  onFollow: (id: string) => void;
  onReport?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddComment: (reelId: string, text: string, parentId?: string) => Promise<boolean>;
  onLikeComment?: (comment: Comment) => void;
  onReply?: (comment: Comment) => void;
  onDeleteComment?: (comment: Comment) => void;
  onReportComment?: (comment: Comment) => void;
  replyTo?: string;
  onCancelReply?: () => void;
  replyParentId?: string;
  commentStatus?: string;
  onSearch?: () => void;
  onDM?: () => void;
  onCreate?: () => void;
  shareDialog?: ReactNode;
}

export function ReelsPage(p: ReelsPageProps) {
  const liveAdvertisement = useAdvertisement("reels");
  const advertisement = p.advertisement === undefined ? liveAdvertisement : p.advertisement;
  const [showAd, setShowAd] = useState(false);
  const shownAdvertisements = useRef(new Set<string>());
  useEffect(() => {
    if (!advertisement) setShowAd(false);
  }, [advertisement]);
  const [localIndex, setLocalIndex] = useState(0),
    [localComments, setLocalComments] = useState(false),
    [direction, setDirection] = useState(1),
    [notice, setNotice] = useState("");
  const index = p.currentIndex ?? localIndex,
    commentsOpen = p.commentsOpen ?? localComments,
    reel = p.reels[index],
    reduced = useInterfaceMotion().reduced;
  const swipe = useRef<{ x: number; y: number; at: number } | null>(null),
    ignoreClickUntil = useRef(0),
    wheel = useRef({ sum: 0, at: 0, lock: 0 }),
    advanceFrom = useRef<number | null>(null);
  const player = useRef<HTMLDivElement>(null);
  const deactivateCurrentReel = useCallback(() => {
    player.current?.querySelector("video")?.dispatchEvent(new Event(REEL_DEACTIVATE_EVENT));
  }, []);
  const select = useCallback(
    (next: number) => {
      if (next < 0 || next >= p.reels.length || next === index) return;
      deactivateCurrentReel();
      setDirection(next > index ? 1 : -1);
      setLocalIndex(next);
      setNotice("");
      p.onIndexChange?.(next);
    },
    [deactivateCurrentReel, index, p.onIndexChange, p.reels.length],
  );
  const move = useCallback(
    (delta: number) => {
      if (commentsOpen) return;
      if (showAd) {
        setShowAd(false);
        if (delta < 0) return;
      } else if (
        delta > 0 &&
        advertisement &&
        index >= 2 &&
        (index + 1) % 3 === 0 &&
        !shownAdvertisements.current.has(advertisement.id || "current")
      ) {
        shownAdvertisements.current.add(advertisement.id || "current");
        deactivateCurrentReel();
        setShowAd(true);
        return;
      }
      if (delta < 0) {
        select(index - 1);
        return;
      }
      if (index < p.reels.length - 1) {
        select(index + 1);
        return;
      }
      if (p.hasMore) {
        if (!p.loadingMore && advanceFrom.current === null) {
          advanceFrom.current = p.reels.length;
          p.onLoadMore?.();
        }
      } else setNotice("You’re all caught up. Swipe down to watch again.");
    },
    [
      commentsOpen,
      index,
      p.reels.length,
      p.hasMore,
      p.loadingMore,
      p.onLoadMore,
      select,
      showAd,
      advertisement,
      deactivateCurrentReel,
    ],
  );
  const openComments = useCallback(
    (open: boolean) => {
      setLocalComments(open);
      p.onCommentsOpenChange?.(open);
    },
    [p.onCommentsOpenChange],
  );
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  useEffect(() => {
    if (advanceFrom.current !== null && p.reels.length > advanceFrom.current) {
      const next = advanceFrom.current;
      advanceFrom.current = null;
      select(next);
    }
    if (p.error) advanceFrom.current = null;
  }, [p.reels.length, p.error, select]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        commentsOpen ||
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        (target instanceof Element &&
          target.closest("input,textarea,select,[contenteditable=true],[role=slider]"))
      )
        return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        move(e.key === "ArrowDown" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commentsOpen, move]);
  useEffect(() => {
    const el = player.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (commentsOpen || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = Date.now();
      if (now < wheel.current.lock) return;
      if (now - wheel.current.at > 180) wheel.current.sum = 0;
      wheel.current.at = now;
      const result = reelWheelDirection(wheel.current.sum, e.deltaY * (e.deltaMode === 1 ? 16 : 1));
      wheel.current.sum = result.sum;
      if (result.direction) {
        wheel.current = { sum: 0, at: now, lock: now + 750 };
        move(result.direction);
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [move, commentsOpen, reel?.id]);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (
      !e.isPrimary ||
      commentsOpen ||
      (e.target instanceof Element && e.target.closest("button,a,input,textarea,[role=slider]"))
    )
      return;
    swipe.current = { x: e.clientX, y: e.clientY, at: Date.now() };
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const d = reelSwipeDirection(e.clientX - start.x, e.clientY - start.y, Date.now() - start.at);
    if (d) {
      ignoreClickUntil.current = Date.now() + 400;
      move(d);
    }
  };
  return (
    <main className="rv-screen" data-comments-open={commentsOpen || undefined}>
      <ReelsHeader
        onBack={p.onBack}
        onSearch={p.onSearch}
        onDM={p.onDM}
        onCreate={p.onCreate}
        visible
      />
      <div className="rv-layout">
        <aside className="rv-introduction">
          <span className="rv-eyebrow">A FRESH POINT OF VIEW</span>
          <h1>
            A little
            <br />
            more <em>motion.</em>
          </h1>
          <p>
            Small moments.
            <br />
            New perspectives.
            <br />
            Made by your people.
          </p>
          <div className="rv-instructions">
            <span>
              <Mouse size={16} />
              Scroll or swipe to explore
            </span>
            <span>
              <Heart size={16} />
              Double-tap to show some love
            </span>
          </div>
          {p.onCreate && (
            <button onClick={p.onCreate}>
              <Plus size={17} />
              Make your own reel
            </button>
          )}
          <small>VELORI · YOUR WORLD, IN MOTION.</small>
        </aside>
        {reel ? (
          <>
            <section className="rv-theater" aria-label="Reel viewer">
              <div
                ref={player}
                className="reels-swipe-container"
                onPointerDown={down}
                onPointerUp={up}
                onPointerCancel={() => {
                  swipe.current = null;
                }}
                onClickCapture={(e) => {
                  if (Date.now() < ignoreClickUntil.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                <AnimatePresence initial={false} mode="wait">
                  <m.div
                    key={showAd && advertisement ? "advertisement-" + advertisement.id : reel.id}
                    className="reel-card-container"
                    initial={reduced ? false : { opacity: 0, y: direction * 38, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={
                      reduced ? { opacity: 0 } : { opacity: 0, y: direction * -38, scale: 0.985 }
                    }
                    transition={{ duration: reduced ? 0 : 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    {showAd && advertisement ? (
                      <SponsoredCard ad={advertisement} reel onSkip={() => move(1)} />
                    ) : (
                      <ReelCard
                        reel={reel}
                        isActive={!commentsOpen}
                        actionBusy={p.actionBusy}
                        onRetryMedia={p.onRetry}
                        onOpenComments={() => openComments(true)}
                        onLike={() => p.onLike(reel.id)}
                        onSave={() => p.onSave(reel.id)}
                        onShare={() => p.onShare(reel.id)}
                        onFollow={() => p.onFollow(reel.user.id)}
                        onReport={p.onReport ? () => p.onReport?.(reel.id) : undefined}
                        onDelete={p.onDelete ? () => p.onDelete?.(reel.id) : undefined}
                      />
                    )}
                  </m.div>
                </AnimatePresence>
              </div>
              <div className="rv-under-player">
                <span>{showAd ? "SPONSORED · VELORI AD" : "FOR YOU"}</span>
                <span>
                  Swipe up for the next moment <ArrowUp size={12} />
                </span>
              </div>
            </section>
            <aside className="rv-navigation" aria-label="Reel navigation">
              <span>
                {String(index + 1).padStart(2, "0")}
                <i>/ {String(p.reels.length).padStart(2, "0")}</i>
              </span>
              <button aria-label="Previous reel" disabled={index === 0} onClick={() => move(-1)}>
                <ArrowUp size={22} />
              </button>
              <button
                aria-label={p.loadingMore ? "Loading more reels" : "Next reel"}
                disabled={(!showAd && index === p.reels.length - 1 && !p.hasMore) || p.loadingMore}
                onClick={() => move(1)}
              >
                <ArrowDown size={22} />
              </button>
              <small>
                ↑ ↓<br />
                TO EXPLORE
              </small>
            </aside>
          </>
        ) : (
          <section className="reels-status-page" role="status">
            <Clapperboard size={40} />
            <span className="rv-eyebrow">YOUR NEXT PERSPECTIVE</span>
            <h1>
              {p.loading
                ? "Finding your next moment…"
                : p.error
                  ? "Let’s try that again."
                  : "Good things are coming."}
            </h1>
            <p>
              {p.error ||
                (!p.loading
                  ? "No published reels yet. Be the first to share a little motion."
                  : "Loading reels from your community.")}
            </p>
            {p.error && p.onRetry && <button onClick={p.onRetry}>Try again</button>}
            {!p.loading && !p.error && p.onCreate && (
              <button onClick={p.onCreate}>
                Create a reel <Plus size={17} />
              </button>
            )}
          </section>
        )}
      </div>
      {p.error && reel && (
        <div className="rv-feedback" role="alert">
          {p.error}
          <button onClick={p.onRetry}>Retry</button>
        </div>
      )}
      {notice && (
        <p className="rv-feedback" role="status">
          {notice}
        </p>
      )}
      {reel && (
        <CommentSheet
          key={reel.id}
          open={commentsOpen}
          onClose={() => openComments(false)}
          comments={reel.comments}
          total={reel.commentCount}
          onSubmit={(text, parent) => p.onAddComment(reel.id, text, parent)}
          onLikeComment={p.onLikeComment}
          onReply={p.onReply}
          onDeleteComment={p.onDeleteComment}
          onReportComment={p.onReportComment}
          replyTo={p.replyTo}
          replyParentId={p.replyParentId}
          onCancelReply={p.onCancelReply}
          status={p.commentStatus}
          canComment={reel.canComment !== false}
        />
      )}{" "}
      {p.shareDialog}
    </main>
  );
}
