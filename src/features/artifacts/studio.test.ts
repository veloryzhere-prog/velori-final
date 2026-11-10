import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { pageDocument, appDocument } from "./document.ts";
import {
  parseForgeProjectSetup,
  parsePages,
  importProject,
  readProjects,
  saveProject,
} from "./model.ts";
import { starters } from "./templates.ts";
import {
  clearForgeLandingDraft,
  consumeForgeLandingDraft,
  FORGE_LANDING_DRAFT_KEY,
  parseForgeLandingHandoff,
  readForgeLandingDraft,
  saveForgeLandingDraft,
} from "./forge-landing-state.ts";
test("preview preserves script-closing strings and restrictive CSP", () => {
  const p = {
    path: "index",
    html: "<main>Hello</main>",
    css: 'body:after{content:"</style><script>bad()</script>"}',
    js: 'document.body.dataset.sample="</script><script>other()</script>"',
  };
  const output = pageDocument(p, '<unsafe & "title">', "channel", ["index"], false);
  assert.match(output, /&lt;unsafe &amp; &quot;title&quot;&gt;/);
  assert.equal([...output.matchAll(/<script>/g)].length, 2);
  assert.match(output, /connect-src 'none'/);
  assert.match(output, /form-action 'none'/);
  assert.doesNotMatch(output, /https:\/\/|allow-same-origin/);
  const nodes: { textContent?: string }[] = [];
  const context = vm.createContext({
    document: {
      addEventListener() {},
      createElement: () => ({}),
      head: { append: (n: object) => nodes.push(n) },
      body: { append: (n: object) => nodes.push(n) },
    },
    addEventListener() {},
    parent: { postMessage() {} },
  });
  for (const match of output.matchAll(/<script>([\s\S]*?)<\/script>/g))
    vm.runInContext(match[1], context);
  assert.ok(nodes[0].textContent?.startsWith(p.css));
  assert.match(nodes[0].textContent!, /animation:none!important/);
  assert.equal(nodes[1].textContent, p.js);
});
test("complete offline export contains all pages and rejects foreign-window navigation", () => {
  const pages = starters[2].pages;
  const out = appDocument(pages, "Two pages");
  const frame = { srcdoc: "", contentWindow: {} };
  const location = { hash: "#about" };
  const handlers: Record<string, (e: unknown) => void> = {};
  const context = vm.createContext({
    document: { getElementById: () => frame },
    location,
    addEventListener: (name: string, cb: (e: unknown) => void) => {
      handlers[name] = cb;
    },
  });
  for (const match of out.matchAll(/<script>([\s\S]*?)<\/script>/g))
    vm.runInContext(match[1], context);
  assert.ok(frame.srcdoc.includes("about page"));
  const data = {
    source: "velori-artifact",
    channel: "velori-export-v2",
    kind: "navigate",
    message: "index",
  };
  handlers.message({ source: {}, origin: "null", data });
  assert.equal(location.hash, "#about");
  handlers.message({ source: frame.contentWindow, origin: "null", data });
  assert.equal(location.hash, "index");
});
test("JSON import preserves pages/history but never imports project identity", () => {
  const history = [
    { id: "turn", prompt: "Add about", result: "Applied", createdAt: new Date().toISOString() },
  ];
  const p = importProject(
    JSON.stringify({ id: "chosen-id", title: "App", pages: starters[2].pages, history }),
  );
  assert.notEqual(p.id, "chosen-id");
  assert.equal(p.pages.length, 2);
  assert.deepEqual(p.history, history);
  assert.throws(() => importProject('{"pages":[]}'));
});
test("storage corruption, write failure and capacity never silently evict a draft", () => {
  assert.deepEqual(readProjects({ getItem: () => "corrupt" }, "key"), []);
  const p = importProject(JSON.stringify({ title: "App", pages: starters[0].pages }));
  assert.throws(
    () =>
      saveProject(
        {
          getItem: () => "[]",
          setItem() {
            throw new Error("Quota exceeded");
          },
        },
        "key",
        p,
      ),
    /Quota exceeded/,
  );
  const rows = Array.from({ length: 12 }, (_, i) => ({ ...p, id: `project-${i}` }));
  assert.throws(
    () =>
      saveProject(
        {
          getItem: () => JSON.stringify(rows),
          setItem() {
            assert.fail("must not evict");
          },
        },
        "key",
        p,
      ),
    /library is full/,
  );
});
test("all starters are valid self-contained code with compilable JavaScript", () => {
  for (const s of starters) {
    assert.doesNotThrow(() => parsePages(s.pages));
    for (const p of s.pages) {
      assert.doesNotThrow(() => new vm.Script(p.js));
      assert.doesNotMatch(
        pageDocument(
          p,
          s.title,
          "run",
          s.pages.map((p) => p.path),
        ),
        /<script[^>]+src=/,
      );
    }
  }
});

test("project identifiers work without the secure-context randomUUID API", async () => {
  const { studioId } = await import("./identity.ts");
  const source = { getRandomValues: crypto.getRandomValues.bind(crypto) };
  const a = studioId(source);
  const b = studioId(source);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
  assert.throws(() => importProject("null"), /valid project JSON/);
});

test("landing prompt draft survives auth handoff once and never stores credentials", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  saveForgeLandingDraft(storage, { prompt: "  Build a bookshop  ", mode: "ask" }, 1000);
  assert.deepEqual(consumeForgeLandingDraft(storage, 2000), {
    prompt: "Build a bookshop",
    mode: "ask",
    createdAt: 1000,
  });
  assert.equal(consumeForgeLandingDraft(storage, 2000), null);
  assert.equal(values.has(FORGE_LANDING_DRAFT_KEY), false);
  assert.throws(() => saveForgeLandingDraft(storage, { prompt: "  ", mode: "build" }), /Describe/);
  assert.throws(
    () => saveForgeLandingDraft(storage, { prompt: "x".repeat(4001), mode: "build" }),
    /4,000/,
  );
});

test("landing prompt draft rejects malformed, expired, future and credential-shaped state", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  values.set(FORGE_LANDING_DRAFT_KEY, "{");
  assert.equal(consumeForgeLandingDraft(storage, 1000), null);
  values.set(
    FORGE_LANDING_DRAFT_KEY,
    JSON.stringify({ version: 1, prompt: "Build", mode: "build", createdAt: -2_000_000 }),
  );
  assert.equal(consumeForgeLandingDraft(storage, 1000), null);
  values.set(
    FORGE_LANDING_DRAFT_KEY,
    JSON.stringify({ version: 1, prompt: "Build", mode: "build", createdAt: 1001 }),
  );
  assert.equal(consumeForgeLandingDraft(storage, 1000), null);
  values.set(
    FORGE_LANDING_DRAFT_KEY,
    JSON.stringify({
      version: 1,
      prompt: "Build",
      mode: "build",
      createdAt: 1000,
      accessToken: "not-copied",
    }),
  );
  assert.deepEqual(consumeForgeLandingDraft(storage, 1000), {
    prompt: "Build",
    mode: "build",
    createdAt: 1000,
  });
});

test("landing draft can be retried after a project-save failure", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  saveForgeLandingDraft(storage, { prompt: "Build a museum", mode: "build" }, 1000);
  assert.equal(readForgeLandingDraft(storage, 2000)?.prompt, "Build a museum");
  assert.equal(values.has(FORGE_LANDING_DRAFT_KEY), true);
  clearForgeLandingDraft(storage);
  assert.equal(readForgeLandingDraft(storage, 2000), null);
});

test("landing route handoff accepts only a bounded prompt and a known mode", () => {
  assert.deepEqual(parseForgeLandingHandoff({ prompt: "  Build a bookshop  ", mode: "build" }), {
    prompt: "Build a bookshop",
    mode: "build",
  });
  assert.equal(parseForgeLandingHandoff({ prompt: "x".repeat(4001), mode: "build" }), null);
  assert.equal(parseForgeLandingHandoff({ prompt: "Build", mode: "invalid" }), null);
});

test("project setup manifest accepts supported capabilities and rejects invalid settings", () => {
  const setup = {
    version: 1,
    description: "A local project",
    category: "Website",
    platform: "website",
    framework: "static-html",
    theme: "system",
    design: "Aurora Glass",
    color: "#8b6be6",
    animation: "subtle",
    responsive: "mobile-first",
    aiProvider: "gemini",
    defaultMode: "build",
    storage: "local",
    autosave: true,
    backupReminder: true,
    initialPrompt: "Build an accessible site",
  };
  assert.deepEqual(parseForgeProjectSetup(setup), setup);
  assert.throws(() => parseForgeProjectSetup({ ...setup, framework: "nextjs" }), /unsupported/);
  assert.throws(() => parseForgeProjectSetup({ ...setup, color: "red" }), /unsupported/);
});
