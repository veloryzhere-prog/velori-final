import test from "node:test";
import assert from "node:assert/strict";
import { resolveViewportMetrics } from "./viewport.mjs";
test("visible viewport follows address bar height without marking a keyboard", () => {
  assert.deepEqual(
    resolveViewportMetrics({ layoutHeight: 900, visualHeight: 844, baselineHeight: 900 }),
    { height: 844, keyboard: false },
  );
});
test("focused phone input detects both overlay and resizing keyboards", () => {
  assert.deepEqual(
    resolveViewportMetrics({
      layoutHeight: 844,
      visualHeight: 490,
      baselineHeight: 844,
      editable: true,
    }),
    { height: 490, keyboard: true },
  );
  assert.deepEqual(
    resolveViewportMetrics({
      layoutHeight: 490,
      visualHeight: 490,
      baselineHeight: 844,
      editable: true,
    }),
    { height: 490, keyboard: true },
  );
});
test("pinch zoom and invalid geometry leave the current layout alone", () => {
  for (const input of [
    { layoutHeight: 844, visualHeight: 400, scale: 2 },
    { layoutHeight: 0 },
    { layoutHeight: NaN },
  ])
    assert.equal(resolveViewportMetrics(input), null);
});
test("absent visual viewport uses layout height and a closed input clears keyboard state", () => {
  assert.deepEqual(resolveViewportMetrics({ layoutHeight: 800 }), { height: 800, keyboard: false });
  assert.deepEqual(
    resolveViewportMetrics({
      layoutHeight: 490,
      visualHeight: 490,
      baselineHeight: 844,
      editable: false,
    }),
    { height: 490, keyboard: false },
  );
});
