import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMotionPreference, resolveInterfaceMotion } from "./preferences.mjs";

test("first visit follows the device motion preference", () => {
  assert.equal(normalizeMotionPreference(null), "auto");
  assert.equal(resolveInterfaceMotion(null, false), "full");
  assert.equal(resolveInterfaceMotion(null, true), "gentle");
});
test("device mode follows reduced-motion changes while explicit choices remain selected", () => {
  assert.equal(normalizeMotionPreference("auto"), "auto");
  assert.equal(resolveInterfaceMotion("auto", false), "full");
  assert.equal(resolveInterfaceMotion("auto", true), "gentle");
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
test("malformed preferences default to device motion", () => {
  for (const invalid of ["none", "FULL", {}, [], undefined, 0]) {
    assert.equal(normalizeMotionPreference(invalid), "auto");
    assert.equal(resolveInterfaceMotion(invalid, false), "full");
    assert.equal(resolveInterfaceMotion(invalid, true), "gentle");
  }
});
