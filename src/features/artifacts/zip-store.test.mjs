import test from "node:test";
import assert from "node:assert/strict";
import { createSourceZip } from "./zip-store.mjs";
test("archive has ZIP signature, central directory and keeps UTF-8 intact", async () => {
  const zip = createSourceZip([
    ["index.html", "<h1>Hello</h1>"],
    ["src/app.js", 'console.log("✓")'],
  ]);
  const bytes = new Uint8Array(await zip.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.deepEqual([...bytes.slice(-22, -18)], [0x50, 0x4b, 0x05, 0x06]);
  assert.ok(zip.size > 60);
});
test("archive rejects traversal paths and duplicate names", () => {
  assert.throws(() => createSourceZip([["../secret", "x"]]));
  assert.throws(() =>
    createSourceZip([
      ["src/a", "x"],
      ["src/a", "y"],
    ]),
  );
});
