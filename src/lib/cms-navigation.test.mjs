import test from "node:test";
import assert from "node:assert/strict";
import { cmsNavigationTarget } from "./cms-navigation.mjs";
test("CMS routes resolve through the owner page while retaining query and fragment", () => {
  assert.equal(
    cmsNavigationTarget("/forge-docs", "https://velori.test/forge-payments"),
    "/forge-docs",
  );
  assert.equal(
    cmsNavigationTarget("/forge/pricing?currency=INR#plans", "https://velori.test/forge-payments"),
    "/forge/pricing?currency=INR#plans",
  );
});
test("CMS routing refuses external, credential-bearing, executable and srcdoc origins", () => {
  for (const value of [
    "//evil.test/path",
    "/\\evil.test/path",
    "https://evil.test/path",
    "javascript:alert(1)",
    "https://name:pass@velori.test/path",
  ])
    assert.equal(cmsNavigationTarget(value, "https://velori.test/about"), null);
  assert.equal(cmsNavigationTarget("/forge-docs", "about:srcdoc"), null);
});
test("same-document fragments are kept in the existing scroll handler", () => {
  assert.equal(cmsNavigationTarget("#chapter-1", "https://velori.test/forge-docs"), null);
});
