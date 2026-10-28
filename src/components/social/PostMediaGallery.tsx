import "./post-video.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { supabase, type PostMedia } from "../../lib/supabase";

let activeVideo: HTMLVideoElement | null = null;
const visibleVideos = new Map<HTMLVideoElement, { ratio: number; start: () => void }>();
function selectVisibleVideo() {
  const candidates = [...visibleVideos].filter(([, value]) => value.ratio >= 0.5);
  candidates.sort(([left], [right]) => {
    const distance = (node: HTMLVideoElement) => {
      const r = node.getBoundingClientRect();
      return Math.abs(r.top + r.height / 2 - window.innerHeight / 2);
    };
    return distance(left) - distance(right);
  });
  const winner = document.hidden ? undefined : candidates[0];
  for (const [node] of visibleVideos) if (node !== winner?.[0]) node.pause();
  activeVideo = winner?.[0] ?? null;
  winner?.[1].start();
}
export function FeedVideo({ src, alt }: { src: string; alt: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const manuallyPaused = useRef(false);
  const pending = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const start = useCallback(() => {
    const video = videoRef.current;
    if (!video || document.hidden || manuallyPaused.current || !video.paused || pending.current)
      return;
    video.muted = false;
    pending.current = true;
    void video
      .play()
      .then(() => setBlocked(false))
      .catch((cause) => {
        if (cause?.name === "NotAllowedError") setBlocked(true);
        else if (cause?.name !== "AbortError") setFailed(true);
      })
      .finally(() => {
        pending.current = false;
      });
  }, []);
  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      manuallyPaused.current = false;
      if (activeVideo && activeVideo !== video) activeVideo.pause();
      activeVideo = video;
      if (failed) {
        setFailed(false);
        video.load();
      }
      start();
    } else {
      manuallyPaused.current = true;
      video.pause();
    }
  }, [failed, start]);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    visibleVideos.set(video, { ratio: 0, start });
    const observer = new IntersectionObserver(
      ([entry]) => {
        const record = visibleVideos.get(video);
        if (record) record.ratio = entry.intersectionRatio;
        selectVisibleVideo();
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    observer.observe(video);
    const visibility = () => selectVisibleVideo();
    // Retry audible autoplay inside the next actual user gesture, without
    // overriding a deliberate pause or starting offscreen posts.
    const gesture = () => {
      if (activeVideo === video && !manuallyPaused.current) start();
    };
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("click", gesture);
    document.addEventListener("keydown", gesture);
    return () => {
      observer.disconnect();
      visibleVideos.delete(video);
      video.pause();
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("click", gesture);
      document.removeEventListener("keydown", gesture);
      if (activeVideo === video) activeVideo = null;
      selectVisibleVideo();
    };
  }, [start]);
  return (
    <div className="feed-video-player" role="group" aria-label="Post video player">
      <video
        ref={videoRef}
        src={src}
        playsInline
        loop
        preload="metadata"
        muted={false}
        aria-label={alt || "Post video"}
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            toggle();
          }
        }}
        onPlay={(event) => {
          if (activeVideo !== event.currentTarget || document.hidden) event.currentTarget.pause();
          else setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
        onCanPlay={() => {
          if (activeVideo === videoRef.current) start();
        }}
      />
      {(failed || blocked || !playing) && (
        <button
          type="button"
          className="feed-video-center"
          aria-label={failed ? "Retry video" : blocked ? "Play video with sound" : "Play video"}
          onClick={toggle}
        >
          {failed ? (
            "Retry video"
          ) : blocked ? (
            "Tap to play with sound"
          ) : (
            <Play size={24} fill="currentColor" />
          )}
        </button>
      )}
    </div>
  );
}

export function PostMediaGallery({ media }: { media: PostMedia[] }) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const node = galleryRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [media.length > 0]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [mediaFailures, setMediaFailures] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState(0);
  const [retry, setRetry] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const sorted = media.slice().sort((left, right) => left.position - right.position);
  useEffect(() => {
    if (!nearViewport) return;
    let alive = true;
    setActive(0);
    setFailed(false);
    setMediaFailures({});
    setUrls({});
    if (!sorted.length) {
      setUrls({});
      return () => {
        alive = false;
      };
    }
    void supabase.storage
      .from("post-media")
      .createSignedUrls(
        sorted.map((item) => item.object_path),
        3600,
      )
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) throw error;
        const byPath = new Map((data || []).map((item) => [item.path, item.signedUrl]));
        setUrls(
          Object.fromEntries(
            sorted
              .filter((item) => byPath.get(item.object_path))
              .map((item) => [item.id, byPath.get(item.object_path)!]),
          ),
        );
        setFailed(sorted.some((item) => !byPath.get(item.object_path)));
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
    // position changes are handled by sorting without refetching signed URLs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.map((item) => `${item.id}:${item.object_path}`).join("|"), retry, nearViewport]);
  if (!sorted.length) return null;
  const safeActive = Math.min(active, sorted.length - 1);
  const current = sorted[safeActive];
  const move = (delta: number) =>
    setActive((index) => (index + delta + sorted.length) % sorted.length);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (touchStart.current === null) return;
    const difference = event.clientX - touchStart.current.x;
    const vertical = Math.abs(event.clientY - touchStart.current.y);
    if (Math.abs(difference) > 45 && Math.abs(difference) > vertical * 1.3)
      move(difference > 0 ? -1 : 1);
    touchStart.current = null;
  };
  return (
    <div
      ref={galleryRef}
      className="post-media-carousel"
      role="region"
      aria-label={`Post media, ${safeActive + 1} of ${sorted.length}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.pointerType === "touch")
          touchStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        touchStart.current = null;
      }}
    >
      <figure className="post-media-frame">
        {urls[current.id] && !mediaFailures[current.id] ? (
          current.media_type === "video" ? (
            <FeedVideo key={urls[current.id]} src={urls[current.id]} alt={current.alt_text} />
          ) : (
            <img
              src={urls[current.id]}
              alt={current.alt_text || "Post image"}
              loading="lazy"
              decoding="async"
              onError={() => setMediaFailures((items) => ({ ...items, [current.id]: true }))}
            />
          )
        ) : (
          <div className="post-media-placeholder" role="status">
            {failed || mediaFailures[current.id] ? "This media is unavailable." : "Loading media…"}
            {(failed || mediaFailures[current.id]) && (
              <button
                type="button"
                className="button button-outline"
                onClick={() => setRetry((value) => value + 1)}
              >
                Retry media
              </button>
            )}
          </div>
        )}
        {current.alt_text && current.media_type === "video" && (
          <figcaption>{current.alt_text}</figcaption>
        )}
      </figure>
      {sorted.length > 1 && (
        <>
          <button
            type="button"
            className="post-carousel-arrow previous"
            aria-label="Previous photo"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={19} />
          </button>
          <button
            type="button"
            className="post-carousel-arrow next"
            aria-label="Next photo"
            onClick={() => move(1)}
          >
            <ChevronRight size={19} />
          </button>
          <span className="post-carousel-count" aria-live="polite">
            {safeActive + 1} / {sorted.length}
          </span>
          <div className="post-carousel-dots" aria-label="Choose photo">
            {sorted.map((item, index) => (
              <button
                type="button"
                key={item.id}
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === safeActive ? "true" : undefined}
                onClick={() => setActive(index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
