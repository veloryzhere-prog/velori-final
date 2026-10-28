import test from "node:test";
import assert from "node:assert/strict";
import { reelSwipeDirection, reelWheelDirection } from "./gestures.mjs";
test("a deliberate upward or downward swipe selects the adjacent reel", () => {
  assert.equal(reelSwipeDirection(4, -40, 180), 1);
  assert.equal(reelSwipeDirection(-5, 70, 500), -1);
});
test("taps, horizontal gestures, and slow short drags do not change reels", () => {
  for (const values of [
    [0, 8, 100],
    [80, -70, 140],
    [4, 50, 600],
    [40, 40, 200],
  ])
    assert.equal(reelSwipeDirection(...values), 0);
});
test("trackpad deltas accumulate before moving and preserve direction", () => {
  const first = reelWheelDirection(0, 25);
  assert.equal(first.direction, 0);
  assert.equal(reelWheelDirection(first.sum, 50).direction, 1);
  assert.equal(reelWheelDirection(0, -80).direction, -1);
  assert.equal(reelWheelDirection(55, -55).direction, 0);
});
