/* Copyright © 2026 VELORYZ. All rights reserved. */
export interface MusicBounds {
  durationSeconds: number | null;
  excerptStartSeconds: number;
  excerptEndSeconds: number | null;
}
/** Catalog bounds are authoritative; unknown durations must be probed before selecting. */
export function musicExcerpt(track: MusicBounds, requestedStart: number, requestedLength = 20) {
  const duration = track.durationSeconds;
  if (duration === null || !Number.isFinite(duration) || duration <= 0) return null;
  const lower = Math.min(duration, Math.max(0, track.excerptStartSeconds || 0));
  const upper = Math.max(lower, Math.min(duration, track.excerptEndSeconds ?? duration));
  const length = Math.min(Math.max(0, requestedLength), 20, upper - lower);
  if (length <= 0) return null;
  const start = Math.min(
    upper - length,
    Math.max(lower, Number.isFinite(requestedStart) ? requestedStart : lower),
  );
  return {
    start,
    end: start + length,
    duration: length,
    minStart: lower,
    maxStart: upper - length,
  };
}
export function musicTimestamp(seconds: number) {
  const value = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  return `${Math.floor(value / 60)}:${Math.floor(value % 60)
    .toString()
    .padStart(2, "0")}`;
}
