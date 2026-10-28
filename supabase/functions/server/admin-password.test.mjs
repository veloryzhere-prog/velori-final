import assert from "node:assert/strict";
import test from "node:test";
import {
  adminIdentityEmail,
  hashPassword,
  isValidNewPassword,
  isValidUsername,
  normalizeUsername,
  verifyPassword,
} from "./admin-password.mjs";

test("password hashes use the four-field PBKDF2 format and verify", async () => {
  const hash = await hashPassword("a sufficiently long password", 10_000);

  assert.equal(hash.split("$").length, 4);
  assert.match(hash, /^pbkdf2\$10000\$/);
  assert.equal(await verifyPassword("a sufficiently long password", hash), true);
});

test("a changed password invalidates the previous one", async () => {
  const oldHash = await hashPassword("old administrator password", 10_000);
  const newHash = await hashPassword("new administrator password", 10_000);

  assert.equal(await verifyPassword("new administrator password", newHash), true);
  assert.equal(await verifyPassword("old administrator password", newHash), false);
  assert.equal(await verifyPassword("old administrator password", oldHash), true);
});

test("the same password hashes to a different value each time", async () => {
  const first = await hashPassword("repeatable password value", 10_000);
  const second = await hashPassword("repeatable password value", 10_000);

  assert.notEqual(first, second);
  assert.equal(await verifyPassword("repeatable password value", first), true);
  assert.equal(await verifyPassword("repeatable password value", second), true);
});

test("malformed, empty or unsafe stored hashes fail closed", async () => {
  assert.equal(await verifyPassword("anything", ""), false);
  assert.equal(await verifyPassword("anything", null), false);
  assert.equal(await verifyPassword("anything", undefined), false);
  assert.equal(await verifyPassword("anything", "not-a-hash"), false);
  assert.equal(await verifyPassword("anything", "pbkdf2$1$AA==$AA=="), false);
  assert.equal(await verifyPassword("anything", "pbkdf2$10000$!$!"), false);
});

test("usernames normalise case-insensitively and reject invalid shapes", () => {
  assert.equal(normalizeUsername("  VELORYZMANAGEARYAN  "), "veloryzmanagearyan");
  assert.equal(isValidUsername("VELORYZMANAGEARYAN"), true);
  assert.equal(isValidUsername("admin.user-1"), true);
  assert.equal(isValidUsername("ab"), false);
  assert.equal(isValidUsername("has space"), false);
  assert.equal(isValidUsername("has@sign"), false);
  assert.equal(isValidUsername(""), false);
});

test("new passwords must meet the minimum length bound", () => {
  assert.equal(isValidNewPassword("short"), false);
  assert.equal(isValidNewPassword("a".repeat(12)), true);
  assert.equal(isValidNewPassword("a".repeat(201)), false);
  assert.equal(isValidNewPassword(123456789012), false);
});

test("the synthetic identity email is stable and never a real deliverable address", () => {
  assert.equal(
    adminIdentityEmail("VELORYZMANAGEARYAN"),
    "veloryzmanagearyan@admin.veloryz.invalid",
  );
  assert.equal(adminIdentityEmail(" Admin.User-1 "), "admin.user-1@admin.veloryz.invalid");
  assert.match(adminIdentityEmail("has space"), /@admin\.veloryz\.invalid$/);
});
