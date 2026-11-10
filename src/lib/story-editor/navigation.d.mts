export const MAX_STORY_SLIDES: 10;
export const STORY_PREVIEW_SLIDE_DURATION_MS: 15000;

export function getAdjacentStorySlideIndex(
  index: number,
  slideCount: number,
  direction: number,
): number;
export function getStoryPreviewProgress(elapsedMs: number, durationMs?: number): number;
export function getStoryPlaybackAdvance(
  index: number,
  slideCount: number,
  slideLoops: boolean,
  storyLoops: boolean,
): { nextIndex: number; continuePlaying: boolean; repeatSlide: boolean };
export function getStoryExportPreview(
  slides: Array<{ duration: number }>,
  videoBitrate?: number,
  audioBitrate?: number,
): { slideCount: number; totalDurationSeconds: number; estimatedSizeBytes: number };
