import sanitizeHtml from "sanitize-html";
import postcss from "postcss";

export const MAX_PAGE_HTML_LENGTH = 60_000;
export const MAX_PAGE_CSS_LENGTH = 50_000;
export const MAX_PAGE_JS_LENGTH = 50_000;

const ALLOWED_TAGS = [
  "a",
  "abbr",
  "address",
  "article",
  "aside",
  "audio",
  "b",
  "bdi",
  "bdo",
  "blockquote",
  "br",
  "button",
  "canvas",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "div",
  "dl",
  "dt",
  "em",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "i",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "main",
  "map",
  "mark",
  "menu",
  "menuitem",
  "meter",
  "nav",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "section",
  "select",
  "small",
  "source",
  "span",
  "strike",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "track",
  "u",
  "ul",
  "var",
  "video",
  "wbr",
];

function hasControlCharacters(value: string) {
  return [...value].some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint < 0x20 || codePoint === 0x7f;
  });
}

/**
 * Reject style/script/document wrappers in the CMS HTML editor instead of
 * letting the sanitizer silently drop them, so authors move the content to the
 * CSS and JavaScript fields where it is validated and kept. Used by the CMS
 * page save and publish flow; announcements keep strip-only behavior.
 */
export function htmlEditorEmbedsError(value: string): string | null {
  const source = value.replace(/<!--[\s\S]*?-->/g, "");
  if (/<!doctype|<\s*(?:html|head|body|meta|link|base|title)\b/i.test(source)) {
    return "Custom HTML must be page body content only. Remove the full-document wrapper (<html>, <head>, <body>, <title>, <meta>, <link>); keep styles in the Custom CSS field and scripts in the Custom JavaScript field.";
  }
  if (/<\s*style\b/i.test(source)) {
    return "Custom HTML cannot include <style> blocks. Enter page styles in the Custom CSS field so they are validated and saved with the page.";
  }
  if (/<\s*script\b/i.test(source)) {
    return "Custom HTML cannot include <script> blocks. Enter page JavaScript in the Custom JavaScript field so it is saved with the page.";
  }
  return null;
}

export function sanitizeCustomHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": [
        "class",
        "id",
        "style",
        "title",
        "tabindex",
        "hidden",
        "dir",
        "lang",
        "translate",
        "contenteditable",
        "spellcheck",
        "draggable",
      ],
      a: ["href", "target", "rel", "title", "download", "ping"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
      video: [
        "src",
        "poster",
        "width",
        "height",
        "controls",
        "autoplay",
        "loop",
        "muted",
        "preload",
        "playsinline",
      ],
      audio: ["src", "controls", "autoplay", "loop", "muted", "preload"],
      canvas: ["width", "height"],
      button: [
        "type",
        "name",
        "value",
        "disabled",
        "autofocus",
        "form",
        "formaction",
        "formenctype",
        "formmethod",
        "formnovalidate",
        "formtarget",
      ],
      input: [
        "type",
        "name",
        "value",
        "disabled",
        "checked",
        "readonly",
        "required",
        "placeholder",
        "min",
        "max",
        "step",
        "minlength",
        "maxlength",
        "autocomplete",
        "list",
        "multiple",
        "accept",
        "capture",
        "src",
        "alt",
        "height",
        "width",
        "form",
        "formaction",
        "formenctype",
        "formmethod",
        "formnovalidate",
        "formtarget",
        "pattern",
      ],
      select: ["name", "value", "disabled", "required", "multiple", "size", "autocomplete", "form"],
      textarea: [
        "name",
        "value",
        "disabled",
        "readonly",
        "required",
        "placeholder",
        "minlength",
        "maxlength",
        "autocomplete",
        "form",
        "wrap",
        "rows",
        "cols",
      ],
      form: ["action", "method", "enctype", "target", "name", "novalidate", "autocomplete"],
      fieldset: ["disabled", "form", "name"],
      legend: ["name"],
      option: ["value", "selected", "disabled", "label"],
      optgroup: ["disabled", "label"],
      datalist: ["id"],
      output: ["for", "form", "name"],
      progress: ["value", "max"],
      meter: ["value", "min", "max", "low", "high", "optimum"],
      details: ["open"],
      summary: [],
      dialog: ["open", "modal"],
      source: ["src", "srcset", "type", "media", "sizes", "width", "height"],
      track: ["kind", "src", "srclang", "label", "default"],
      map: ["name"],
      area: ["shape", "coords", "href", "target", "download", "rel", "ping"],
      picture: [],
      tbody: [],
      thead: [],
      tfoot: [],
      tr: [],
      td: ["colspan", "rowspan", "headers", "scope"],
      th: ["colspan", "rowspan", "headers", "scope", "scope"],
      col: ["span", "width"],
      colgroup: ["span"],
      ol: ["start", "reversed", "type"],
      ul: ["type"],
      li: ["value"],
      hr: [],
      br: [],
      wbr: [],
      sub: [],
      sup: [],
      small: [],
      mark: [],
      del: ["datetime"],
      ins: ["datetime"],
      time: ["datetime"],
      data: ["value"],
      menu: ["type", "label"],
      menuitem: [
        "type",
        "label",
        "icon",
        "onclick",
        "command",
        "radiogroup",
        "default",
        "disabled",
        "checked",
      ],
      figure: [],
      figcaption: [],
      main: [],
      header: [],
      footer: [],
      nav: [],
      section: [],
      article: [],
      aside: [],
      address: [],
      b: [],
      i: [],
      u: [],
      s: [],
      strike: [],
      strong: [],
      em: [],
      code: [],
      pre: [],
      blockquote: ["cite"],
      q: ["cite"],
      kbd: [],
      samp: [],
      var: [],
      dfn: [],
      abbr: ["title"],
      bdi: [],
      bdo: ["dir"],
      ruby: [],
      rp: [],
      rt: [],
      rtc: [],
      caption: [],
    },
    allowedClasses: {
      // Class tokens are inert. Keep framework variants (lg:px-4, hero.title,
      // w-[100px]) instead of silently dropping them and breaking page CSS.
      "*": [/^[a-zA-Z0-9_.:!()\[\]-]{1,128}$/],
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["https", "http", "data", "blob"],
      video: ["https", "http", "data", "blob"],
      audio: ["https", "http", "data", "blob"],
      source: ["https", "http", "data", "blob"],
      track: ["https", "http", "data", "blob"],
      a: ["https", "mailto", "tel"],
    },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName: string, attributes: Record<string, string>) => {
        const href = attributes.href?.trim() ?? "";
        if (href.includes("\\") || hasControlCharacters(href)) {
          delete attributes.href;
        } else if (!/^(?:https:|http:|mailto:|tel:)/i.test(href)) {
          try {
            if (
              new URL(href, "https://cms.invalid/").origin !== "https://cms.invalid" &&
              !href.startsWith("/")
            ) {
              delete attributes.href;
            }
          } catch {
            delete attributes.href;
          }
        }
        return { tagName: "a", attribs: attributes };
      },
    },
  });
}

function stripCssComments(value: string) {
  let result = "";
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      result += character;
      if (character === "\\") {
        result += value[index + 1] ?? "";
        index += 1;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      result += character;
      continue;
    }
    if (character === "/" && value[index + 1] === "*") {
      const close = value.indexOf("*/", index + 2);
      if (close === -1) return result;
      index = close + 1;
      continue;
    }
    result += character;
  }
  return result;
}

function decodeCssEscapes(value: string) {
  return value.replace(
    /\\(?:([\da-f]{1,6})(?:\r\n|[\t\n\r\f ])?|(\r\n|[\n\r\f])|([\s\S]))/gi,
    (_match, hex: string | undefined, newline: string | undefined, escaped: string | undefined) => {
      if (newline) return "";
      if (hex) {
        const codePoint = Number.parseInt(hex, 16);
        return codePoint === 0 ||
          codePoint > 0x10ffff ||
          (codePoint >= 0xd800 && codePoint <= 0xdfff)
          ? "\ufffd"
          : String.fromCodePoint(codePoint);
      }
      return escaped ?? "";
    },
  );
}

function isCssNameCharacter(character: string | undefined) {
  return Boolean(character && /[-_a-z\d]/i.test(character));
}

function skipCssEscape(value: string, start: number) {
  let index = start + 1;
  if (index >= value.length) return index;
  if (/[\da-f]/i.test(value[index])) {
    let digits = 0;
    while (index < value.length && digits < 6 && /[\da-f]/i.test(value[index])) {
      index += 1;
      digits += 1;
    }
    if (value[index] === "\r" && value[index + 1] === "\n") return index + 2;
    if (/[\t\n\r\f ]/.test(value[index] ?? "")) return index + 1;
    return index;
  }
  if (value[index] === "\r" && value[index + 1] === "\n") return index + 2;
  return index + 1;
}

function readCssString(value: string, start: number) {
  const quote = value[start];
  if (quote !== '"' && quote !== "'") return null;
  let index = start + 1;
  while (index < value.length) {
    if (value[index] === "\\") {
      index = skipCssEscape(value, index);
      continue;
    }
    if (value[index] === quote) {
      return {
        value: decodeCssEscapes(value.slice(start + 1, index)),
        end: index + 1,
      };
    }
    index += 1;
  }
  return null;
}

type CssFunction = { name: string; contents: string };

function findCssFunctions(value: string): CssFunction[] {
  const functions: CssFunction[] = [];
  const stack: Array<{ name: string; contentStart: number }> = [];
  for (let index = 0; index < value.length;) {
    const character = value[index];
    if (character === '"' || character === "'") {
      index = readCssString(value, index)?.end ?? value.length;
      continue;
    }
    if (isCssNameCharacter(character) || character === "\\") {
      const start = index;
      while (index < value.length) {
        if (isCssNameCharacter(value[index])) index += 1;
        else if (value[index] === "\\") index = skipCssEscape(value, index);
        else break;
      }
      if (value[index] === "(") {
        stack.push({
          name: decodeCssEscapes(value.slice(start, index)).toLowerCase(),
          contentStart: index + 1,
        });
        index += 1;
      }
      continue;
    }
    if (character === "(") {
      stack.push({ name: "", contentStart: index + 1 });
    } else if (character === ")") {
      const open = stack.pop();
      if (open?.name) {
        functions.push({
          name: open.name,
          contents: value.slice(open.contentStart, index),
        });
      }
    }
    index += 1;
  }
  return functions;
}

function imageSetStrings(value: string) {
  let quote = "";
  let depth = 0;
  let itemStart = 0;
  const items: string[] = [];
  for (let index = 0; index <= value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === "\\") index = skipCssEscape(value, index) - 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if ((character === "," && depth === 0) || index === value.length) {
      items.push(value.slice(itemStart, index).trim());
      itemStart = index + 1;
    }
  }
  return items.flatMap((item) => {
    if (item[0] !== '"' && item[0] !== "'") return [];
    const string = readCssString(item, 0);
    return string ? [string.value] : [];
  });
}

function safeCssResourceUrl(rawUrl: string) {
  const url = decodeCssEscapes(stripCssComments(rawUrl)).trim();
  if (!url || hasControlCharacters(url) || url.includes("\\")) return false;
  if (url.startsWith("#")) return true;
  if (/^data:/i.test(url)) {
    return /^data:image\/(?:png|gif|jpe?g|webp|avif);base64,[a-z\d+/]+=*$/i.test(url);
  }
  if (/^https:/i.test(url)) {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === "https:" &&
        Boolean(parsed.hostname) &&
        !parsed.username &&
        !parsed.password
      );
    } catch {
      return false;
    }
  }
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) return false;
  try {
    return new URL(url, "https://cms.invalid/").origin === "https://cms.invalid";
  } catch {
    return false;
  }
}

function cssUrlArgument(rawValue: string) {
  const value = rawValue.trim();
  if (value.startsWith('"') || value.startsWith("'")) {
    const string = readCssString(value, 0);
    return string && !value.slice(string.end).trim() ? string.value : null;
  }
  if (/["']/.test(value)) return null;
  return decodeCssEscapes(value);
}

export function validateCustomCss(value: string): string | null {
  if (value.length > MAX_PAGE_CSS_LENGTH) {
    return `Custom CSS must be ${MAX_PAGE_CSS_LENGTH.toLocaleString()} characters or fewer.`;
  }
  if (
    /<\s*(?:style|script|svg|iframe|object|embed|math|foreignObject)\b|<\s*\/\s*(?:style|script|svg|iframe|object|embed|math|foreignObject)\b/i.test(
      value,
    )
  ) {
    return "Custom CSS must be plain CSS source only; do not include HTML or script tags.";
  }
  let root: ReturnType<typeof postcss.parse>;
  try {
    root = postcss.parse(value);
  } catch (cause) {
    if (!(cause instanceof Error)) return "Custom CSS could not be parsed.";
    const parseError = cause as Error & {
      line?: number;
      column?: number;
      reason?: string;
    };
    const location =
      typeof parseError.line === "number" && typeof parseError.column === "number"
        ? ` at line ${parseError.line}, column ${parseError.column}`
        : "";
    return `Custom CSS syntax error${location}: ${parseError.reason ?? parseError.message}`;
  }

  const invalidResource =
    "Use HTTPS or local asset URLs in CSS resources; HTTP, protocol-relative, and executable schemes are blocked.";
  const invalidConstruct =
    "Custom CSS cannot use expression(), behavior, -moz-binding, javascript:, or vbscript:.";

  let validationError: string | null = null;
  root.walk((node) => {
    if (validationError) return;

    if (node.type === "atrule" && decodeCssEscapes(node.name).toLowerCase() === "import") {
      const params = stripCssComments(node.params).trim();
      const urlFunction = findCssFunctions(params).find((fn) => fn.name === "url");
      const importedString =
        params.startsWith('"') || params.startsWith("'") ? readCssString(params, 0)?.value : null;
      if (
        !(urlFunction && safeCssResourceUrl(cssUrlArgument(urlFunction.contents) ?? "")) &&
        !(importedString && safeCssResourceUrl(importedString))
      ) {
        validationError = invalidResource;
        return;
      }
    }

    if (node.type !== "decl" && node.type !== "atrule") return;
    const property = node.type === "decl" ? decodeCssEscapes(node.prop).toLowerCase() : "";
    if (property === "behavior" || property === "-moz-binding") {
      validationError = invalidConstruct;
      return;
    }

    const source = stripCssComments(node.type === "decl" ? node.value : node.params);
    const functions = findCssFunctions(source);
    if (functions.some((fn) => fn.name === "expression")) {
      validationError = invalidConstruct;
      return;
    }
    const code = decodeCssEscapes(source).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, " ");
    if (/(?:javascript|vbscript)\s*:/i.test(code)) {
      validationError = invalidConstruct;
      return;
    }
    for (const fn of functions) {
      if (fn.name === "url" && !safeCssResourceUrl(cssUrlArgument(fn.contents) ?? "")) {
        validationError = invalidResource;
        return;
      }
      if (
        (fn.name === "image-set" || fn.name === "-webkit-image-set") &&
        imageSetStrings(fn.contents).some((url) => !safeCssResourceUrl(url))
      ) {
        validationError = invalidResource;
        return;
      }
    }
  });
  if (validationError) return validationError;
  return null;
}

export function validateCustomJs(value: string): string | null {
  if (value.length > MAX_PAGE_JS_LENGTH) {
    return `Custom JavaScript must be ${MAX_PAGE_JS_LENGTH.toLocaleString()} characters or fewer.`;
  }
  if (/<\s*\/\s*script/i.test(value)) {
    return "Custom JavaScript must not include a closing script tag; it would break out of the page sandbox document.";
  }
  if (
    [...value].some((character) => {
      const codePoint = character.charCodeAt(0);
      return (
        (codePoint < 0x20 && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d) ||
        codePoint === 0x7f
      );
    })
  ) {
    return "Custom JavaScript must not include control characters.";
  }
  return null;
}
