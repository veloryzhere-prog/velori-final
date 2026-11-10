import assert from "node:assert/strict";
import test from "node:test";
import {
  clampZoom,
  canvasPointFromClient,
  duplicateLayer,
  fitToScreen,
  getLayerBounds,
  layerUnderPoint,
  reorderLayers,
  selectionHandleAtPoint,
  snapValue,
} from "./canvas-engine.mjs";

test("canvas engine clamps and snaps zoom values", () => {
  assert.equal(clampZoom(0.01), 0.1);
  assert.equal(clampZoom(25), 8);
  assert.equal(snapValue(53, 24), 48);
});

test("canvas engine fits and centers content in the viewport", () => {
  assert.deepEqual(fitToScreen(900, 650), {
    zoom: 0.3072916666666667,
    offset: { x: 284.0625, y: 30 },
  });
});

test("canvas fit and pointer coordinates stay valid in compact and offset viewports", () => {
  const fit = fitToScreen(320, 260, 1080, 1350);
  assert.equal(fit.zoom, 0.14814814814814814);
  assert.deepEqual(fit.offset, { x: 80, y: 30 });
  assert.deepEqual(canvasPointFromClient(260, 255, 20, 40, { x: 80, y: 30 }, fit.zoom), {
    x: 1080,
    y: 1248.75,
  });
  assert.deepEqual(fitToScreen(40, 20, 1080, 1350), {
    zoom: 0.1,
    offset: { x: -34, y: -57.5 },
  });
});

test("canvas engine keeps bounds and ordering stable for layer operations", () => {
  const layers = [
    { id: "a", name: "A", x: 0, y: 0, width: 80, height: 60, order: 0 },
    { id: "b", name: "B", x: 100, y: 90, width: 120, height: 80, order: 1 },
  ];

  const reordered = reorderLayers(layers, 1, 0);
  assert.deepEqual(
    reordered.map((layer) => layer.id),
    ["b", "a"],
  );

  const bounds = getLayerBounds(layers[1]);
  assert.equal(bounds.right, 220);
  assert.equal(bounds.bottom, 170);

  const hit = layerUnderPoint(layers, { x: 150, y: 120 });
  assert.equal(hit, "b");

  const handle = selectionHandleAtPoint(layers[1], { x: 220, y: 170 });
  assert.equal(handle, "se");

  const duplicate = duplicateLayer(layers[0]);
  assert.equal(duplicate.name, "A Copy");
  assert.equal(duplicate.x, 24);
});
