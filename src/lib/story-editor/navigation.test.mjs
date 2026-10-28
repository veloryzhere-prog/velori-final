import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdjacentStorySlideIndex,
  getStoryExportPreview,
  getStoryPlaybackAdvance,
  getStoryPreviewProgress,
  MAX_STORY_SLIDES,
  STORY_PREVIEW_SLIDE_DURATION_MS,
} from "./navigation.mjs";

test("story slide navigation remains within the available slides", () => {
  assert.equal(MAX_STORY_SLIDES, 10);
  assert.equal(getAdjacentStorySlideIndex(0, 3, -1), 0);
  assert.equal(getAdjacentStorySlideIndex(0, 3, 1), 1);
  assert.equal(getAdjacentStorySlideIndex(2, 3, 1), 2);
  assert.equal(getAdjacentStorySlideIndex(8, 0, 1), 0);
});

test("story preview progress is clamped to each slide duration", () => {
  assert.equal(STORY_PREVIEW_SLIDE_DURATION_MS, 15_000);
  assert.equal(getStoryPreviewProgress(-1), 0);
  assert.equal(getStoryPreviewProgress(7_500), 0.5);
  assert.equal(getStoryPreviewProgress(15_000), 1);
  assert.equal(getStoryPreviewProgress(20_000), 1);
  assert.equal(getStoryPreviewProgress(2_500, 5_000), 0.5);
  assert.equal(getStoryPreviewProgress(7_500, 5_000), 1);
  assert.equal(getStoryPreviewProgress(Number.NaN), 0);
  assert.equal(getStoryPreviewProgress(100, 0), 0);
});

test("playback advance supports slide loops and story loops", () => {
  assert.deepEqual(getStoryPlaybackAdvance(1, 3, false, false), {
    nextIndex: 2,
    continuePlaying: true,
    repeatSlide: false,
  });
  assert.deepEqual(getStoryPlaybackAdvance(2, 3, false, true), {
    nextIndex: 0,
    continuePlaying: true,
    repeatSlide: false,
  });
  assert.deepEqual(getStoryPlaybackAdvance(2, 3, false, false), {
    nextIndex: 2,
    continuePlaying: false,
    repeatSlide: false,
  });
  assert.deepEqual(getStoryPlaybackAdvance(1, 3, true, false), {
    nextIndex: 1,
    continuePlaying: true,
    repeatSlide: true,
  });
});

test("export preview estimates the complete story duration, count, and encoded size", () => {
  assert.deepEqual(getStoryExportPreview([{ duration: 5 }, { duration: 10 }, { duration: 3 }]), {
    slideCount: 3,
    totalDurationSeconds: 18,
    estimatedSizeBytes: 9_882_000,
  });
  assert.deepEqual(getStoryExportPreview([]), {
    slideCount: 0,
    totalDurationSeconds: 0,
    estimatedSizeBytes: 0,
  });
});
