/* Copyright © 2026 VELORYZ. All rights reserved. */
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { StudioMusicTrack } from "../../lib/studio-catalog";
/** The scene clock owns position; this element never advances the editor clock. */
export function SoundtrackTransport({
  track,
  playing,
  seconds,
  onRefresh,
}: {
  track: StudioMusicTrack | null;
  playing: boolean;
  seconds: number;
  onRefresh?: () => Promise<void>;
}) {
  const audio = useRef<HTMLAudioElement>(null),
    blocked = useRef(false),
    refreshing = useRef(false),
    refreshedUrl = useRef<string | null>(null);
  const [metadataDuration, setMetadataDuration] = useState(0);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(true),
    [needsGesture, setNeedsGesture] = useState(false);
  useEffect(() => {
    blocked.current = false;
    refreshing.current = false;
    refreshedUrl.current = null;
    setNeedsGesture(false);
    setMetadataDuration(0);
    setError("");
  }, [track?.audioUrl]);

  function refreshExpiredTrack() {
    if (!onRefresh || !track?.audioUrl || refreshing.current || refreshedUrl.current === track.audioUrl) {
      setError("Selected music could not load. Reopen Music and select the track again.");
      setNeedsGesture(true);
      return;
    }
    refreshing.current = true;
    refreshedUrl.current = track.audioUrl;
    setError("Refreshing the secure music link…");
    void onRefresh()
      .then(() => {
        blocked.current = false;
        setNeedsGesture(false);
        setError("");
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "The music link could not be refreshed.");
        setNeedsGesture(true);
      })
      .finally(() => {
        refreshing.current = false;
      });
  }
  useEffect(() => {
    const player = audio.current;
    if (!player || !track) return;
    const end = track.excerptEndSeconds ?? track.durationSeconds ?? metadataDuration;
    const expected = Math.min(
      end,
      Math.max(track.excerptStartSeconds, track.excerptStartSeconds + seconds),
    );
    if (Math.abs(player.currentTime - expected) > 0.15) {
      try {
        player.currentTime = expected;
      } catch {
        /* Wait for metadata. */
      }
    }
    player.volume = Math.max(0, Math.min(1, track.volume ?? 0.8));
    if (!playing || !enabled || expected >= end) {
      player.pause();
      return;
    }
    if (player.paused && !blocked.current)
      void player.play().catch((cause) => {
        if (cause?.name === "AbortError") return;
        blocked.current = true;
        setNeedsGesture(true);
      });
  }, [track, playing, seconds, enabled, metadataDuration]);
  useEffect(() => {
    const player = audio.current;
    return () => {
      player?.pause();
      player?.removeAttribute("src");
      player?.load();
    };
  }, [track?.audioUrl]);
  if (!track?.audioUrl) return null;
  return (
    <div className="v-soundtrack-control">
      <audio
        key={track.audioUrl}
        ref={audio}
        src={track.audioUrl}
        preload="metadata"
        onLoadedMetadata={(event) => {
          if (Number.isFinite(event.currentTarget.duration))
            setMetadataDuration(event.currentTarget.duration);
        }}
        onError={() => refreshExpiredTrack()}
      />
      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => {
          if (error && onRefresh) {
            refreshExpiredTrack();
            return;
          }
          if (enabled && !needsGesture) {
            setEnabled(false);
            return;
          }
          blocked.current = false;
          setNeedsGesture(false);
          setEnabled(true);
          const player = audio.current;
          const end = track.excerptEndSeconds ?? track.durationSeconds ?? metadataDuration;
          const expected = Math.min(
            end,
            Math.max(track.excerptStartSeconds, track.excerptStartSeconds + seconds),
          );
          if (player && playing) {
            try { player.currentTime = expected; } catch { /* Metadata is still loading. */ }
            void player.play().catch(() => {
              blocked.current = true;
              setNeedsGesture(true);
            });
          }
        }}
      >
        {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}{" "}
        {error ? "Retry music" : needsGesture ? "Enable audio" : enabled ? "Sound on" : "Sound off"}
      </button>
      <span>{track.title}</span>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
