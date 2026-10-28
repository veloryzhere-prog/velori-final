import test from "node:test";
import assert from "node:assert/strict";
import { containsBlockedLanguage, normalizeChatPreferences, chatPreferenceKey } from "./policy.mjs";
test("Child Mode detects the requested words without matching innocent substrings", () => {
  for (const word of ["lund", "chut", "madherchod", "chod", "bhosdike", "behenchod", "randi"])
    assert.equal(containsBlockedLanguage("hello " + word + "!"), true, word);
  for (const text of [
    "London is lovely",
    "chutney recipe",
    "random notes",
    "hello friend",
    "a wonderful day",
  ])
    assert.equal(containsBlockedLanguage(text), false, text);
});
test("Child Mode detects paste, punctuation, zero-width, full-width and common leetspeak", () => {
  for (const text of [
    "LUND",
    "l.u.n.d",
    "c h u t",
    "m@darch0d",
    "bhench0d",
    "l\u200bund",
    "ｌｕｎｄ",
    "चूत",
    "रंडी",
    "FUCK",
  ])
    assert.equal(containsBlockedLanguage(text), true, text);
});
test("preferences stay separated by account and conversation", () => {
  assert.notEqual(chatPreferenceKey("alice", "one"), chatPreferenceKey("bob", "one"));
  assert.notEqual(chatPreferenceKey("alice", "one"), chatPreferenceKey("alice", "two"));
});
test("stored preferences are validated, bounded and cannot enable a string-valued safety mode", () => {
  const p = normalizeChatPreferences({
    theme: "bad",
    childMode: "true",
    hiddenIds: ["one", "one", 123],
    nicknames: { a: "x".repeat(100), b: 2 },
  });
  assert.equal(p.theme, "rose");
  assert.equal(p.childMode, false);
  assert.deepEqual(p.hiddenIds, ["one"]);
  assert.equal(p.nicknames.a.length, 32);
  assert.equal(p.nicknames.b, undefined);
});
