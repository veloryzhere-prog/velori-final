import assert from "node:assert/strict";
import test from "node:test";
import {
  getStoryAutoFontSize,
  getStoryTextAnimationState,
  getStoryTextAnimationFrame,
  getStoryTextPosition,
  getStoryTextStyle,
  getStoryTypewriterText,
  STORY_TEXT_POSITION_PRESETS,
  STORY_TEXT_STYLES,
} from "./text-tools.mjs";

test("story text style library has more than twenty usable presets", () => {
  assert.ok(STORY_TEXT_STYLES.length >= 20);
  assert.equal(new Set(STORY_TEXT_STYLES.map((style) => style.id)).size, STORY_TEXT_STYLES.length);
  assert.equal(getStoryTextStyle("neon-pink").fontFamily, "Manrope");
  assert.equal(getStoryTextStyle("missing").id, STORY_TEXT_STYLES[0].id);
});

test("position presets include top, center, bottom, and corner anchors", () => {
  assert.ok(STORY_TEXT_POSITION_PRESETS.length >= 5);
  assert.equal(getStoryTextPosition("center").y, 50);
  assert.equal(getStoryTextPosition("bottom").y, 80);
  assert.equal(getStoryTextPosition("unknown").id, "center");
});

test("auto sizing reduces long copy and keeps empty copy at the chosen base size", () => {
  const short = getStoryAutoFontSize("Hello", 64, 80, 10);
  const long = getStoryAutoFontSize(
    "A very long story headline that needs to fit this area",
    64,
    80,
    10,
  );
  assert.equal(getStoryAutoFontSize("", 64, 80, 24), 64);
  assert.ok(long < short);
  assert.ok(long >= 12);
});

test("story text animation respects its start time and duration", () => {
  assert.deepEqual(getStoryTextAnimationState("fade", 1, 2, 0.5), { visible: false, progress: 0 });
  assert.deepEqual(getStoryTextAnimationState("slide", 2.25, 2, 0.5), {
    visible: true,
    progress: 0.5,
  });
  assert.deepEqual(getStoryTextAnimationState("bounce", 4, 2, 0.5), { visible: true, progress: 1 });
});

test("typewriter reveals text in proportion to animation progress", () => {
  assert.equal(getStoryTypewriterText("STORY", 0), "");
  assert.equal(getStoryTypewriterText("STORY", 0.5), "ST");
  assert.equal(getStoryTypewriterText("STORY", 1), "STORY");
});

test("story text animation presets return isolated, composable frame transforms", () => {
  assert.deepEqual(getStoryTextAnimationFrame("slide-left", 0.5), {
    opacity: 0.5,
    x: 24,
    y: 0,
    scale: 1,
    rotation: 0,
  });
  assert.equal(getStoryTextAnimationFrame("zoom-in", 1).scale, 1);
  assert.equal(getStoryTextAnimationFrame("rotate-in", 1, 20).rotation, 20);
  assert.equal(getStoryTextAnimationState("fade-out", 1, 0, 0.5).visible, false);
  assert.deepEqual(getStoryTextAnimationState("pulse", 1.25, 0, 0.5, 0.25, true), {
    visible: true,
    progress: 0,
  });
});
