import assert from "node:assert/strict";
import test from "node:test";
import {
  checkStoryBrandConsistency,
  mergeStoryCollaborationEvents,
  mergeStoryProjectSnapshots,
  normalizeStoryCollaborationEvent,
} from "./collaboration.mjs";

const slide = (id, updatedAt, background = null) => ({ id, updatedAt, order: 0, background });
const snapshot = (actorId, updatedAt, slides, slideRevisions, removedSlides = {}) => ({
  actorId,
  updatedAt,
  slides,
  slideRevisions,
  removedSlides,
  textOverlaysBySlide: {},
  mediaSettingsBySlide: {},
  transitionsBySlide: {},
  slideLoops: {},
});

test("collaboration events validate and merge without duplicate identifiers", () => {
  const first = normalizeStoryCollaborationEvent({
    id: "c1",
    type: "comment",
    payload: { slideId: "s1", body: "Looks good" },
    createdAt: "2026-10-14T10:00:00.000Z",
  });
  assert.equal(mergeStoryCollaborationEvents([first], [first]).length, 1);
  assert.throws(
    () =>
      normalizeStoryCollaborationEvent({ id: "x", type: "unknown", payload: {}, createdAt: "bad" }),
    /supported type/,
  );
});

test("independent slide updates merge without overwriting each other", () => {
  const one = snapshot(
    "a",
    "2026-10-14T10:00:00.000Z",
    [slide("s1", "10:00"), slide("s2", "10:00")],
    {
      s1: "2026-10-14T10:00:00.000Z",
      s2: "2026-10-14T10:00:00.000Z",
    },
  );
  const two = snapshot(
    "b",
    "2026-10-14T10:00:02.000Z",
    [slide("s1", "10:00"), slide("s2", "10:02", "blue")],
    {
      s1: "2026-10-14T10:00:00.000Z",
      s2: "2026-10-14T10:00:02.000Z",
    },
  );
  const merged = mergeStoryProjectSnapshots(one, two);
  assert.equal(merged.slides.find((item) => item.id === "s2").background, "blue");
  assert.equal(merged.slides.length, 2);
});

test("same-slide updates resolve by revision and retain the winning slide overlays", () => {
  const earlier = snapshot("actor-a", "2026-10-14T10:00:00.000Z", [slide("s1", "10:00", "red")], {
    s1: "2026-10-14T10:00:00.000Z",
  });
  earlier.textOverlaysBySlide.s1 = [{ id: "old", color: "#000", fontFamily: "Arial" }];
  const later = snapshot("actor-b", "2026-10-14T10:00:01.000Z", [slide("s1", "10:01", "blue")], {
    s1: "2026-10-14T10:00:01.000Z",
  });
  later.textOverlaysBySlide.s1 = [{ id: "new", color: "#fff", fontFamily: "Inter" }];
  const merged = mergeStoryProjectSnapshots(earlier, later);
  assert.equal(merged.slides[0].background, "blue");
  assert.equal(merged.textOverlaysBySlide.s1[0].id, "new");
});

test("draft media references follow the winning slide revision", () => {
  const earlier = snapshot("actor-a", "2026-10-14T10:00:00.000Z", [slide("s1", "10:00")], {
    s1: "2026-10-14T10:00:00.000Z",
  });
  earlier.draftMediaBySlide = { s1: "photo-old" };
  const later = snapshot("actor-b", "2026-10-14T10:00:01.000Z", [slide("s1", "10:01")], {
    s1: "2026-10-14T10:00:01.000Z",
  });
  later.draftMediaBySlide = { s1: "photo-new" };

  assert.deepEqual(mergeStoryProjectSnapshots(earlier, later).draftMediaBySlide, {
    s1: "photo-new",
  });
});

test("slide drawing documents follow the winning slide revision when drafts merge", () => {
  const earlier = snapshot("actor-a", "2026-10-14T10:00:00.000Z", [slide("s1", "10:00")], {
    s1: "2026-10-14T10:00:00.000Z",
  });
  earlier.drawingsBySlide = { s1: { version: 1, strokes: [{ id: "old" }] } };
  const later = snapshot("actor-b", "2026-10-14T10:00:01.000Z", [slide("s1", "10:01")], {
    s1: "2026-10-14T10:00:01.000Z",
  });
  later.drawingsBySlide = { s1: { version: 1, strokes: [{ id: "new" }] } };
  const merged = mergeStoryProjectSnapshots(earlier, later);
  assert.equal(merged.drawingsBySlide.s1.strokes[0].id, "new");
});

test("slide tombstones prevent removed slides from reappearing", () => {
  const existing = snapshot("a", "2026-10-14T10:00:00.000Z", [slide("s1", "10:00")], {
    s1: "2026-10-14T10:00:00.000Z",
  });
  const removed = snapshot(
    "b",
    "2026-10-14T10:00:02.000Z",
    [],
    {},
    {
      s1: "2026-10-14T10:00:02.000Z",
    },
  );
  assert.equal(mergeStoryProjectSnapshots(existing, removed).slides.length, 0);
});

test("brand rules flag colors and fonts outside the approved lists", () => {
  const overlays = [
    { id: "t1", content: "Welcome", color: "#f00", fontFamily: "Other" },
    { id: "t2", content: "On brand", color: "#fff", fontFamily: "Inter" },
  ];
  assert.deepEqual(
    checkStoryBrandConsistency(overlays, ["#fff"], ["Inter"]).map((issue) => issue.id),
    ["t1:color", "t1:font"],
  );
});
