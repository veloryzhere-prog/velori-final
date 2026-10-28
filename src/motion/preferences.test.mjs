import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMotionPreference, resolveInterfaceMotion } from "./preferences.mjs";

test("first visit follows the device without disabling the interface", () => {
  assert.equal(resolveInterfaceMotion(null, false), "full");
  assert.equal(resolveInterfaceMotion(null, true), "gentle");
});
test("an explicit full-motion choice overrides device reduction", () => {
  assert.equal(resolveInterfaceMotion("full", true), "full");
});
test("off and gentle choices remain stable when device settings change", () => {
  for (const reduced of [true, false]) {
    assert.equal(resolveInterfaceMotion("off", reduced), "off");
    assert.equal(resolveInterfaceMotion("gentle", reduced), "gentle");
  }
});
test("malformed stored preferences fall back to the device setting", () => {
  for (const invalid of ["none", "FULL", {}, [], undefined, 0]) {
    assert.equal(normalizeMotionPreference(invalid), "auto");
    assert.equal(resolveInterfaceMotion(invalid, true), "gentle");
  }
});
