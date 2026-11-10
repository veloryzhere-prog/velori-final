/* Copyright © 2026 VELORYZ. All rights reserved. */
import assert from "node:assert/strict";
import test from "node:test";
import { compositionMetadata, storyDisplaySeconds } from "./composition.ts";
const track = {
  id: "catalog-track",
  title: "QA",
  artistName: "QA",
  audioUrl: "https://example.invalid/private?token=secret",
  coverUrl: null,
  durationSeconds: 120,
  excerptStartSeconds: 35,
  excerptEndSeconds: 55,
  volume: 0.6,
  searchAliases: [],
  genre: "",
  tags: [],
  availableIn: ["story" as const],
  licenseReference: "QA",
};
test("composition persists the selected excerpt without URLs or catalog secrets", () => {
  const record = compositionMetadata(track);
  assert.deepEqual(record.soundtrack, {
    trackId: "catalog-track",
    startSeconds: 35,
    durationSeconds: 20,
    volume: 0.6,
  });
  assert.equal(JSON.stringify(record).includes("secret"), false);
});
test("sticker removal leaves the soundtrack and later slides use the correct offset", () => {
  assert.equal(compositionMetadata(track).musicSticker, undefined);
  assert.equal(compositionMetadata(track).audioBakedIn, true);
  assert.deepEqual(compositionMetadata(track, null, 15).soundtrack, {
    trackId: "catalog-track",
    startSeconds: 50,
    durationSeconds: 5,
    volume: 0.6,
  });
  assert.equal(compositionMetadata(track, null, 20).soundtrack, undefined);
});
test("short source and invalid excerpt metadata are handled truthfully", () => {
  assert.equal(
    compositionMetadata({
      ...track,
      durationSeconds: 4,
      excerptStartSeconds: 0,
      excerptEndSeconds: 4,
    }).soundtrack?.durationSeconds,
    4,
  );
  assert.throws(() => compositionMetadata({ ...track, excerptEndSeconds: 56 }), /duration/);
  assert.throws(() => compositionMetadata({ ...track, volume: NaN }), /volume/);
  assert.throws(() => compositionMetadata({ ...track, durationSeconds: 40 }), /excerpt/);
});
test("legacy stills retain seven seconds and valid configured durations are preserved", () => {
  for (const value of [undefined, null, NaN, -1, 0, 601])
    assert.equal(storyDisplaySeconds(value), 7);
  assert.equal(storyDisplaySeconds("15"), 15);
  assert.equal(storyDisplaySeconds(0.2), 0.2);
});
