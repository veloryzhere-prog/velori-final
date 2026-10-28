import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const notice = "Copyright © 2026 VELORYZ. All rights reserved.";
const extensions = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".md",
  ".md",
  ".mjs",
  ".mts",
  ".prisma",
  ".scss",
  ".sql",
  ".svg",
  ".ts",
  ".tsx",
]);
const skippedDirectories = new Set([
  ".git",
  ".next",
  ".vite",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "playwright-report",
  ".branches",
  ".temp",
  "backups",
  "test-results",
]);
const skippedRepositorySubtrees = ["supabase/.branches", "supabase/.temp", "supabase/backups"];
const meaningfulExtensions = new Set([
  ...extensions,
  ".csv",
  ".mdc",
  ".gif",
  ".jpeg",
  ".jpg",
  ".json",
  ".mp3",
  ".mp4",
  ".otf",
  ".png",
  ".prisma",
  ".toml",
  ".ttf",
  ".wav",
  ".webp",
  ".txt",
  ".webmanifest",
  ".woff",
  ".woff2",
  ".xml",
  ".yaml",
  ".yml",
]);
const exactFilenames = new Set([
  ".editorconfig",
  ".env.example",
  ".env.template",
  ".gitignore",
  ".gitattributes",
  ".npmrc",
  "Dockerfile",
  "LICENSE",
  "Makefile",
  "NOTICE",
  "deno.lock",
]);
const generatedInventoryPaths = new Set([
  "docs/legal/intellectual-property-inventory.json",
  "docs/legal/intellectual-property-inventory.md",
  "docs/legal/file-copyright-inventory.md",
]);
const commentByExtension = new Map([
  [".cjs", "//"],
  [".css", "/*"],
  [".html", "<!--"],
  [".js", "//"],
  [".jsx", "//"],
  [".md", "<!--"],
  [".mjs", "//"],
  [".mts", "//"],
  [".prisma", "//"],
  [".scss", "/*"],
  [".sql", "--"],
  [".ts", "//"],
  [".tsx", "//"],
]);

function asRepositoryPath(path) {
  return path.split("\\").join("/");
}

function isMeaningfulFile(path) {
  const filename = path.split("/").at(-1);
  const lowerName = filename.toLowerCase();
  if (
    (lowerName.startsWith(".env") && ![".env.example", ".env.template"].includes(lowerName)) ||
    [".db", ".db-journal", ".err", ".log", ".sqlite", ".sqlite3"].includes(
      extname(lowerName).toLowerCase(),
    )
  )
    return false;
  return (
    meaningfulExtensions.has(extname(lowerName).toLowerCase()) ||
    exactFilenames.has(filename) ||
    !extname(filename)
  );
}

async function listFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const repositoryPath = asRepositoryPath(relative(root, absolutePath));
      if (
        skippedRepositorySubtrees.some(
          (excluded) => repositoryPath === excluded || repositoryPath.startsWith(`${excluded}/`),
        )
      )
        continue;
      files.push(...(await listFiles(root, absolutePath)));
    } else if (entry.isFile()) {
      const path = asRepositoryPath(relative(root, absolutePath));
      if (isMeaningfulFile(path) && !generatedInventoryPaths.has(path)) files.push(path);
    }
  }
  return files.sort();
}

function renderNotice(path) {
  const comment = commentByExtension.get(extname(path).toLowerCase());
  if (comment === "/*") return `/* ${notice} */`;
  if (comment === "<!--") return `<!-- ${notice} -->`;
  return `${comment} ${notice}`;
}

function hasHeader(content, path) {
  const lines = content.split(/\r?\n/).slice(0, 8);
  const start = lines[0]?.startsWith("#!") ? 1 : 0;
  return lines.slice(start, start + 5).some((line) => line.includes(renderNotice(path)));
}

export async function checkCopyrightHeaders(root = projectRoot) {
  const absoluteRoot = resolve(root);
  const policyPath = join(absoluteRoot, "docs/legal/copyright-header-policy.json");
  const inventoryPath = join(absoluteRoot, "docs/legal/intellectual-property-inventory.json");
  const errors = [];
  let policy;
  let inventory;

  try {
    policy = JSON.parse(await readFile(policyPath, "utf8"));
  } catch {
    errors.push("Copyright header policy is missing or invalid.");
  }
  try {
    inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
  } catch {
    errors.push("Intellectual-property inventory is missing or invalid.");
  }

  if (!policy || !inventory) return { errors, inventoried: 0, unresolved: 0, required: 0 };
  if (!Array.isArray(policy.requiredFirstParty) || !Array.isArray(inventory.files)) {
    errors.push("Policy or inventory has an invalid file list.");
    return { errors, inventoried: 0, unresolved: 0, required: 0 };
  }

  const currentFiles = await listFiles(absoluteRoot);
  const inventoryPaths = new Set(inventory.files.map((file) => file.path));
  const currentPaths = new Set(currentFiles);
  for (const path of currentPaths) {
    if (!inventoryPaths.has(path)) errors.push(`Uninventoried meaningful file: ${path}`);
  }
  for (const path of inventoryPaths) {
    if (!currentPaths.has(path)) errors.push(`Stale inventory entry: ${path}`);
  }

  for (const path of policy.requiredFirstParty) {
    if (
      typeof path !== "string" ||
      !commentByExtension.has(extname(path).toLowerCase()) ||
      !currentPaths.has(path)
    ) {
      errors.push(`Required first-party source file is missing or invalid: ${String(path)}`);
      continue;
    }
    const inventoryEntry = inventory.files.find((file) => file.path === path);
    if (inventoryEntry?.origin !== "verified-first-party") {
      errors.push(`Required copyright header lacks verified first-party evidence: ${path}`);
      continue;
    }
    try {
      const content = await readFile(join(absoluteRoot, path), "utf8");
      const escapedNotice = notice.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const count = (content.match(new RegExp(escapedNotice, "g")) ?? []).length;
      if (!hasHeader(content, path)) errors.push(`Missing copyright header: ${path}`);
      else if (count !== 1) errors.push(`Copyright header must appear exactly once: ${path}`);
    } catch {
      errors.push(`Could not read required source file: ${path}`);
    }
  }

  for (const entry of inventory.files) {
    if (!currentPaths.has(entry.path) || typeof entry.sha256 !== "string") continue;
    try {
      const content = await readFile(join(absoluteRoot, entry.path));
      const actualHash = createHash("sha256").update(content).digest("hex");
      if (actualHash !== entry.sha256)
        errors.push(`Inventory hash is stale; regenerate the inventory: ${entry.path}`);
    } catch {
      errors.push(`Could not verify inventory hash: ${entry.path}`);
    }
  }

  const unresolved = inventory.files.filter(
    (file) => !["verified-first-party", "verified-third-party", "generated"].includes(file.origin),
  ).length;
  return {
    errors,
    inventoried: inventory.files.length,
    unresolved,
    required: policy.requiredFirstParty.length,
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const strict = process.argv.includes("--strict");
  const result = await checkCopyrightHeaders();
  console.log(
    `Inventory: ${result.inventoried} meaningful files; ${result.required} verified first-party files require headers; ${result.unresolved} origins remain unresolved.`,
  );
  if (result.errors.length) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else if (strict && result.unresolved > 0) {
    console.error(
      `ERROR: strict rights validation is blocked by ${result.unresolved} unresolved file origins.`,
    );
    process.exitCode = 1;
  } else if (result.unresolved > 0) {
    console.warn("RIGHTS REVIEW REQUIRED: unresolved origins are reported, not treated as owned.");
  } else {
    console.log("Copyright header and inventory checks passed.");
  }
}
