/* Copyright © 2026 VELORYZ. All rights reserved. */
import assert from "node:assert/strict";
import test from "node:test";
import { createUuid } from "./uuid.mjs";

test("UUID generation prefers the native method without consuming fallback bytes", () => {
  const source = {
    randomUUID() {
      assert.equal(this, source);
      return "00000000-0000-4000-8000-000000000001";
    },
    getRandomValues() {
      throw new Error("Fallback must not run");
    },
  };
  assert.equal(createUuid(source), "00000000-0000-4000-8000-000000000001");
});

test("Web Crypto fallback applies the UUID version and variant bits", () => {
  assert.equal(
    createUuid({ getRandomValues: (bytes) => bytes.fill(255) }),
    "ffffffff-ffff-4fff-bfff-ffffffffffff",
  );
  assert.equal(
    createUuid({ getRandomValues: (bytes) => bytes.fill(0) }),
    "00000000-0000-4000-8000-000000000000",
  );
});

test("Fallback creates distinct valid UUIDs when native randomUUID is absent", () => {
  const source = { getRandomValues: (bytes) => globalThis.crypto.getRandomValues(bytes) };
  const ids = Array.from({ length: 256 }, () => createUuid(source));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(
    ids.every((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id),
    ),
  );
});

test("UUID generation fails closed when cryptographic randomness is unavailable", () => {
  assert.throws(() => createUuid(null), /Secure random generation/);
  assert.throws(() => createUuid({}), /Secure random generation/);
});
