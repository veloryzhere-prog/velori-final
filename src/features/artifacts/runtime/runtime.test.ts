/* Copyright © 2026 VELORYZ. */
import test from "node:test";
import assert from "node:assert/strict";
import { projectPlan, runtimePreflight, applyRevision, fileChanges } from "./policy.ts";
import { localEndpoint, localConversation } from "./local-provider.ts";
import { repairBuild } from "./repair.ts";
const files = (pkg: unknown, extra: { path: string; content: string }[] = []) => [
  { path: "package.json", content: JSON.stringify(pkg) },
  ...extra,
];
const pkg = { scripts: { dev: "vite", build: "vite build" }, dependencies: { react: "^19.0.0" } };
test("package policy respects lockfiles and refuses ambiguous managers", () => {
  assert.deepEqual(
    projectPlan(files(pkg, [{ path: "package-lock.json", content: "{}" }])).install.args,
    ["ci", "--ignore-scripts", "--no-audit", "--no-fund"],
  );
  assert.equal(
    projectPlan(
      files({ ...pkg, packageManager: "pnpm@10.0.0" }, [{ path: "pnpm-lock.yaml", content: "" }]),
    ).manager,
    "pnpm",
  );
  assert.throws(() =>
    projectPlan(
      files(pkg, [
        { path: "yarn.lock", content: "" },
        { path: "pnpm-lock.yaml", content: "" },
      ]),
    ),
  );
  assert.throws(() => projectPlan(files({ ...pkg, packageManager: "yarn@4.0.0" })));
  assert.throws(() =>
    projectPlan(
      files({ ...pkg, packageManager: "npm@10.0.0" }, [{ path: "pnpm-lock.yaml", content: "" }]),
    ),
  );
});
test("install policy refuses remote URLs, local deps, manifest extensions and malformed data", () => {
  for (const value of [
    "file:/etc/passwd",
    "git+https://example.com/a",
    "https://evil.test/pkg.tgz",
    "npm:evil@1",
  ])
    assert.throws(() => projectPlan(files({ ...pkg, dependencies: { pkg: value } })));
  assert.throws(() => projectPlan(files({ ...pkg, overrides: { react: "file:/etc" } })));
  assert.throws(() => projectPlan([{ path: "package.json", content: "invalid" }]));
  assert.throws(() => projectPlan(files({ ...pkg, dependencies: [] })));
});
test("preflight fails closed for missing license, isolation and shared memory", () => {
  assert.equal(
    runtimePreflight({ secure: false, isolated: false, sharedMemory: false, licensed: false })
      .length,
    4,
  );
  assert.deepEqual(
    runtimePreflight({ secure: true, isolated: true, sharedMemory: true, licensed: true }),
    [],
  );
});
test("revisions reject conflicting writes, deletions and locked file edits", () => {
  const a = [{ path: "a.ts", content: "a" }],
    b = [{ path: "a.ts", content: "b" }];
  assert.equal(fileChanges(a, b).length, 1);
  assert.throws(() => applyRevision(b, a, b));
  assert.throws(() => applyRevision(a, a, []));
  assert.throws(() => applyRevision(a, a, b, false, ["a.ts"]));
  assert.deepEqual(applyRevision(a, a, b), b);
});
test("local endpoints reject non-loopback, credentials and redirects via URL config", () => {
  for (const url of [
    "https://example.com",
    "http://127.0.0.1.evil.test:11434",
    "http://user@localhost:1234",
    "http://localhost:1234/api",
    "http://localhost:1234/?x=1",
    "file:///tmp",
  ])
    assert.throws(() => localEndpoint(url));
  assert.equal(localEndpoint("http://127.0.0.1:11434"), "http://127.0.0.1:11434");
});
test("bounded repair runs actual adapter results, verifies repair and restores on repeated errors", async () => {
  let count = 0;
  const original = [{ path: "index.js", content: "bad" }];
  const events: string[] = [];
  const result = await repairBuild({
    files: original,
    attempts: 2,
    signal: new AbortController().signal,
    build: async () => ({
      exitCode: count++ ? 0 : 1,
      output: count === 1 ? "Syntax error" : "built",
    }),
    propose: async () => [{ path: "index.js", content: "fixed" }],
    approve: async () => true,
    event: (m) => events.push(m),
  });
  assert.equal(result.repaired, true);
  assert.equal(count, 2);
  assert.equal(events.at(-1), "Build succeeded.");
  const failed = await repairBuild({
    files: original,
    attempts: 3,
    signal: new AbortController().signal,
    build: async () => ({ exitCode: 1, output: "same error" }),
    propose: async () => [{ path: "index.js", content: "other" }],
    approve: async () => true,
    event: () => {},
  });
  assert.deepEqual(failed.files, original);
});
test("repair cancellation and attempt limits are enforced", async () => {
  const controller = new AbortController();
  controller.abort();
  const config = {
    files: [],
    attempts: 1,
    signal: controller.signal,
    build: async () => ({ exitCode: 0, output: "" }),
    propose: async () => [],
    approve: async () => true,
    event: () => {},
  };
  await assert.rejects(() => repairBuild(config));
  await assert.rejects(() =>
    repairBuild({ ...config, attempts: 10, signal: new AbortController().signal }),
  );
});
test("local provider sends only to explicit loopback and does not follow redirects", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "http://127.0.0.1:11434/v1/chat/completions");
      assert.equal(init?.redirect, "error");
      assert.equal(init?.credentials, "omit");
      return new Response(JSON.stringify({ choices: [{ message: { content: "local answer" } }] }));
    };
    assert.equal(
      await localConversation(
        { endpoint: "http://127.0.0.1:11434", model: "installed-model" },
        [{ role: "user", content: "hello" }],
        new AbortController().signal,
      ),
      "local answer",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("controlled syntax failure is repaired and rechecked by the real Node parser", async () => {
  const { spawnSync } = await import("node:child_process");
  let builds = 0;
  const result = await repairBuild({
    files: [{ path: "index.js", content: "const broken = ;" }],
    attempts: 1,
    signal: new AbortController().signal,
    build: async (files) => {
      builds++;
      const result = spawnSync(process.execPath, ["--check", "--input-type=module"], {
        input: files[0].content,
        encoding: "utf8",
        timeout: 5000,
      });
      return { exitCode: result.status ?? 1, output: result.stderr || result.stdout };
    },
    propose: async () => [{ path: "index.js", content: "const repaired = 1;" }],
    approve: async () => true,
    event: () => {},
  });
  assert.equal(builds, 2);
  assert.equal(result.result.exitCode, 0);
  assert.equal(result.repaired, true);
});
test("package-manager hooks cannot run during an approved install", () => {
  for (const path of [
    ".npmrc",
    ".yarnrc.yml",
    ".pnpmfile.cjs",
    "pnpm-workspace.yaml",
    ".yarn/plugins/plugin.cjs",
  ])
    assert.throws(() => projectPlan(files(pkg, [{ path, content: "untrusted" }])));
});
