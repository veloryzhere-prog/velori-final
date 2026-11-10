import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSourceFiles,
  reactStarterFiles,
  safeSourcePath,
  pythonApiStarterFiles,
} from "./multi-file.ts";
import { normalizeProject, parseGenerated } from "./model.ts";
import { sourceZip } from "./document.ts";
import { converse, generate } from "../../../supabase/functions/velori-studio/policy.ts";
const page = { path: "index", html: "<h1>Ready</h1>", css: "", js: "" };
test("React starter contains real Vite/React entrypoints, TypeScript files and runnable scripts", () => {
  const files = reactStarterFiles("FORGE React");
  const paths = files.map((x) => x.path);
  assert.ok(
    [
      "package.json",
      "index.html",
      "src/main.tsx",
      "src/App.tsx",
      "src/style.css",
      "vite.config.ts",
      "tsconfig.json",
    ].every((p) => paths.includes(p)),
  );
  const pkg = JSON.parse(files.find((f) => f.path === "package.json")!.content);
  assert.equal(pkg.scripts.build, "vite build");
  assert.equal(pkg.scripts.dev, "vite --host 127.0.0.1");
  assert.ok(pkg.dependencies.react);
});
test("source paths reject traversal, secrets, duplicates and oversized files", () => {
  for (const p of [
    "../.env",
    "/etc/passwd",
    "src/../foo",
    "src/.env.local",
    "id_rsa",
    "secret.txt",
    "foo\\bar",
  ])
    assert.equal(safeSourcePath(p), false, p);
  assert.throws(() =>
    parseSourceFiles([
      { path: "src/App.tsx", content: "a" },
      { path: "src/app.tsx", content: "b" },
    ]),
  );
  assert.throws(() => parseSourceFiles([{ path: "src/big.ts", content: "x".repeat(500001) }]));
  assert.equal(parseSourceFiles([{ path: "src/App.tsx", content: "const x = <div/>" }]).length, 1);
});
test("local normalized project and generated response preserve user source", () => {
  const files = reactStarterFiles("Local");
  const p = normalizeProject({
    id: "local-id",
    title: "Local",
    updatedAt: new Date().toISOString(),
    pages: [page],
    files,
    stack: "react",
    history: [],
  });
  assert.equal(p.stack, "react");
  assert.equal(p.files?.length, 7);
  const response = parseGenerated({ title: "App", pages: [page], files, stack: "react" });
  assert.equal(response.files?.length, 7);
});
test("React source ZIP contains files at archive root plus separate static preview", async () => {
  const data = sourceZip({
    id: "test",
    title: "React",
    pages: [page],
    files: reactStarterFiles("React"),
    stack: "react",
    history: [],
    updatedAt: "2026-10-27T00:00:00Z",
  });
  const buf = new Uint8Array(await data.arrayBuffer());
  const ascii = new TextDecoder().decode(buf);
  assert.ok(ascii.includes("src/App.tsx"));
  assert.ok(ascii.includes("velori-static-preview/index.html"));
  assert.ok(ascii.includes("package.json"));
});
test("conversational provider returns genuine response and follow-up prompts", async () => {
  let request = "";
  const result = await converse(
    "secure-server-key",
    "gemini-test",
    "Explain React",
    "Local",
    [],
    new AbortController().signal,
    async (_url, init) => {
      request = String(init?.body);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      reply: "React builds interfaces using components.",
                      followUps: ["Show a component example"],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      );
    },
    "src/App.tsx contains a greeting component",
  );
  assert.equal(result.reply, "React builds interfaces using components.");
  assert.deepEqual(result.followUps, ["Show a component example"]);
  assert.ok(request.includes("Explain React"));
  assert.ok(request.includes("src/App.tsx contains a greeting component"));
  assert.ok(!request.includes("secure-server-key"));
});
test("multi-file provider schema transports the source files", async () => {
  let request = "";
  const files = reactStarterFiles("Test");
  const result = await generate(
    "key",
    "gemini-test",
    "Build React",
    [page],
    new AbortController().signal,
    undefined,
    [],
    async (_url, init) => {
      request = String(init?.body);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  { text: JSON.stringify({ title: "Test", pages: [page], stack: "react", files }) },
                ],
              },
            },
          ],
        }),
      );
    },
    files,
    "react",
  );
  assert.equal(result.files?.length, 7);
  assert.ok(request.includes("currentFiles"));
});

test("Python API starter exports implementation files with test and dependency manifest", () => {
  const files = pythonApiStarterFiles("VELORI API");
  assert.deepEqual(
    files.map((f) => f.path),
    ["main.py", "requirements.txt", "tests/test_api.py", "README.md"],
  );
  assert.match(files[0].content, /FastAPI/);
  assert.match(files[2].content, /TestClient/);
  assert.match(files[3].content, /does \*\*not\*\* execute/);
});
