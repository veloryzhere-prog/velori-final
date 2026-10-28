import assert from "node:assert/strict";
import test from "node:test";
import {
  ANIMATION_TYPES,
  EASING_TYPES,
  PAGE_TRANSITION_TYPES,
  advanceTimeline,
  buildTimeline,
  createAnimation,
  createPageTransition,
  createPlaybackState,
  getAnimationProgress,
  getPageTransitionProgress,
  getTimelineRange,
  scrubTimeline,
  togglePlayback,
} from "./animation.mjs";

test("animation library exposes the expected animation and easing types", () => {
  assert.ok(ANIMATION_TYPES.includes("bounce"));
  assert.ok(ANIMATION_TYPES.includes("elastic"));
  assert.ok(EASING_TYPES.includes("bezier"));
  assert.ok(PAGE_TRANSITION_TYPES.includes("flip"));
});

test("createAnimation builds a timeline-safe animation object", () => {
  const animation = createAnimation({
    type: "slide",
    targetId: "layer-1",
    startTime: 1.2,
    duration: 0.8,
    easing: "ease-in-out",
    axis: "x",
  });

  assert.equal(animation.type, "slide");
  assert.equal(animation.targetId, "layer-1");
  assert.equal(animation.startTime, 1.2);
  assert.equal(animation.duration, 0.8);
  assert.equal(animation.easing, "ease-in-out");
  assert.equal(animation.endTime, 2.0);
});

test("progress functions calculate animation and transition progress correctly", () => {
  const animation = createAnimation({
    type: "fade",
    startTime: 0.5,
    duration: 1,
    easing: "linear",
  });
  assert.equal(getAnimationProgress(animation, 0.5), 0);
  assert.equal(getAnimationProgress(animation, 1.0), 0.5);
  assert.equal(getAnimationProgress(animation, 1.5), 1);

  const transition = createPageTransition({
    type: "zoom",
    startTime: 2,
    duration: 0.6,
    easing: "ease-out",
  });
  assert.equal(getPageTransitionProgress(transition, 2), 0);
  assert.ok(getPageTransitionProgress(transition, 2.4) > 0.5);
  assert.equal(getPageTransitionProgress(transition, 2.6), 1);
});

test("timeline range and playback helpers handle drag scrubbing and pausing", () => {
  const animations = [
    createAnimation({ type: "fade", startTime: 0.4, duration: 0.8 }),
    createAnimation({ type: "rotate", startTime: 1.1, duration: 1.3 }),
  ];
  const transitions = [createPageTransition({ type: "slide", startTime: 2.2, duration: 0.9 })];

  const range = getTimelineRange(animations, transitions);
  assert.equal(range.start, 0.4);
  assert.equal(range.end, 3.1);

  const timeline = buildTimeline(animations, transitions, 1.5);
  assert.ok(timeline.some((item) => item.kind === "element" && item.active));

  const state = createPlaybackState(3.1, 0.5, true);
  const toggled = togglePlayback(state);
  assert.equal(toggled.isPlaying, false);

  const scrubbed = scrubTimeline(toggled, 2.7);
  assert.equal(scrubbed.currentTime, 2.7);

  const advanced = advanceTimeline(scrubbed, 0.5);
  assert.equal(advanced.currentTime, 3.1);
});
