import assert from "node:assert/strict";
import test from "node:test";
import { detectStudioAssetMime } from "./studio-catalog-files.mjs";

const bytes = (...values) => new Uint8Array(values);

test("catalog upload validation detects supported audio signatures", () => {
  assert.equal(detectStudioAssetMime(bytes(0x49, 0x44, 0x33), "audio"), "audio/mpeg");
  assert.equal(detectStudioAssetMime(bytes(0xff, 0xfb), "audio"), "audio/mpeg");
  assert.equal(
    detectStudioAssetMime(
      bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45),
      "audio",
    ),
    "audio/wav",
  );
  assert.equal(detectStudioAssetMime(bytes(0x4f, 0x67, 0x67, 0x53), "audio"), "audio/ogg");
});

test("catalog upload validation detects supported raster images and rejects unknown data", () => {
  assert.equal(
    detectStudioAssetMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "image"),
    "image/png",
  );
  assert.equal(detectStudioAssetMime(bytes(0xff, 0xd8, 0xff), "image"), "image/jpeg");
  assert.equal(
    detectStudioAssetMime(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61), "image"),
    "image/gif",
  );
  assert.equal(
    detectStudioAssetMime(
      bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50),
      "image",
    ),
    "image/webp",
  );
  assert.equal(detectStudioAssetMime(bytes(0x3c, 0x73, 0x76, 0x67), "image"), null);
  assert.equal(detectStudioAssetMime(bytes(0, 1, 2), "audio"), null);
});
