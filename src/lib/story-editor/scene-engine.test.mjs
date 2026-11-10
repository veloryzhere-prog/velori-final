import assert from "node:assert/strict";
import test from "node:test";
import {
  createStorySceneHistory,
  createStoryShape,
  moveStoryTransform,
  normalizeStoryObjectOrder,
  orderStoryObjects,
  recordStorySceneChange,
  redoStorySceneChange,
  reorderStoryObject,
  resizeStoryTransform,
  rotateStoryTransform,
  storyCanvasPixel,
  storyCanvasPoint,
  undoStorySceneChange,
} from "./scene-engine.mjs";

const transform = { x: 0.2, y: 0.3, width: 0.4, height: 0.2, rotation: 0 };

test("canvas coordinates map to and from normalized story space", () => {
  assert.deepEqual(storyCanvasPoint({ left: 20, top: 30, width: 200, height: 400 }, 120, 230), {
    x: 0.5,
    y: 0.5,
  });
  assert.deepEqual(storyCanvasPixel({ x: 0.5, y: 0.5 }, 1080, 1920), { x: 540, y: 960 });
  assert.deepEqual(storyCanvasPoint({ left: 20, top: 30, width: 200, height: 400 }, -5, 500), {
    x: 0,
    y: 1,
  });
  assert.throws(
    () => storyCanvasPoint({ left: 0, top: 0, width: 0, height: 10 }, 0, 0),
    /positive/,
  );
});

test("moving clamps an object to the canvas without changing its dimensions", () => {
  assert.deepEqual(moveStoryTransform(transform, 0.1, -0.1), {
    ...transform,
    x: 0.3,
    y: 0.2,
  });
  assert.equal(moveStoryTransform(transform, 1, 1).x, 0.6);
  assert.equal(moveStoryTransform(transform, 1, 1).y, 0.8);
});

test("resizing preserves the opposite corner and optionally the aspect ratio", () => {
  assert.deepEqual(resizeStoryTransform(transform, "se", 0.1, 0.05), {
    ...transform,
    width: 0.5,
    height: 0.25,
  });
  const proportional = resizeStoryTransform(transform, "se", 0.1, 0, true);
  assert.equal(proportional.width / proportional.height, 2);
  assert.equal(resizeStoryTransform(transform, "nw", 1, 1).width >= 0.04, true);
});

test("rotation stores normalized degrees and rejects non-finite geometry", () => {
  assert.equal(
    rotateStoryTransform(transform, { x: 0.4, y: 0.4 }, 0, (Math.PI * 3) / 2).rotation,
    -90,
  );
  assert.throws(() => moveStoryTransform(transform, Number.NaN, 0), /finite/);
});

test("layer ordering assigns unique indices and supports all four actions", () => {
  const objects = [
    { id: "a", zIndex: 8 },
    { id: "b", zIndex: 8 },
    { id: "c", zIndex: 20 },
  ];
  assert.deepEqual(
    normalizeStoryObjectOrder(objects).map(({ id, zIndex }) => [id, zIndex]),
    [
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ],
  );
  assert.deepEqual(
    reorderStoryObject(objects, "a", "forward").map(({ id }) => id),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    reorderStoryObject(objects, "c", "back").map(({ id }) => id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    reorderStoryObject(objects, "a", "front").map(({ id }) => id),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    reorderStoryObject(objects, "c", "backward").map(({ id }) => id),
    ["a", "c", "b"],
  );
});

test("scene rendering order shares z-index and cross-kind tie breaking", () => {
  const objects = [
    { id: "sticker", kind: "sticker", zIndex: 1 },
    { id: "shape", kind: "shape", zIndex: 1 },
    { id: "text", kind: "text", zIndex: 1 },
    { id: "back", kind: "shape", zIndex: 0 },
  ];
  assert.deepEqual(
    orderStoryObjects(objects).map(({ id }) => id),
    ["back", "text", "shape", "sticker"],
  );
});

test("shapes have stable IDs and serializable visual properties", () => {
  const shape = createStoryShape("shape-id", "ellipse", "2026-10-17T00:00:00.000Z");
  assert.equal(shape.id, "shape-id");
  assert.equal(shape.shape, "ellipse");
  assert.equal(shape.fill, "#F05A9D");
  assert.equal(shape.createdAt, "2026-10-17T00:00:00.000Z");
  assert.throws(() => createStoryShape("", "line"), /stable ID/);
});

test("scene history snapshots immutably, restores edits and clears redo branches", () => {
  const history = createStorySceneHistory();
  const before = [{ id: "text", content: "before" }];
  const after = [{ id: "text", content: "after" }];
  const edited = recordStorySceneChange(history, "slide-1", before, after, "text");
  after[0].content = "mutated";
  assert.equal(edited.past[0].after[0].content, "after");
  const undone = undoStorySceneChange(edited);
  assert.equal(undone.restore.objects[0].content, "before");
  const redone = redoStorySceneChange(undone.history);
  assert.equal(redone.restore.objects[0].content, "after");
  const branch = recordStorySceneChange(undone.history, "slide-1", before, [
    { id: "text", content: "branch" },
  ]);
  assert.equal(branch.future.length, 0);
  assert.equal(recordStorySceneChange(branch, "slide-1", before, before), branch);
});

test("history remains bounded to fifty operations", () => {
  let history = createStorySceneHistory();
  for (let index = 0; index < 60; index += 1) {
    history = recordStorySceneChange(history, "slide-1", index, index + 1);
  }
  assert.equal(history.past.length, 50);
});
