import assert from "node:assert/strict";
import test from "node:test";
import {
  applyBrandTokens,
  createTemplateCatalog,
  filterTemplates,
  pushHistory,
} from "./brand-templates.mjs";

test("starter library provides more than 1000 filterable editable recipes", () => {
  const catalog = createTemplateCatalog();
  assert.equal(catalog.length, 1200);
  assert.ok(
    filterTemplates(catalog, { platform: "Instagram", industry: "Travel", type: "Story" }).length >
      0,
  );
  assert.equal(catalog[0].locked.colors, true);
});

test("brand tokens apply without changing ordinary post copy", () => {
  assert.equal(
    applyBrandTokens("{{brand}} says {{tone}}", { name: "Velori", tone: "Be kind." }),
    "Velori says Be kind.",
  );
  assert.equal(applyBrandTokens("Hello world", { name: "Velori" }), "Hello world");
});

test("history is capped at fifty entries", () => {
  assert.equal(
    pushHistory(
      Array.from({ length: 50 }, (_, i) => i),
      50,
    ).length,
    50,
  );
  assert.deepEqual(pushHistory(["a"], "b"), ["a", "b"]);
});
