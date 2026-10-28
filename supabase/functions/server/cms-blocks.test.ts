import { validatePageContentBlocks } from "./cms-blocks.ts";

Deno.test("visual page blocks validate and sanitize HTML blocks", () => {
  const result = validatePageContentBlocks([
    { id: "intro", type: "heading", title: "Introduction", level: 2 },
    { id: "terms", type: "html", text: '<p onclick="run()">Terms</p><script>run()</script>' },
    { id: "items", type: "list", ordered: true, items: ["First", "Second"] },
  ]);
  if ("error" in result) throw new Error(result.error);
  if (result.blocks[1].text?.includes("script") || result.blocks[1].text?.includes("onclick")) {
    throw new Error("HTML block retained executable content.");
  }
  if (!result.blocks[2].ordered) throw new Error("The ordered-list setting was not retained.");
});

Deno.test("visual page blocks reject duplicate IDs, unsafe URLs, and invalid images", () => {
  const invalid = [
    [
      { id: "duplicate", type: "paragraph" },
      { id: "duplicate", type: "paragraph" },
    ],
    [{ id: "bad-link", type: "button", title: "Open", url: "javascript:alert(1)" }],
    [{ id: "missing-alt", type: "image", url: "/image.png", alt: "" }],
  ];
  for (const blocks of invalid) {
    if (!("error" in validatePageContentBlocks(blocks))) {
      throw new Error("An invalid block payload was accepted.");
    }
  }
});
