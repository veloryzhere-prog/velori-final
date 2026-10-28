/* Copyright © 2026 VELORYZ. All rights reserved. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyMusicLibrary,
  musicLibraryKey,
  readMusicLibrary,
  updateMusicLibrary,
} from "./music-library.ts";
test("music choices are isolated by account and contain no media URLs", () => {
  const values = new Map([
    [
      musicLibraryKey("owner-a"),
      JSON.stringify({ version: 1, saved: ["track-one"], recent: ["track-two"] }),
    ],
  ]);
  const storage = { getItem: (key: string) => values.get(key) ?? null };
  assert.deepEqual(readMusicLibrary(storage, "owner-a").saved, ["track-one"]);
  assert.deepEqual(readMusicLibrary(storage, "owner-b"), emptyMusicLibrary());
  assert.deepEqual(readMusicLibrary(storage, null), emptyMusicLibrary());
  assert.throws(
    () => updateMusicLibrary(emptyMusicLibrary(), "https://audio.invalid?token=secret", "save"),
    /valid catalog/,
  );
});
test("recent choices deduplicate, keep selection order and stop at twelve", () => {
  let state = emptyMusicLibrary();
  for (let i = 0; i < 20; i++) state = updateMusicLibrary(state, `track-${i}`, "recent");
  state = updateMusicLibrary(state, "track-15", "recent");
  assert.equal(state.recent.length, 12);
  assert.equal(state.recent[0], "track-15");
  assert.equal(new Set(state.recent).size, 12);
});
test("save toggles persist without affecting recents and quota failure preserves prior choices", () => {
  let state = updateMusicLibrary(emptyMusicLibrary(), "track-one", "recent");
  state = updateMusicLibrary(state, "track-one", "save");
  assert.deepEqual(state.saved, ["track-one"]);
  state = updateMusicLibrary(state, "track-one", "save");
  assert.deepEqual(state.saved, []);
  assert.deepEqual(state.recent, ["track-one"]);
  const full = { ...state, saved: Array.from({ length: 50 }, (_, i) => `track-${i}`) };
  assert.throws(() => updateMusicLibrary(full, "another", "save"), /50/);
  assert.equal(full.saved.length, 50);
});
test("malformed versions fail visibly and untrusted identifiers are filtered", () => {
  assert.throws(() => readMusicLibrary({ getItem: () => "{" }, "owner"));
  assert.throws(
    () => readMusicLibrary({ getItem: () => '{"version":2,"saved":[],"recent":[]}' }, "owner"),
    /restored/,
  );
  assert.deepEqual(
    readMusicLibrary(
      {
        getItem: () =>
          JSON.stringify({ version: 1, saved: ["valid", "valid", "https://invalid"], recent: [] }),
      },
      "owner",
    ).saved,
    ["valid"],
  );
});
