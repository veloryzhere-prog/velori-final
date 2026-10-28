/* Copyright © 2026 VELORYZ. All rights reserved. */
import { useEffect, useRef, useState } from "react";
import type { StudioMusicTrack } from "../../lib/studio-catalog";
export function PostMusicPreview({ track }: { track: StudioMusicTrack | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setError("");
    const player = audio.current;
    return () => {
      player?.pause();
      player?.removeAttribute("src");
      player?.load();
    };
  }, [track?.audioUrl]);
  if (!track?.audioUrl) return null;
  const start = Math.max(0, track.excerptStartSeconds ?? 0);
  const end = Math.min(
    track.excerptEndSeconds ?? Infinity,
    track.durationSeconds ?? Infinity,
    start + 20,
  );
  return (
    <div className="v-music-clip">
      <p>Preview selected music with your post · {track.title}</p>
      <audio
        key={track.audioUrl}
        ref={audio}
        src={track.audioUrl}
        controls
        preload="metadata"
        aria-label={`Selected music: ${track.title}`}
        style={{ width: "100%" }}
        onLoadedMetadata={(event) => {
          event.currentTarget.currentTime = Math.min(start, event.currentTarget.duration);
          event.currentTarget.volume = Math.max(0, Math.min(1, track.volume ?? 0.8));
        }}
        onPlay={(event) => {
          if (event.currentTarget.currentTime < start || event.currentTarget.currentTime >= end)
            event.currentTarget.currentTime = start;
        }}
        onTimeUpdate={(event) => {
          if (event.currentTarget.currentTime >= end) {
            event.currentTarget.pause();
            event.currentTarget.currentTime = start;
          }
        }}
        onError={() =>
          setError("Selected music could not load. Reopen Music and select the track again.")
        }
      />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
