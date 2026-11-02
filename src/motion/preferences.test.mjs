import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMotionPreference, resolveInterfaceMotion } from "./preferences.mjs";

test("first visit enables full motion unless the device requests reduced motion", () => {
  assert.equal(normalizeMotionPreference(null), "full");
  assert.equal(resolveInterfaceMotion(null, false), "full");
  assert.equal(resolveInterfaceMotion(null, true), "gentle");
});
test("the device reduced-motion preference remains authoritative over full motion", () => {
  assert.equal(resolveInterfaceMotion("full", true), "gentle");
});
test("off and gentle choices remain stable when device settings change", () => {
  for (const reduced of [true, false]) {
    assert.equal(resolveInterfaceMotion("off", reduced), "off");
  }
  assert.equal(resolveInterfaceMotion("gentle", true), "gentle");
  assert.equal(resolveInterfaceMotion("gentle", false), "gentle");
});
test("malformed and legacy automatic preferences default to full motion", () => {
  for (const invalid of ["none", "FULL", {}, [], undefined, 0, "auto"]) {
    assert.equal(normalizeMotionPreference(invalid), "full");
    assert.equal(resolveInterfaceMotion(invalid, false), "full");
    assert.equal(resolveInterfaceMotion(invalid, true), "gentle");
  }
});
