import test from "node:test";
import assert from "node:assert/strict";
import { validatePublicConnection } from "./verify-public-config.mjs";
const publicKey = "sb_publishable_abcdefghijklmnop";
const token = (role) =>
  [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(JSON.stringify({ role })).toString("base64url"),
    "signature",
  ].join(".");
test("release guard accepts public keys and legacy anon credentials", () => {
  assert.equal(validatePublicConnection("https://example.supabase.co", publicKey), true);
  assert.equal(validatePublicConnection("http://localhost:54321", token("anon")), true);
});
test("release guard rejects missing and placeholder connections", () => {
  for (const url of [
    "",
    "https://placeholder.supabase.co",
    "http://example.com",
    "https://example.supabase.co/path",
    "https://user:pass@example.supabase.co",
  ])
    assert.throws(() => validatePublicConnection(url, publicKey));
});
test("release guard rejects private credentials without printing the supplied value", () => {
  for (const key of [
    "",
    "public-placeholder-key",
    "sb_secret_privatefixture",
    token("service_role"),
  ]) {
    assert.throws(
      () => validatePublicConnection("https://example.supabase.co", key),
      (error) =>
        error.message.includes("publishable") && !error.message.includes(key || "EMPTY_TOKEN"),
    );
  }
});
