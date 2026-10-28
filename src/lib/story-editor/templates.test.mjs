import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStoryBrandKitToOverlays,
  createStoryTemplateOverlays,
  DEFAULT_STORY_BRAND_KIT,
  getStoryTemplate,
  STORY_TEMPLATES,
} from "./templates.mjs";

const kit = {
  ...DEFAULT_STORY_BRAND_KIT,
  primaryColor: "#123456",
  secondaryColor: "#654321",
  accentColor: "#abcdef",
  fontFamily: "Manrope",
};

test("the requested story template categories are available", () => {
  assert.deepEqual(
    STORY_TEMPLATES.map(({ id }) => id),
    ["promo", "behind-the-scenes", "announcement", "poll-campaign"],
  );
  assert.equal(getStoryTemplate("poll-campaign").poll, true);
  assert.equal(getStoryTemplate("unknown"), null);
});

test("template overlays use the chosen brand palette and font", () => {
  const overlays = createStoryTemplateOverlays("promo", kit, () => "template-overlay");
  assert.equal(overlays.length, 3);
  assert.ok(overlays.every((overlay) => overlay.fontFamily === "Manrope"));
  assert.deepEqual(
    overlays.map(({ color }) => color),
    ["#123456", "#abcdef", "#123456"],
  );
  assert.equal(overlays[0].id, "template-overlay");
});

test("brand kit updates fonts and colors while respecting the color lock", () => {
  const overlays = [
    { id: "a", content: "Title", color: "#ffffff", fontFamily: "Georgia" },
    { id: "b", content: "Caption", color: "#000000", fontFamily: "Arial" },
  ];
  const applied = applyStoryBrandKitToOverlays(overlays, kit);
  assert.deepEqual(
    applied.map(({ color, fontFamily }) => [color, fontFamily]),
    [
      ["#123456", "Manrope"],
      ["#123456", "Manrope"],
    ],
  );
  const locked = applyStoryBrandKitToOverlays(overlays, kit, true);
  assert.deepEqual(
    locked.map(({ color, fontFamily }) => [color, fontFamily]),
    [
      ["#ffffff", "Manrope"],
      ["#000000", "Manrope"],
    ],
  );
});

test("unsupported templates fail instead of silently producing an empty slide", () => {
  assert.throws(() => createStoryTemplateOverlays("missing", kit), /supported story template/);
});
