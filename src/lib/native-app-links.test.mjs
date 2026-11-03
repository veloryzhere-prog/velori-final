import test from "node:test";
import assert from "node:assert/strict";
import { resolveNativeAppLink } from "./native-app-links.ts";

test("resolves native auth callbacks and preserves verification parameters", () => {
  assert.equal(
    resolveNativeAppLink("online.veloryz.velori://auth/confirm?token_hash=abc&type=email"),
    "/auth/confirm?token_hash=abc&type=email",
  );
  assert.equal(
    resolveNativeAppLink("online.veloryz.velori://auth/reset-password?code=abc"),
    "/reset-password?code=abc",
  );
});

test("resolves allowlisted VELORI routes and preserves app navigation state", () => {
  assert.equal(
    resolveNativeAppLink("https://chat.veloryz.online/messages?conversation=42"),
    "/messages?conversation=42",
  );
  assert.equal(resolveNativeAppLink("online.veloryz.velori://profile/velori"), "/profile/velori");
});

test("rejects links outside the app domain and route allowlist", () => {
  assert.equal(resolveNativeAppLink("https://example.com/home"), null);
  assert.equal(resolveNativeAppLink("https://chat.veloryz.online/admin"), null);
  assert.equal(resolveNativeAppLink("javascript:alert(1)"), null);
  assert.equal(resolveNativeAppLink("online.veloryz.velori://auth/unknown"), null);
});
