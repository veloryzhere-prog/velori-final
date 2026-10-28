export const MAX_STORY_SLIDES = 10;
export const STORY_PREVIEW_SLIDE_DURATION_MS = 15_000;

export function getAdjacentStorySlideIndex(index, slideCount, direction) {
  if (!Number.isInteger(slideCount) || slideCount < 1) return 0;
  const current = Number.isInteger(index) ? Math.min(Math.max(index, 0), slideCount - 1) : 0;
  return Math.min(Math.max(current + direction, 0), slideCount - 1);
}

export function getStoryPreviewProgress(elapsedMs, durationMs = STORY_PREVIEW_SLIDE_DURATION_MS) {
  if (!Number.isFinite(elapsedMs)) return 0;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
  return Math.min(Math.max(elapsedMs / durationMs, 0), 1);
}

export function getStoryPlaybackAdvance(index, slideCount, slideLoops, storyLoops) {
  if (!Number.isInteger(slideCount) || slideCount < 1) {
    return { nextIndex: 0, continuePlaying: false, repeatSlide: false };
  }
  const current = Number.isInteger(index) ? Math.min(Math.max(index, 0), slideCount - 1) : 0;
  if (slideLoops) return { nextIndex: current, continuePlaying: true, repeatSlide: true };
  if (current < slideCount - 1) {
    return { nextIndex: current + 1, continuePlaying: true, repeatSlide: false };
  }
  return storyLoops
    ? { nextIndex: 0, continuePlaying: true, repeatSlide: false }
    : { nextIndex: current, continuePlaying: false, repeatSlide: false };
}

export function getStoryExportPreview(slides, videoBitrate = 4_200_000, audioBitrate = 192_000) {
  const totalDurationSeconds = slides.reduce(
    (total, slide) => total + (Number.isFinite(slide.duration) ? Math.max(0, slide.duration) : 0),
    0,
  );
  return {
    slideCount: slides.length,
    totalDurationSeconds,
    estimatedSizeBytes: Math.ceil((totalDurationSeconds * (videoBitrate + audioBitrate)) / 8),
  };
}
