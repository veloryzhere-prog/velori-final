import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, RotateCw } from "lucide-react";
import type { Reel } from "../types";
import { HeartBurst } from "./HeartBurst";
import { ReelActions } from "./ReelActions";
import { ReelInfo } from "./ReelInfo";
import { ReelProgressBar } from "./ReelProgressBar";
import { useReelVideo } from "../hooks/useReelVideo";
interface Props {
  reel: Reel;
  isActive: boolean;
  actionBusy?: boolean;
  onRetryMedia?: () => void;
  onOpenComments: () => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onFollow: () => void;
  onReport?: () => void;
  onDelete?: () => void;
}
export function ReelCard(p: Props) {
  const r = p.reel,
    v = useReelVideo(p.isActive);
  const [heart, setHeart] = useState(0),
    [showHeart, setShowHeart] = useState(false);
  const lastGestureLike = useRef(0);
  const lastTap = useRef<number | null>(null),
    timer = useRef<number | null>(null),
    start = useRef({ x: 0, y: 0 }),
    moved = useRef(false);
  const unavailable = v.hasMediaError || !r.videoUrl;
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  const burst = useCallback(() => {
    setHeart((n) => n + 1);
    setShowHeart(true);
  }, []);
  const likeFromGesture = () => {
    if (r.canLike === false || Date.now() - lastGestureLike.current < 350) return;
    lastGestureLike.current = Date.now();
    if (timer.current !== null) clearTimeout(timer.current);
    lastTap.current = null;
    burst();
    if (!r.isLiked && !p.actionBusy) p.onLike();
  };
  const tap = () => {
    if (moved.current || unavailable) return;
    const now = Date.now();
    if (lastTap.current !== null && now - lastTap.current < 300) {
      if (timer.current !== null) clearTimeout(timer.current);
      lastTap.current = null;
      likeFromGesture();
    } else {
      lastTap.current = now;
      timer.current = window.setTimeout(() => {
        lastTap.current = null;
        v.togglePlay();
      }, 300);
    }
  };
  return (
    <div
      className="reel-card"
      role="group"
      aria-label={"Reel by @" + r.user.username}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          v.togglePlay();
        }
      }}
    >
      <div
        className="rv-video-surface"
        onClick={tap}
        onDoubleClick={(event) => {
          event.preventDefault();
          likeFromGesture();
        }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          if (Math.abs(e.clientX - start.current.x) + Math.abs(e.clientY - start.current.y) > 16)
            moved.current = true;
        }}
      >
        <video
          ref={v.videoRef}
          src={r.videoUrl || undefined}
          poster={r.thumbnailUrl || undefined}
          className="reel-video"
          playsInline
          loop
          muted={v.isMuted}
          preload={p.isActive ? "metadata" : "none"}
          aria-label={"Video by @" + r.user.username}
        />
        <div className="rv-video-shade" />
        {!v.isPlaying && !v.isBuffering && !unavailable && (
          <span className="reel-pause-indicator" aria-hidden="true">
            <Play size={35} fill="currentColor" />
          </span>
        )}
        {v.isBuffering && !unavailable && (
          <span className="reel-buffering" role="status" aria-label="Loading video">
            <RotateCw size={24} />
          </span>
        )}
        <HeartBurst key={heart} visible={showHeart} onDone={() => setShowHeart(false)} />
      </div>
      {unavailable && (
        <div className="reel-media-error" role="alert">
          <RotateCw size={25} />
          <strong>A moment’s pause.</strong>
          <p>This video couldn’t load. Check your connection and try again.</p>
          <button
            onClick={() => {
              v.retry();
              p.onRetryMedia?.();
            }}
          >
            Reload video
          </button>
        </div>
      )}
      <div className="rv-playback-controls">
        <button
          onClick={v.togglePlay}
          aria-label={v.isPlaying ? "Pause reel" : "Play reel"}
          disabled={unavailable}
        >
          {v.isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span>FOR YOU</span>
        <button onClick={v.toggleMute} aria-label={v.isMuted ? "Unmute reel" : "Mute reel"}>
          {v.isMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </button>
        {v.mutePreferenceError && (
          <span className="rv-audio-preference-error" role="status">
            Audio choice won’t persist on this device.
          </span>
        )}
      </div>
      <ReelInfo reel={r} visible onFollow={p.onFollow} />
      <ReelActions
        reel={r}
        visible
        busy={p.actionBusy}
        onLike={() => {
          if (!r.isLiked) burst();
          p.onLike();
        }}
        onComment={p.onOpenComments}
        onSave={p.onSave}
        onShare={p.onShare}
        onReport={p.onReport}
        onDelete={p.onDelete}
      />
      <ReelProgressBar progress={v.progress} onSeek={v.seekTo} />
    </div>
  );
}
