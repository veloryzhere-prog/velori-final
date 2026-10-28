// Guards administrator-uploaded SVG error illustrations before they enter the
// public `site-assets` bucket. The public shell renders illustrations through
// <img>, which never executes scripts; this check is the second layer and
// rejects anything that could carry active content even if a renderer changed.
// Kept as plain ESM so both the Deno Edge Function and `node --test` run it.

/** SVG illustrations are small by nature; 512 KB is generous for a vector. */
export const MAX_SVG_ILLUSTRATION_BYTES = 512 * 1024;

/** Patterns that must never reach the bucket, with the label used in the
 * operator-facing rejection message. */
const ACTIVE_CONTENT_PATTERNS = [
  [/<script[\s>]/i, "script"],
  [/<foreignObject[\s>]/i, "foreignObject"],
  [/<iframe[\s>]/i, "iframe"],
  [/<embed[\s>]/i, "embed"],
  [/<object[\s>]/i, "object"],
  [/<!ENTITY/i, "entity declaration"],
  [/<\?xml-stylesheet/i, "stylesheet"],
  [/\son[a-z]+\s*=/i, "event-handler"],
  [/javascript\s*:/i, "JavaScript URI"],
  [/data:text\/html/i, "data URI"],
];

/** Decode bytes as strict UTF-8 with the BOM stripped, or return null when the
 * content is not valid UTF-8 text (a declared SVG that is really binary). */
export function decodeSvgText(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, "");
  } catch {
    return null;
  }
}

/** Return null when the text is a safe SVG illustration, otherwise the
 * operator-facing reason it was rejected. */
export function inspectSvgIllustration(text) {
  if (typeof text !== "string" || !/<svg[\s>]/i.test(text)) {
    return "The file contents are not SVG.";
  }
  for (const [pattern, label] of ACTIVE_CONTENT_PATTERNS) {
    if (pattern.test(text)) {
      return `SVG files may not contain ${label} content.`;
    }
  }
  return null;
}
