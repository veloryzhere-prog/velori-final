import assert from "node:assert/strict";
import { test } from "node:test";
import { safeReturnPath } from "./auth-navigation.mjs";

const origin = "http://127.0.0.1:8443";

test("post-login navigation accepts an internal post destination", () => {
  assert.equal(
    safeReturnPath({ from: "/post/123?highlight=reply#comments" }, origin),
    "/post/123?highlight=reply#comments",
  );
});

test("post-login navigation rejects external and malformed destinations", () => {
  for (const from of [
    "https://attacker.example/",
    "//attacker.example/",
    "/\\attacker.example/",
    "",
    42,
  ]) {
    assert.equal(safeReturnPath({ from }, origin), null);
  }
});

test("post-login navigation rejects auth-only destinations", () => {
  for (const from of ["/login", "/signup", "/forgot-password", "/onboarding"]) {
    assert.equal(safeReturnPath({ from }, origin), null);
  }
});

test("post-login navigation safely handles malformed state", () => {
  assert.equal(safeReturnPath(null, origin), null);
  assert.equal(safeReturnPath({}, origin), null);
  assert.equal(safeReturnPath("https://attacker.example/", origin), null);
});
