import assert from "node:assert/strict";
import test from "node:test";
import {
  clampStoryVideoTrim,
  storyMediaPlacement,
  getStoryCollageGrid,
  getStoryMediaFilter,
  MAX_STORY_MEDIA_BYTES,
  MAX_STORY_SLIDE_SECONDS,
  MAX_STORY_VIDEO_SECONDS,
  validateStoryMediaHeader,
} from "./media-tools.mjs";

test("media headers validate images, GIF and MP4 and enforce the upload limit", () => {
  assert.equal(MAX_STORY_MEDIA_BYTES, 100 * 1024 * 1024);
  assert.equal(
    validateStoryMediaHeader({ type: "image/gif", size: 12 }, new TextEncoder().encode("GIF89a")),
    "gif",
  );
  assert.equal(
    validateStoryMediaHeader(
      { type: "video/mp4", size: 12 },
      new Uint8Array([0, 0, 0, 0, 102, 116, 121, 112]),
    ),
    "video",
  );
  assert.throws(
    () =>
      validateStoryMediaHeader(
        { type: "image/png", size: MAX_STORY_MEDIA_BYTES + 1 },
        new Uint8Array(),
      ),
    /100 MB/,
  );
  assert.throws(
    () =>
      validateStoryMediaHeader({ type: "image/gif", size: 12 }, new TextEncoder().encode("notgif")),
    /do not match/,
  );
});

test("video ranges clamp to a 60 second source and at most 20 seconds per slide", () => {
  assert.equal(MAX_STORY_VIDEO_SECONDS, 60);
  assert.equal(MAX_STORY_SLIDE_SECONDS, 20);
  assert.deepEqual(clampStoryVideoTrim(4, 45, 60), { start: 4, end: 24 });
  assert.deepEqual(clampStoryVideoTrim(-2, 60, 10), { start: 0, end: 10 });
  assert.deepEqual(clampStoryVideoTrim(9, 2, 12), { start: 9, end: 9.1 });
});

test("collage layout grid supports 2x2, 1x3, 3x1, custom and caps four images", () => {
  assert.deepEqual(getStoryCollageGrid("2x2", 4), { columns: 2, rows: 2 });
  assert.deepEqual(getStoryCollageGrid("1x3", 3), { columns: 1, rows: 3 });
  assert.deepEqual(getStoryCollageGrid("3x1", 3), { columns: 3, rows: 1 });
  assert.deepEqual(getStoryCollageGrid("custom", 4), { columns: 2, rows: 2 });
  assert.deepEqual(getStoryCollageGrid("2x2", 8), { columns: 2, rows: 2 });
});

test("image adjustments combine filter settings into CSS filter values", () => {
  const filter = getStoryMediaFilter({
    brightness: 110,
    contrast: 92,
    saturation: 130,
    blur: 2,
    filter: "warm",
  });
  assert.match(filter, /brightness\(110%\)/);
  assert.match(filter, /contrast\(92%\)/);
  assert.match(filter, /blur\(2px\)/);
  assert.match(filter, /sepia/);
});

test("centered portrait photo stays inside the published story instead of being translated fifty canvases away", () => {
  assert.deepEqual(storyMediaPlacement(1080, 1920, 1080, 1920, "cover", 50, 50), {
    x: -540,
    y: -960,
    width: 1080,
    height: 1920,
  });
  const left = storyMediaPlacement(100, 200, 200, 100, "cover", 0, 50);
  const right = storyMediaPlacement(100, 200, 200, 100, "cover", 100, 50);
  assert.equal(left.x, -50);
  assert.equal(right.x, -350);
  assert.deepEqual(storyMediaPlacement(100, 200, 200, 100, "contain", 50, 50), {
    x: -50,
    y: -25,
    width: 100,
    height: 50,
  });
  assert.throws(() => storyMediaPlacement(100, 200, 0, 100), /drawable/);
});
