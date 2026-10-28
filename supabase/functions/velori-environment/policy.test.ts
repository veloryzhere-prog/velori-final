import { test } from "node:test";
import assert from "node:assert/strict";
import { safeMetadata, validateChange } from "./policy.ts";
test("protected root credentials and unknown names cannot be changed", () => {
  for (const name of [
    "SUPABASE_SERVICE_ROLE_KEY",
    "VELORI_ENVIRONMENT_MANAGEMENT_TOKEN",
    "VELORI_STUDIO_ENCRYPTION_KEY",
    "DENO_AUTH_TOKENS",
  ])
    assert.throws(() =>
      validateChange({ name, confirm: name, operation: "set", value: "private" }),
    );
});
test("changes require confirmation, bounded values and valid flags", () => {
  assert.throws(() =>
    validateChange({
      name: "GEMINI_API_KEY",
      confirm: "wrong",
      operation: "set",
      value: "private",
    }),
  );
  assert.throws(() =>
    validateChange({
      name: "VELORI_STUDIO_ENABLED",
      confirm: "VELORI_STUDIO_ENABLED",
      operation: "set",
      value: "yes",
    }),
  );
  assert.throws(() =>
    validateChange({
      name: "GEMINI_API_KEY",
      confirm: "GEMINI_API_KEY",
      operation: "set",
      value: "x".repeat(8193),
    }),
  );
  assert.equal(
    validateChange({
      name: "VELORI_CUSTOM_APP",
      confirm: "VELORI_CUSTOM_APP",
      operation: "set",
      value: "private",
    }).name,
    "VELORI_CUSTOM_APP",
  );
});
test("metadata strips values, digests and unsupported system keys", () => {
  const data = safeMetadata([
    { name: "GEMINI_API_KEY", value: "fixture-private-value-123", digest: "DIGEST" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", value: "ROOT" },
  ]);
  assert.equal(data.find((x) => x.name === "GEMINI_API_KEY")?.configured, true);
  assert.ok(!JSON.stringify(data).includes("fixture-private-value-123"));
  assert.ok(!JSON.stringify(data).includes("DIGEST"));
  assert.ok(!data.some((x) => x.name === "SUPABASE_SERVICE_ROLE_KEY"));
});
