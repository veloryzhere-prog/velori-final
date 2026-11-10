import { test } from "node:test";
import assert from "node:assert/strict";
import { managementDiagnostic } from "./management-diagnostics.mjs";

test("management diagnostics explain expired or invalid credentials without leaking secrets", () => {
  const result = managementDiagnostic(401);
  assert.equal(result.code, "management_token_invalid_or_expired");
  assert.match(result.error, /HTTP 401/);
  assert.match(result.hint, /Edge Functions → Secrets/);
  assert.equal(JSON.stringify(result).includes("Bearer "), false);
});

test("management diagnostics distinguish permissions, project, rate limit and outage", () => {
  assert.equal(managementDiagnostic(403).code, "management_token_permission_denied");
  assert.equal(managementDiagnostic(404).code, "management_project_or_endpoint_not_found");
  assert.equal(managementDiagnostic(429).code, "management_api_rate_limited");
  assert.equal(managementDiagnostic(503).code, "management_api_temporarily_unavailable");
  assert.equal(managementDiagnostic(0).code, "management_api_unreachable");
});

test("write diagnostics describe the failed operation and never include request contents", () => {
  const result = managementDiagnostic(403, "write");
  assert.match(result.error, /change/);
  assert.equal(JSON.stringify(result).includes("secret-value"), false);
});
