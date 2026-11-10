import assert from "node:assert/strict";
import test from "node:test";
import {
  isStrongAccountPassword,
  isValidAccountEmail,
  normalizeEmail,
  passwordPolicy,
} from "./auth-input.mjs";

test("email normalization trims and lowercases", () => {
  assert.equal(normalizeEmail("  Person@Example.COM "), "person@example.com");
});

test("email validator rejects malformed and oversized addresses", () => {
  assert.equal(isValidAccountEmail("person@example.com"), true);
  assert.equal(isValidAccountEmail("person@localhost"), false);
  assert.equal(isValidAccountEmail("person..x@example.com"), false);
  assert.equal(isValidAccountEmail("person @example.com"), false);
  assert.equal(isValidAccountEmail(`${"x".repeat(250)}@example.com`), false);
});

test("password policy requires at least 12 characters with a letter and a non-letter", () => {
  assert.deepEqual(passwordPolicy("longpassword"), {
    longEnough: true,
    hasLetter: true,
    hasNumberOrSymbol: false,
  });
  assert.equal(isStrongAccountPassword("LongPassword7"), true);
  assert.equal(isStrongAccountPassword("short7"), false);
  assert.equal(isStrongAccountPassword("123456789012"), false);
});
