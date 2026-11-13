/* Copyright © 2026 VELORYZ. All rights reserved. */
export const MAX_STORY_SLIDE_SECONDS = 20;
export function normalizeStorySlideSeconds(value, fallback = 15) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return fallback;
  return Math.round(Math.min(MAX_STORY_SLIDE_SECONDS, Math.max(1, seconds)) * 10) / 10;
}
export function storyMusicSlideSeconds(track) {
  if (!track) return null;
  const start = Number.isFinite(track.excerptStartSeconds) ? Math.max(0, track.excerptStartSeconds) : 0;
  const end = track.excerptEndSeconds ?? track.durationSeconds ?? start + 15;
  if (!Number.isFinite(end) || end <= start) return null;
  return normalizeStorySlideSeconds(end - start);
}
