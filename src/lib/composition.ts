/* Copyright © 2026 VELORYZ. All rights reserved. */
import type { StudioMusicTrack } from "./studio-catalog";

export interface CompositionMetadata {
  schemaVersion: 1;
  audioBakedIn: boolean;
  soundtrack?: { trackId: string; startSeconds: number; durationSeconds: number; volume: number };
  musicSticker?: { visible: boolean; x: number; y: number; scale: number; rotation: number };
}
type StickerTransform = NonNullable<CompositionMetadata["musicSticker"]>;
const finite = (value: number, min: number, max: number, label: string) => {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${label}.`);
  return Math.round(value * 1000) / 1000;
};
export function storyDisplaySeconds(value: unknown): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0.2 && seconds <= 600 ? seconds : 7;
}
/** Whitelist persisted settings. Signed URLs, catalog titles and credentials never enter this record. */
export function compositionMetadata(
  track?: StudioMusicTrack | null,
  sticker?: StickerTransform | null,
  offsetSeconds = 0,
): CompositionMetadata {
  const result: CompositionMetadata = { schemaVersion: 1, audioBakedIn: false };
  if (track) {
    if (!track.id.trim() || track.id.length > 200) throw new Error("Select a valid music track.");
    const offset = finite(offsetSeconds, 0, 600, "soundtrack offset");
    const start = finite(track.excerptStartSeconds, 0, 86400, "music start");
    const end = track.excerptEndSeconds ?? track.durationSeconds;
    if (
      end === null ||
      !Number.isFinite(end) ||
      end <= start ||
      (track.durationSeconds !== null && end > track.durationSeconds)
    )
      throw new Error("Select a valid music excerpt.");
    const length = finite(end - start, 0.001, 20, "music excerpt duration");
    if (offset < length) {
      result.soundtrack = {
        trackId: track.id,
        startSeconds: start + offset,
        durationSeconds: length - offset,
        volume: finite(track.volume ?? 0.8, 0, 1, "music volume"),
      };
      result.audioBakedIn = true;
    }
  }
  if (sticker)
    result.musicSticker = {
      visible: sticker.visible === true,
      x: finite(sticker.x, -100000, 100000, "sticker position"),
      y: finite(sticker.y, -100000, 100000, "sticker position"),
      scale: finite(sticker.scale, 0.001, 100, "sticker scale"),
      rotation: finite(sticker.rotation, -36000, 36000, "sticker rotation"),
    };
  return result;
}
