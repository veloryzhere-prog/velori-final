import assert from "node:assert/strict";
import test from "node:test";
import {
  appendStoryStrokePoint,
  createDrawingDocument,
  createStoryStroke,
  eraseStoryDrawingAt,
  normalizeStoryPoint,
  parseStoryDrawing,
  undoStoryDrawing,
} from "./drawing-engine.ts";
import { createStoryStickerFromDefinition, searchStoryStickers } from "./sticker-catalog.ts";

test("drawing documents start empty and normalize all canvas corners", () => {
  assert.deepEqual(createDrawingDocument(), { version: 1, strokes: [] });
  const rect = { left: 10, top: 20, width: 100, height: 200 };
  assert.deepEqual(normalizeStoryPoint(10, 20, rect), { x: 0, y: 0, pressure: 0.5 });
  assert.deepEqual(normalizeStoryPoint(110, 20, rect), { x: 1, y: 0, pressure: 0.5 });
  assert.deepEqual(normalizeStoryPoint(10, 220, rect), { x: 0, y: 1, pressure: 0.5 });
  assert.deepEqual(normalizeStoryPoint(110, 220, rect), { x: 1, y: 1, pressure: 0.5 });
});

test("drawing strokes append points, undo as a unit, and erase near the pointer", () => {
  const point = { x: 0.2, y: 0.2, pressure: 0.5 };
  const stroke = createStoryStroke({
    id: "stroke",
    tool: "pen",
    color: "#fff",
    width: 4,
    opacity: 1,
    point,
  });
  const extended = appendStoryStrokePoint(stroke, { x: 0.8, y: 0.8, pressure: 0.7 });
  assert.equal(extended.points.length, 2);
  const document = { version: 1 as const, strokes: [extended] };
  assert.deepEqual(undoStoryDrawing(document).strokes, []);
  assert.equal(
    eraseStoryDrawingAt(document, { x: 0.5, y: 0.5, pressure: 0.5 }, 0.01).strokes.length,
    0,
  );
});

test("malformed drawings parse safely and sticker catalog search filters by category", () => {
  assert.deepEqual(parseStoryDrawing({ version: 8, strokes: "bad" }), createDrawingDocument());
  assert.equal(
    searchStoryStickers("heart").some((item) => item.id === "emoji-heart"),
    true,
  );
  assert.equal(
    searchStoryStickers("poll", "interactive").some((item) => item.id === "poll"),
    true,
  );
  assert.equal(searchStoryStickers("poll", "emoji").length, 0);
  const poll = createStoryStickerFromDefinition(searchStoryStickers("poll")[0], "slide-a");
  assert.equal(poll.slideId, "slide-a");
  assert.equal(poll.type, "custom");
  assert.equal(JSON.parse(poll.config ?? "{}").staticText, true);
});
