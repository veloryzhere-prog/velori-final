import { test } from "node:test";
import assert from "node:assert/strict";
import { storyGesture } from "./navigation.mjs";
test("story swipes require a clear direction", () => {
  assert.equal(storyGesture(-90, 5, 180), "next");
  assert.equal(storyGesture(90, 5, 180), "previous");
  assert.equal(storyGesture(15, 130, 400), "close");
});
test("holding and small drags never advance a story", () => {
  assert.equal(storyGesture(0, 0, 700), "hold");
  assert.equal(storyGesture(25, 20, 140), "hold");
  assert.equal(storyGesture(80, 90, 200), "hold");
});
test("only a short stationary tap progresses", () => {
  assert.equal(storyGesture(2, 3, 150), "tap");
  assert.equal(storyGesture(2, 3, 350), "hold");
  assert.equal(storyGesture(0, -140, 150), "hold");
});
