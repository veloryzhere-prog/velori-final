import test from "node:test";
import assert from "node:assert/strict";
import { normalizePostCanvasLayers } from "./draft-scene.mjs";

const textLayer = {
  id: "copy",
  type: "text",
  name: "Heading",
  order: 0,
  x: 12,
  y: 24,
  width: 300,
  height: 80,
  rotation: 0,
  opacity: 1,
  blendMode: "normal",
  visible: true,
  locked: false,
  text: { id: "copy-text", content: "Hello" },
};

test("canvas scene normalization keeps valid layers and isolates the stored snapshot", () => {
  const input = { slide: [textLayer] };
  const snapshot = normalizePostCanvasLayers(input);

  assert.deepEqual(snapshot, input);
  assert.notEqual(snapshot.slide[0], textLayer);
  assert.notEqual(snapshot.slide[0].text, textLayer.text);
});

test("canvas scene normalization rejects malformed containers and layers", () => {
  assert.deepEqual(normalizePostCanvasLayers(null), {});
  assert.deepEqual(
    normalizePostCanvasLayers({
      good: [textLayer],
      bad: [null, { ...textLayer, x: Number.NaN }, { ...textLayer, type: "script" }],
      ignored: "not a layer list",
    }),
    { good: [textLayer], bad: [] },
  );
});
