/* Copyright © 2026 VELORYZ. All rights reserved. */
import test from "node:test";
import assert from "node:assert/strict";
import { musicExcerpt } from "./music-range.ts";
test("twenty second excerpts respect source duration, catalog bounds and invalid seeks", () => {
  const full = { durationSeconds: 180, excerptStartSeconds: 0, excerptEndSeconds: null };
  assert.deepEqual(musicExcerpt(full, 179), {
    start: 160,
    end: 180,
    duration: 20,
    minStart: 0,
    maxStart: 160,
  });
  assert.equal(musicExcerpt({ ...full, durationSeconds: 7 }, 0)?.duration, 7);
  assert.equal(musicExcerpt({ ...full, durationSeconds: null }, 0), null);
  assert.deepEqual(musicExcerpt({ ...full, excerptStartSeconds: 30, excerptEndSeconds: 40 }, 99), {
    start: 30,
    end: 40,
    duration: 10,
    minStart: 30,
    maxStart: 30,
  });
  assert.equal(musicExcerpt(full, NaN)?.start, 0);
});
