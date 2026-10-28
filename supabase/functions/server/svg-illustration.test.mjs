import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SVG_ILLUSTRATION_BYTES,
  decodeSvgText,
  inspectSvgIllustration,
} from "./svg-illustration.mjs";

const svg = (inner = "<circle cx='4' cy='4' r='3' fill='#7c5cff'/>") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">${inner}</svg>`;

test("the size ceiling stays at 512 KB", () => {
  assert.equal(MAX_SVG_ILLUSTRATION_BYTES, 512 * 1024);
});

test("a plain illustration passes", () => {
  assert.equal(inspectSvgIllustration(svg()), null);
});

test("an XML declaration and BOM still validate", () => {
  const bytes = new TextEncoder().encode(`\uFEFF<?xml version="1.0"?>${svg()}`);
  const text = decodeSvgText(bytes);
  assert.equal(text !== null && text.startsWith("<?xml"), true);
  assert.equal(text === null ? "decode failed" : inspectSvgIllustration(text), null);
});

test("binary content that claims to be SVG is rejected at decode", () => {
  assert.equal(decodeSvgText(new Uint8Array([0xff, 0xfe, 0x00, 0x83])), null);
});

test("content without an svg root is rejected", () => {
  assert.match(inspectSvgIllustration("<html><body>hi</body></html>") ?? "", /not SVG/);
});

test("a script element is rejected", () => {
  assert.match(inspectSvgIllustration(svg("<script>alert(1)</script>")) ?? "", /script/);
});

test("an inline event handler is rejected", () => {
  assert.match(
    inspectSvgIllustration(svg("<rect onload='alert(1)' width='1' height='1'/>")) ?? "",
    /event-handler/,
  );
});

test("an external entity declaration is rejected", () => {
  assert.match(
    inspectSvgIllustration(`<!DOCTYPE svg [<!ENTITY x "y">]>${svg()}`) ?? "",
    /entity declaration/,
  );
});

test("a javascript URI is rejected", () => {
  assert.match(
    inspectSvgIllustration(svg("<a href='javascript:alert(1)'>x</a>")) ?? "",
    /JavaScript URI/,
  );
});

test("foreignObject embedding is rejected", () => {
  assert.match(
    inspectSvgIllustration(svg("<foreignObject><div>x</div></foreignObject>")) ?? "",
    /foreignObject/,
  );
});

test("an xml stylesheet processing instruction is rejected", () => {
  assert.match(
    inspectSvgIllustration(`<?xml-stylesheet type="text/xsl" href="evil.xsl"?>${svg()}`) ?? "",
    /stylesheet/,
  );
});
