const ID = "velori_display_settings";
/** Public presentation flags travel in an inert hidden CMS block, using existing public column grants. */
export function cmsDisplaySettings(page) {
  const block = (page.content_blocks ?? []).find((b) => b && b.id === ID);
  let saved = {};
  try {
    saved = JSON.parse(block?.text ?? "{}");
  } catch {}
  return {
    footer_enabled:
      typeof page.footer_enabled === "boolean"
        ? page.footer_enabled
        : saved.footer_enabled !== false,
    animation_enabled:
      typeof page.animation_enabled === "boolean"
        ? page.animation_enabled
        : saved.animation_enabled !== false,
  };
}
export function withCmsDisplaySettings(page) {
  const settings = cmsDisplaySettings(page);
  return {
    ...page,
    content_blocks: [
      ...(page.content_blocks ?? []).filter((b) => b && b.id !== ID),
      {
        id: ID,
        type: "callout",
        title: "Page display settings",
        text: JSON.stringify(settings),
        visible: false,
      },
    ],
  };
}
export function editableCmsBlocks(blocks) {
  return (blocks ?? []).filter((b) => b && b.id !== ID);
}
