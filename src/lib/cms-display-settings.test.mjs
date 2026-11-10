import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cmsDisplaySettings,
  withCmsDisplaySettings,
  editableCmsBlocks,
} from "./cms-display-settings.mjs";
test("admin display flags survive public column-limited reads without altering content", () => {
  const input = {
    footer_enabled: false,
    animation_enabled: false,
    content_blocks: [{ id: "link", type: "button", title: "Help", url: "/help" }],
  };
  const saved = withCmsDisplaySettings(input);
  assert.equal(saved.content_blocks.length, 2);
  assert.equal(saved.content_blocks[1].visible, false);
  assert.deepEqual(cmsDisplaySettings({ content_blocks: saved.content_blocks }), {
    footer_enabled: false,
    animation_enabled: false,
  });
  assert.deepEqual(editableCmsBlocks(saved.content_blocks), input.content_blocks);
  assert.equal(withCmsDisplaySettings(saved).content_blocks.length, 2);
  assert.deepEqual(
    cmsDisplaySettings({ content_blocks: [{ id: "velori_display_settings", text: "invalid" }] }),
    { footer_enabled: true, animation_enabled: true },
  );
});
