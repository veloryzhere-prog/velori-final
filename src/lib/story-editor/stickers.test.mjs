import assert from "node:assert/strict";
import test from "node:test";
import {
  createStorySticker,
  getStoryCountdownParts,
  MAX_STORY_STICKERS_PER_SLIDE,
  parseStoryStickerConfig,
  sanitizeStoryStickerSvg,
  STORY_INTERACTIVE_STICKER_TYPES,
  STORY_STICKER_LIBRARY,
  serializeStoryStickerConfig,
  validateStoryStickerPng,
} from "./stickers.mjs";

test("sticker library includes over 1000 unique static and animated stickers", () => {
  assert.ok(STORY_STICKER_LIBRARY.length >= 1000);
  assert.equal(
    new Set(STORY_STICKER_LIBRARY.map((sticker) => sticker.id)).size,
    STORY_STICKER_LIBRARY.length,
  );
  assert.ok(STORY_STICKER_LIBRARY.some((sticker) => sticker.animated));
  assert.ok(STORY_STICKER_LIBRARY.some((sticker) => !sticker.animated));
  assert.equal(MAX_STORY_STICKERS_PER_SLIDE, 100);
});

test("interactive sticker types and defaults create slide-scoped configurations", () => {
  assert.deepEqual(STORY_INTERACTIVE_STICKER_TYPES, [
    "poll",
    "question",
    "quiz",
    "slider",
    "link",
    "countdown",
    "music",
    "mention",
    "location",
    "hashtag",
  ]);
  const poll = createStorySticker("poll", "slide-1");
  assert.equal(poll.slideId, "slide-1");
  assert.deepEqual(parseStoryStickerConfig(poll.config), {
    options: ["Yes", "No"],
    votes: [0, 0],
    showResults: true,
    selectedOption: null,
  });
  assert.throws(() => createStorySticker("unsupported", "slide-1"), /Unsupported/);
});

test("sticker config serializes and invalid data parses to a safe empty object", () => {
  const config = { options: ["One", "Two"], correctAnswer: 1 };
  assert.deepEqual(parseStoryStickerConfig(serializeStoryStickerConfig(config)), config);
  assert.deepEqual(parseStoryStickerConfig("{broken"), {});
  assert.deepEqual(parseStoryStickerConfig("[]"), {});
});

test("countdown computes a live non-negative time span", () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  assert.deepEqual(getStoryCountdownParts(new Date(now + 1_501_000).toISOString(), now), {
    days: 0,
    hours: 0,
    minutes: 25,
    seconds: 1,
    complete: false,
  });
  assert.deepEqual(getStoryCountdownParts(new Date(now - 1).toISOString(), now), {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    complete: true,
  });
  assert.equal(getStoryCountdownParts("not-a-date", now), null);
});

test("custom PNG signature is validated", () => {
  assert.doesNotThrow(() =>
    validateStoryStickerPng(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  );
  assert.throws(
    () => validateStoryStickerPng(new TextEncoder().encode("not png")),
    /valid PNG or SVG/,
  );
});

test("SVG sanitation strips scripts, event handlers, and external resources", () => {
  const parser = globalThis.DOMParser;
  const serializer = globalThis.XMLSerializer;
  if (!parser || !serializer) return;
  const sanitized = sanitizeStoryStickerSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><image href="https://example.com/a.png"/><path d="M0 0" fill="#fff"/></svg>',
  );
  assert.doesNotMatch(sanitized, /script|onload|https:\/\/example/);
  assert.match(sanitized, /<path/);
  assert.throws(() => sanitizeStoryStickerSvg("<!DOCTYPE svg><svg/>"), /declarations/);
});
