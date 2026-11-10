/* Copyright © 2026 VELORYZ. All rights reserved. */
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { StudioMusicTrack } from "../../lib/studio-catalog";
/** The scene clock owns position; this element never advances the editor clock. */
export function SoundtrackTransport({
  track,
  playing,
  seconds,
}: {
  track: StudioMusicTrack | null;
  playing: boolean;
  seconds: number;
}) {
  const audio = useRef<HTMLAudioElement>(null),
    blocked = useRef(false);
  const [metadataDuration, setMetadataDuration] = useState(0);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(true),
    [needsGesture, setNeedsGesture] = useState(false);
  useEffect(() => {
    blocked.current = false;
    setNeedsGesture(false);
    setMetadataDuration(0);
    setError("");
  }, [track?.audioUrl]);
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
        onError={() => {
          setNeedsGesture(true);
          setError(
            "Selected music could not load. Reopen Music and select the track again to refresh it.",
          );
        }}
      />
      <button
        type="button"
        aria-pressed={enabled}
        onClick={() => {
          if (needsGesture) {
            blocked.current = false;
            setNeedsGesture(false);
            setEnabled(true);
            if (playing) void audio.current?.play().catch(() => setNeedsGesture(true));
          } else setEnabled((value) => !value);
        }}
      >
        {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}{" "}
        {needsGesture ? "Enable audio" : enabled ? "Sound on" : "Sound off"}
      </button>
      <span>{track.title}</span>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
