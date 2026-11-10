import test from "node:test";
import assert from "node:assert/strict";
import { nativeMediaAccept } from "./native-media-picker-policy.mjs";

test("native picker accepts supported image and video upload controls", () => {
  assert.deepEqual(nativeMediaAccept("image/jpeg,image/png,image/webp,video/mp4"), {
    photos: true,
    videos: true,
    otherFiles: false,
  });
  assert.deepEqual(nativeMediaAccept("image/*"), {
    photos: true,
    videos: false,
    otherFiles: false,
  });
  assert.deepEqual(nativeMediaAccept("video/mp4"), {
    photos: false,
    videos: true,
    otherFiles: false,
  });
  assert.deepEqual(nativeMediaAccept("image/gif"), {
    photos: true,
    videos: false,
    otherFiles: false,
  });
});

test("native picker preserves mixed media and document controls", () => {
  assert.deepEqual(nativeMediaAccept("image/jpeg,image/png,video/mp4,application/pdf,audio/webm"), {
    photos: true,
    videos: true,
    otherFiles: true,
  });
});

test("native picker leaves non-media and unrestricted controls alone", () => {
  assert.equal(nativeMediaAccept(".json,application/json"), null);
  assert.equal(nativeMediaAccept("application/pdf,audio/mp4"), null);
  assert.equal(nativeMediaAccept(""), null);
});
