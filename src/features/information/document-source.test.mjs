import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  buildDocumentationDocument,
  DOCUMENT_CSS,
  DOCUMENT_JS,
  resolveDocumentLink,
} from "./document-source.mjs";
import { informationPages, informationFooterLinks } from "./catalog.ts";
test("all documents have complete editable HTML CSS JS within CMS limits", () => {
  for (const kind of Object.keys(informationPages)) {
    const p = buildDocumentationDocument(kind, { contactEmail: "owner@example.com" });
    assert.equal(p.route, "/" + kind);
    assert.equal(p.content_mode, "custom_html");
    assert.ok(p.custom_html.includes("vdocs"));
    assert.ok(p.custom_html.length < 60000);
    assert.ok(p.custom_css.length < 30000);
    assert.ok(p.custom_js.length < 50000);
    assert.doesNotMatch(p.custom_html, /<script|<style|<html/i);
    assert.doesNotMatch(p.custom_html, /undefined|127\.0\.0\.1|Meta AI|Threads|Muse/);
    assert.ok(p.seo_description);
    new vm.Script(p.custom_js);
  }
});
test("directory drives footer blocks and mail actions use configured contact", () => {
  const p = buildDocumentationDocument("directory");
  assert.deepEqual(
    p.content_blocks.map((b) => [b.title, b.url]),
    informationFooterLinks,
  );
  assert.equal(resolveDocumentLink("@careers"), "/contact");
  assert.match(
    resolveDocumentLink("@careers", { contactEmail: "owner@example.com" }),
    /^mailto:owner@example.com\?subject=/,
  );
  const contact = buildDocumentationDocument("contact", { contactEmail: "<script>" });
  assert.doesNotMatch(contact.custom_html, /<script/);
});
test("document motion follows explicit levels and does not embed external trackers", () => {
  assert.match(DOCUMENT_CSS, /data-ui-motion="full"/);
  assert.match(DOCUMENT_CSS, /data-ui-activity="hidden"/);
  assert.match(DOCUMENT_CSS, /animation-play-state:paused/);
  assert.doesNotMatch(DOCUMENT_JS, /fetch\(|XMLHttpRequest|localStorage|document\.cookie/);
});
