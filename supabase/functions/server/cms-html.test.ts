import {
  MAX_PAGE_CSS_LENGTH,
  MAX_PAGE_JS_LENGTH,
  htmlEditorEmbedsError,
  sanitizeCustomHtml,
  validateCustomCss,
  validateCustomJs,
} from "./cms-html.ts";
import {
  CUSTOM_HTML_CONTENT_CSP,
  CUSTOM_HTML_PUBLIC_PAGE_CSP,
  customHtmlDocument,
} from "../../../src/lib/custom-html-document.ts";

Deno.test("custom HTML keeps supported content and removes executable markup", () => {
  const sanitized = sanitizeCustomHtml(
    '<section class="intro"><h2>Welcome</h2><p onclick="steal()">Hello</p><script>steal()</script><iframe src="https://evil.example"></iframe><a href="javascript:steal()">link</a></section>',
  );

  if (!sanitized.includes("<h2>Welcome</h2>") || !sanitized.includes("Hello")) {
    throw new Error("Safe semantic page content was not preserved.");
  }
  if (/script|iframe|onclick|javascript:/i.test(sanitized)) {
    throw new Error("Executable HTML survived server sanitization.");
  }
});

Deno.test("custom HTML keeps same-page links and isolates external HTTPS links", () => {
  const sanitized = sanitizeCustomHtml(
    '<a href="/about" target="_blank" rel="opener">About</a><a href="https://example.com">Read more</a><a href="http://example.com">Insecure</a><a href="\\\\evil.example">Ambiguous</a>',
  );
  if (
    !sanitized.includes('<a href="/about" target="_blank" rel="opener">About</a>') ||
    !sanitized.includes('<a href="https://example.com">Read more</a>') ||
    sanitized.includes('href="http://example.com"') ||
    sanitized.includes('href="\\\\evil.example"')
  ) {
    throw new Error("Sanitized links do not preserve safe same-page and external navigation.");
  }
});

Deno.test("custom CSS rejects unsafe resources, executable legacy syntax, and style breakout", () => {
  for (const css of [
    '@import "http://evil.example/x.css";',
    '@import "//evil.example/x.css";',
    '@import "javascript:alert(1)";',
    ".hero { background: url(http://evil.example/pixel); }",
    ".hero { background: url(//evil.example/pixel); }",
    ".hero { background: url(javascript\\:alert(1)); }",
    ".hero { background: u/**/rl(javascript:alert(1)); }",
    ".hero { background: u\\72l(javascript:alert(1)); }",
    ".hero { width: \\65xpression(alert(1)); }",
    ".hero { \\62 ehavior: url(#default#VML); }",
    '.hero { background: image-set("javascript:alert(1)" 1x); }',
    ".hero { width: expression(alert(1)); }",
    ".hero { behavior: url(#default#VML); }",
    "</style><script>alert(1)</script>",
  ]) {
    if (!validateCustomCss(css)) {
      throw new Error(`Unsafe CSS was accepted: ${css}`);
    }
  }

  for (const css of [
    ".hero { color: #c83c78; padding: 2rem; }",
    '.hero { background-image: url("/assets/hero-image.webp"); }',
    ".hero { filter: url(#soft-shadow); }",
    '.hero::after { content: "Visit https://example.com"; }',
    '.hero { background-image: image-set("/assets/hero.webp" 1x, url(./hero@2x.webp) 2x); }',
    '@import "https://fonts.googleapis.com/css2?family=Inter";',
    '@im\\70ort url("https://fonts.googleapis.com/css2?family=Inter") screen;',
    ".hero { background-image: url(https://cdn.example.com/hero.webp); }",
    '.hero { background-image: image-set("https://cdn.example.com/hero.webp" 1x, url(./hero@2x.webp) 2x); }',
    ":root { --brand: #c83c78; --space: clamp(1rem, 2vw, 2rem); } .velori-about { min-height: 100vh; background: linear-gradient(135deg, #fff, #f3ecff); color: var(--brand); transition: transform 180ms ease; } @media (max-width: 768px) { .velori-about { padding: 20px; } } @supports (display: grid) { .velori-about { display: grid; } } @keyframes vaFloat { from { transform: translateY(0); } to { transform: translateY(-10px); } }",
  ]) {
    if (validateCustomCss(css)) {
      throw new Error(`Safe page styling was rejected: ${css}`);
    }
  }
});

Deno.test("custom CSS reports parser locations for malformed syntax", () => {
  const error = validateCustomCss(".hero {\n  color: red;\n");
  if (!error || !/at line \d+, column \d+/.test(error)) {
    throw new Error(`Malformed CSS did not report its parser location: ${error}`);
  }
});

Deno.test("custom HTML preview policy allows HTTPS resources without enabling scripts", () => {
  const document = customHtmlDocument(
    "<p>Preview</p>",
    '@import "https://fonts.example/font.css";',
  );
  for (const directive of [
    "style-src 'unsafe-inline' https:",
    "img-src 'self' https: data:",
    "font-src 'self' https:",
    "script-src 'none'",
    "connect-src 'none'",
  ]) {
    if (!CUSTOM_HTML_CONTENT_CSP.includes(directive) || !document.includes(directive)) {
      throw new Error(`Preview resource policy is missing ${directive}.`);
    }
  }
  if (!document.includes('name="referrer" content="no-referrer"')) {
    throw new Error("Custom HTML previews must not send a referrer to remote resources.");
  }
});

Deno.test("custom CSS accepts stylesheets up to the 50,000 character limit", () => {
  if (MAX_PAGE_CSS_LENGTH !== 50_000) {
    throw new Error(`Custom CSS limit should be 50,000 characters, found ${MAX_PAGE_CSS_LENGTH}.`);
  }
  const largeCss = `.hero { color: #c83c78; /* ${"padding ".repeat(4000)}*/ }`;
  if (largeCss.length < 25_000 || validateCustomCss(largeCss)) {
    throw new Error("A large but valid stylesheet was rejected.");
  }
  const oversizedCss = `${largeCss}${" ".repeat(MAX_PAGE_CSS_LENGTH)}`;
  const error = validateCustomCss(oversizedCss);
  if (!error || !error.includes("50,000 characters or fewer")) {
    throw new Error(`Oversized CSS was not rejected clearly: ${error}`);
  }
});

Deno.test("custom JavaScript accepts page scripts and rejects sandbox breakouts", () => {
  if (MAX_PAGE_JS_LENGTH !== 50_000) {
    throw new Error(
      `Custom JavaScript limit should be 50,000 characters, found ${MAX_PAGE_JS_LENGTH}.`,
    );
  }
  const safeScript = [
    "const heading = document.querySelector('h1');",
    "if (heading) heading.textContent = 'Welcome back';",
    "document.querySelectorAll('.cms-faq').forEach((item) => item.addEventListener('click', () => item.classList.toggle('is-open')));",
    "void fetch('/rest/v1/site_settings?select=site_name', { headers: { Accept: 'application/json' } });",
  ].join("\n");
  if (validateCustomJs(safeScript)) {
    throw new Error("Safe page JavaScript was rejected.");
  }
  if (validateCustomJs(`\tconst ready = true;\nconsole.log(ready);\r\n`)) {
    throw new Error("JavaScript with tabs and newlines was rejected.");
  }

  for (const script of [
    "document.querySelector('p').innerHTML = '</script><script>alert(1)</script>';",
    "const template = '</ScRiPt >';",
    "const padded = '< /script>';",
    "const bell = 'ring\u0007';",
    `const oversized = "${"x".repeat(MAX_PAGE_JS_LENGTH)}";`,
  ]) {
    if (!validateCustomJs(script)) {
      throw new Error(`Unsafe JavaScript was accepted: ${script.slice(0, 80)}`);
    }
  }
});

Deno.test("public page policy runs admin JavaScript while previews stay scriptless", () => {
  for (const directive of ["script-src 'unsafe-inline'", "connect-src 'self'"]) {
    if (!CUSTOM_HTML_PUBLIC_PAGE_CSP.includes(directive)) {
      throw new Error(`Public page policy is missing ${directive}.`);
    }
  }
  if (
    CUSTOM_HTML_PUBLIC_PAGE_CSP.includes("script-src 'none'") ||
    !CUSTOM_HTML_PUBLIC_PAGE_CSP.includes("default-src 'none'") ||
    !CUSTOM_HTML_CONTENT_CSP.includes("script-src 'none'")
  ) {
    throw new Error(
      "The public page must run inline scripts while preview documents stay scriptless.",
    );
  }
});

Deno.test("CMS HTML editor rejects wrappers and style/script blocks with guidance", () => {
  const plain = '<section class="hero"><h2 id="title">Welcome</h2><p>Hello</p></section>';
  if (htmlEditorEmbedsError(plain)) {
    throw new Error(`Plain body HTML was rejected: ${htmlEditorEmbedsError(plain)}`);
  }
  if (htmlEditorEmbedsError("<p>ok</p><!-- <style>.x{color:red}</style> -->")) {
    throw new Error("Commented-out style blocks should not block a save.");
  }

  const cases: [string, RegExp][] = [
    [
      "<!doctype html><html><head><title>x</title></head><body><p>y</p></body></html>",
      /body content only/,
    ],
    ["<p>Hi</p><style>.x{color:red}</style>", /Custom CSS field/],
    ["<p>Hi</p><script>run()</script>", /Custom JavaScript field/],
    ['<meta charset="utf-8"><p>Hi</p>', /body content only/],
    ['<div><link rel="stylesheet" href="https://x/y.css"></div>', /body content only/],
  ];
  for (const [html, expected] of cases) {
    const error = htmlEditorEmbedsError(html);
    if (!error || !expected.test(error)) {
      throw new Error(`Expected guidance for ${html.slice(0, 60)}, received: ${error}`);
    }
  }
});

Deno.test("custom HTML keeps framework class names instead of dropping them", () => {
  const sanitized = sanitizeCustomHtml(
    '<div class="lg:px-4 hero.title w-[100px] card-2 active">content</div>',
  );
  for (const token of ["lg:px-4", "hero.title", "w-[100px]", "card-2", "active"]) {
    if (!sanitized.includes(token)) {
      throw new Error(`Class token ${token} was dropped: ${sanitized}`);
    }
  }
  if (sanitizeCustomHtml('<div class="ok" onclick="steal()">x</div>').includes("onclick")) {
    throw new Error("Event handler attributes must still be stripped.");
  }
});
