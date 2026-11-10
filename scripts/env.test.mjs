import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveValue } from "./env.mjs";

test("secret lookups do not fall back to Vite env files", () => {
  assert.equal(resolveValue("VELORI_TEST_SECRET_LOOKUP_ONLY", { secret: true }), "");
});

test("secret lookups accept process environment overrides", () => {
  const key = "SUPABASE_SECRET_KEY";
  const previous = process.env[key];
  process.env[key] = "test-secret";
  try {
    assert.equal(resolveValue(key, { secret: true }), "test-secret");
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});
