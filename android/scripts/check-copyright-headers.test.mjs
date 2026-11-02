import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { checkCopyrightHeaders } from "./check-copyright-headers.mjs";

const roots = [];
const notice = "Copyright © 2026 VELORYZ. All rights reserved.";

async function fixture({ requiredFirstParty = [], files = {}, originOverrides = {} } = {}) {
  const root = await mkdtemp(join(tmpdir(), "velori-copyright-"));
  roots.push(root);
  await mkdir(join(root, "docs/legal"), { recursive: true });
  const policyPath = "docs/legal/copyright-header-policy.json";
  const policyContent = JSON.stringify({ requiredFirstParty });
  await writeFile(join(root, policyPath), policyContent);
  const inventoryFiles = [
    {
      path: policyPath,
      origin: "uncertain",
      sha256: createHash("sha256").update(policyContent).digest("hex"),
    },
  ];
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), content);
    inventoryFiles.push({
      path,
      origin:
        originOverrides[path] ??
        (requiredFirstParty.includes(path) ? "verified-first-party" : "uncertain"),
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  await writeFile(
    join(root, "docs/legal/intellectual-property-inventory.json"),
    JSON.stringify({ files: inventoryFiles }),
  );
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("accepts a valid JavaScript header after a shebang", async () => {
  const path = "scripts/tool.mjs";
  const root = await fixture({
    requiredFirstParty: [path],
    files: { [path]: `#!/usr/bin/env node\n// ${notice}\nconsole.log("ok");\n` },
  });
  assert.deepEqual(await checkCopyrightHeaders(root), {
    errors: [],
    inventoried: 2,
    unresolved: 1,
    required: 1,
  });
});

test("uses syntax-specific CSS and SQL headers", async () => {
  const cssPath = "src/site.css";
  const sqlPath = "supabase/routine.sql";
  const root = await fixture({
    requiredFirstParty: [cssPath, sqlPath],
    files: {
      [cssPath]: `/* ${notice} */\nbody { color: black; }\n`,
      [sqlPath]: `-- ${notice}\nselect 1;\n`,
    },
  });
  const result = await checkCopyrightHeaders(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.required, 2);
});

test("supports an HTML-comment copyright notice in Markdown", async () => {
  const path = "docs/owned.md";
  const root = await fixture({
    requiredFirstParty: [path],
    files: { [path]: `<!-- ${notice} -->\n\n# Verified work\n` },
  });
  const result = await checkCopyrightHeaders(root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.required, 1);
});

test("reports missing and duplicate notices in declared first-party files", async () => {
  const root = await fixture({
    requiredFirstParty: ["src/missing.ts", "src/duplicate.ts"],
    files: {
      "src/duplicate.ts": `// ${notice}\n// ${notice}\nexport {};\n`,
    },
  });
  const result = await checkCopyrightHeaders(root);
  assert.ok(result.errors.some((error) => error.includes("missing or invalid: src/missing.ts")));
  assert.ok(result.errors.some((error) => error.includes("exactly once: src/duplicate.ts")));
});

test("does not allow JSON or generated output to be declared as header-bearing source", async () => {
  const root = await fixture({
    requiredFirstParty: ["tsconfig.json", "dist/generated.js"],
    files: {
      "tsconfig.json": '{"compilerOptions":{}}',
    },
  });
  const result = await checkCopyrightHeaders(root);
  assert.ok(result.errors.some((error) => error.includes("invalid: tsconfig.json")));
  assert.ok(result.errors.some((error) => error.includes("invalid: dist/generated.js")));
});

test("reports newly added or stale source paths that are absent from the inventory", async () => {
  const root = await fixture({
    files: { "src/current.ts": "export {};\n" },
  });
  await writeFile(join(root, "src/new.ts"), "export {};\n");
  const result = await checkCopyrightHeaders(root);
  assert.ok(
    result.errors.some((error) => error.includes("Uninventoried meaningful file: src/new.ts")),
  );
});

test("recognizes text, Prisma, webmanifest, editor-rule, and extensionless files", async () => {
  const root = await fixture();
  await mkdir(join(root, ".cursor/rules"), { recursive: true });
  await mkdir(join(root, "public"), { recursive: true });
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(join(root, "supabase/.temp"), { recursive: true });
  await mkdir(join(root, "supabase/.branches"), { recursive: true });
  await mkdir(join(root, "supabase/backups"), { recursive: true });
  await writeFile(join(root, "baseline-files.txt"), "tracked source inventory\n");
  await writeFile(join(root, "schema.prisma"), "model User { id String @id }\n");
  await writeFile(join(root, "public/manifest.webmanifest"), "{}\n");
  await writeFile(join(root, ".cursor/rules/project.mdc"), "description: test\n");
  await writeFile(join(root, "scripts/tool"), "executable source\n");
  await writeFile(join(root, ".env.local"), "should not be inventoried\n");
  await writeFile(join(root, "local.db"), "not source inventory\n");
  await writeFile(join(root, "supabase/.temp/project-ref"), "local state\n");
  await writeFile(join(root, "supabase/.branches/current"), "local state\n");
  await writeFile(join(root, "supabase/backups/private.txt"), "backup\n");
  const result = await checkCopyrightHeaders(root);
  for (const path of [
    "baseline-files.txt",
    "schema.prisma",
    "public/manifest.webmanifest",
    ".cursor/rules/project.mdc",
    "scripts/tool",
  ]) {
    assert.ok(
      result.errors.some((error) => error.includes(`Uninventoried meaningful file: ${path}`)),
    );
  }
  assert.ok(!result.errors.some((error) => error.includes(".env.local")));
  assert.ok(!result.errors.some((error) => error.includes("local.db")));
  assert.ok(!result.errors.some((error) => error.includes("supabase/.temp")));
  assert.ok(!result.errors.some((error) => error.includes("supabase/.branches")));
  assert.ok(!result.errors.some((error) => error.includes("supabase/backups")));
});

test("detects new assets and changed files not reflected in the inventory hash", async () => {
  const root = await fixture({
    files: { "src/current.ts": "export {};\n" },
  });
  await mkdir(join(root, "public"), { recursive: true });
  await writeFile(join(root, "public/new.svg"), "<svg />\n");
  await writeFile(join(root, "src/current.ts"), "export const changed = true;\n");
  const result = await checkCopyrightHeaders(root);
  assert.ok(
    result.errors.some((error) => error.includes("Uninventoried meaningful file: public/new.svg")),
  );
  assert.ok(
    result.errors.some((error) =>
      error.includes("Inventory hash is stale; regenerate the inventory: src/current.ts"),
    ),
  );
});

test("retains unresolved origins as an explicit review count", async () => {
  const root = await fixture({
    files: { "src/uncertain.ts": "export {};\n" },
  });
  const result = await checkCopyrightHeaders(root);
  assert.equal(result.unresolved, 2);
  assert.deepEqual(result.errors, []);
});

test("refuses to require ownership notices without verified first-party provenance", async () => {
  const path = "src/uncertain.ts";
  const root = await fixture({
    requiredFirstParty: [path],
    files: { [path]: `// ${notice}\nexport {};\n` },
    originOverrides: { [path]: "uncertain" },
  });
  const result = await checkCopyrightHeaders(root);
  assert.ok(
    result.errors.some((error) => error.includes(`lacks verified first-party evidence: ${path}`)),
  );
});
