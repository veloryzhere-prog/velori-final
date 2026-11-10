import assert from "node:assert/strict";
import test from "node:test";
import {
  hashAccessCode,
  timingSafeEqualString,
  verifyBootstrapCode,
  verifyAccessCode,
} from "./access-code.mjs";

test("access code hashes use the four-field PBKDF2 format and verify", async () => {
  const hash = await hashAccessCode("long test code", 10_000);

  assert.equal(hash.split("$").length, 4);
  assert.match(hash, /^pbkdf2\$10000\$/);
  assert.equal(await verifyAccessCode("long test code", hash), true);
});

test("a replaced access code rejects the previous value", async () => {
  const oldHash = await hashAccessCode("old test code", 10_000);
  const newHash = await hashAccessCode("new test code", 10_000);

  assert.equal(await verifyAccessCode("new test code", newHash), true);
  assert.equal(await verifyAccessCode("old test code", newHash), false);
  assert.equal(await verifyAccessCode("old test code", oldHash), true);
});

test("a stored or disabled code immediately supersedes the initial secret", async () => {
  const rotatedHash = await hashAccessCode("new long test code", 10_000);
  const rotated = await verifyBootstrapCode("initial", "initial", {
    code_hash: rotatedHash,
    enabled: true,
  });
  const accepted = await verifyBootstrapCode("new long test code", "initial", {
    code_hash: rotatedHash,
    enabled: true,
  });
  const disabled = await verifyBootstrapCode("initial", "initial", {
    code_hash: "disabled",
    enabled: false,
  });

  assert.deepEqual(rotated, { matchesSecret: false, matchesStored: false });
  assert.deepEqual(accepted, { matchesSecret: false, matchesStored: true });
  assert.deepEqual(disabled, { matchesSecret: false, matchesStored: false });
});

test("malformed or unsafe hashes fail closed", async () => {
  assert.equal(await verifyAccessCode("anything", "not-a-hash"), false);
  assert.equal(await verifyAccessCode("anything", "pbkdf2$1$AA==$AA=="), false);
  assert.equal(await verifyAccessCode("anything", "pbkdf2$10000$!$!"), false);
});

test("timing-safe string comparison handles equality and differing lengths", () => {
  assert.equal(timingSafeEqualString("same", "same"), true);
  assert.equal(timingSafeEqualString("same", "same!"), false);
  assert.equal(timingSafeEqualString("é", "e"), false);
});
