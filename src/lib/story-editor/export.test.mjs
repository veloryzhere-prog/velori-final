import assert from "node:assert/strict";
import test from "node:test";
import {
  formatStorySchedule,
  getStoryExportDimensions,
  getStoryExportFileName,
  getStoryMp4MimeType,
  parseStorySchedule,
} from "./export.mjs";

test("story export sizes are limited to the requested portrait resolutions", () => {
  assert.deepEqual(getStoryExportDimensions("720p"), [720, 1280]);
  assert.deepEqual(getStoryExportDimensions("1080p"), [1080, 1920]);
  assert.equal(getStoryExportDimensions("4k"), null);
});

test("scheduled local times convert using the selected timezone offset", () => {
  const scheduled = parseStorySchedule(
    "2026-10-15T09:30",
    "Asia/Kolkata",
    Date.parse("2026-10-14T00:00:00.000Z"),
  );
  assert.equal(scheduled, "2026-10-15T04:00:00.000Z");
  assert.match(formatStorySchedule(scheduled, "Asia/Kolkata"), /9:30/);
});

test("schedule validation rejects invalid zones, nonexistent DST times, and past times", () => {
  assert.throws(
    () => parseStorySchedule("2026-02-31T09:30", "UTC", 0),
    /valid local date and time/,
  );
  assert.throws(() => parseStorySchedule("2026-10-15T09:30", "Mars/Olympus", 0), /IANA timezone/);
  assert.throws(
    () =>
      parseStorySchedule(
        "2026-03-08T02:30",
        "America/New_York",
        Date.parse("2026-01-01T00:00:00.000Z"),
      ),
    /does not exist/,
  );
  assert.throws(
    () =>
      parseStorySchedule(
        "2026-10-13T09:30",
        "Asia/Kolkata",
        Date.parse("2026-10-14T00:00:00.000Z"),
      ),
    /future/,
  );
});

test("ambiguous daylight-saving times resolve to the first matching instant", () => {
  assert.equal(
    parseStorySchedule(
      "2026-11-01T01:30",
      "America/New_York",
      Date.parse("2026-01-01T00:00:00.000Z"),
    ),
    "2026-11-01T05:30:00.000Z",
  );
});

test("export names are sanitized and MP4 capability is explicit", () => {
  assert.equal(
    getStoryExportFileName("Autumn story! / 01", 2, "720p", "png"),
    "Autumn-story-01-slide-2-720p.png",
  );
  assert.equal(
    getStoryMp4MimeType(() => false),
    null,
  );
  assert.equal(
    getStoryMp4MimeType((type) => type === "video/mp4"),
    "video/mp4",
  );
});
