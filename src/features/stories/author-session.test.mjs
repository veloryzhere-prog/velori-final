import test from "node:test";
import assert from "node:assert/strict";
import { authorSession } from "./author-session.mjs";
const stories = ["a", "b", "a", "c", "b", "c"].map((author_id, id) => ({ id, author_id }));
test("progress segments only include the current author even for interleaved rows", () => {
  const s = authorSession(stories, 2);
  assert.deepEqual(s.indices, [0, 2]);
  assert.equal(s.position, 1);
  assert.equal(s.nextMoment, 1);
  assert.equal(s.nextAuthor, 1);
  assert.equal(s.previousMoment, 0);
});
test("creator swipe picks a distinct author, never another same-person segment", () => {
  assert.equal(authorSession(stories, 4).nextAuthor, 3);
  assert.equal(authorSession(stories, 4).previousAuthor, 0);
  assert.equal(authorSession(stories, 5).nextAuthor, null);
  assert.equal(authorSession(stories, 3).previousMoment, 4);
});
test("invalid story position never dereferences an author", () => {
  assert.equal(authorSession(stories, -1), null);
  assert.equal(authorSession(stories, 99), null);
});
