/* Copyright © 2026 VELORYZ. All rights reserved. */
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStorySlideSeconds, storyMusicSlideSeconds } from "./timing.mjs";

test("story timing stays in the supported 1-20 second range with tenth-second precision", () => {
  assert.equal(normalizeStorySlideSeconds(21), 20);
  assert.equal(normalizeStorySlideSeconds(0), 1);
  assert.equal(normalizeStorySlideSeconds(12.34), 12.3);
  assert.equal(normalizeStorySlideSeconds(Number.NaN), 15);
});

test("music selection derives story duration from the chosen excerpt", () => {
  assert.equal(storyMusicSlideSeconds({ excerptStartSeconds: 22.5, excerptEndSeconds: 37.5 }), 15);
  assert.equal(storyMusicSlideSeconds({ excerptStartSeconds: 3, excerptEndSeconds: 39, durationSeconds: 39 }), 20);
  assert.equal(storyMusicSlideSeconds({ excerptStartSeconds: 0, excerptEndSeconds: null, durationSeconds: 0.5 }), 1);
  assert.equal(storyMusicSlideSeconds(null), null);
});
