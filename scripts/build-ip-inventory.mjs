import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputJson = "docs/legal/intellectual-property-inventory.json";
const outputMarkdown = "docs/legal/intellectual-property-inventory.md";
const outputCopyrightMarkdown = "docs/legal/file-copyright-inventory.md";
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
const extensions = new Set([
  ".cjs",
  ".css",
  ".csv",
  ".d.mts",
  ".d.ts",
  ".gif",
  ".html",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mdc",
  ".mjs",
  ".mts",
  ".mp3",
  ".mp4",
  ".otf",
  ".png",
  ".prisma",
  ".prisma",
  ".scss",
  ".sql",
  ".svg",
  ".txt",
  ".toml",
  ".ts",
  ".tsx",
  ".ttf",
  ".wav",
  ".webp",
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
  ".gitattributes",
  ".gitignore",
  ".npmrc",
  "Dockerfile",
  "LICENSE",
  "Makefile",
  "NOTICE",
  "deno.lock",
]);
const skippedRepositorySubtrees = ["supabase/.branches", "supabase/.temp", "supabase/backups"];
const binaryExtensions = new Set([
  ".gif",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".mp4",
  ".otf",
  ".png",
  ".ttf",
  ".wav",
  ".webp",
  ".woff",
  ".woff2",
]);
const root = resolve(projectRoot);

function repoPath(path) {
  return path.split("\\").join("/");
}

function isInventoryFile(entry) {
  if (!entry.isFile()) return false;
  const name = entry.name.toLowerCase();
  if (
    (name.startsWith(".env") && ![".env.example", ".env.template"].includes(name)) ||
    [".db", ".db-journal", ".err", ".log", ".sqlite", ".sqlite3"].includes(
      extname(name).toLowerCase(),
    )
  )
    return false;
  return (
    extensions.has(extname(name).toLowerCase()) ||
    exactFilenames.has(entry.name) ||
    !extname(entry.name)
  );
}

async function walk(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    const repositoryPath = repoPath(relative(root, path));
    if (
      entry.isDirectory() &&
      (skippedDirectories.has(entry.name) ||
        skippedRepositorySubtrees.some(
          (excluded) => repositoryPath === excluded || repositoryPath.startsWith(`${excluded}/`),
        ))
    )
      continue;
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else if (
      isInventoryFile(entry) &&
      ![outputJson, outputMarkdown, outputCopyrightMarkdown].includes(
        repoPath(relative(root, path)),
      )
    )
      result.push(repoPath(relative(root, path)));
  }
  return result.sort();
}

function originFor(path) {
  const lower = path.toLowerCase();
  if (
    lower.startsWith("artifacts/") ||
    lower.endsWith(".lock") ||
    lower === "pnpm-lock.yaml" ||
    lower === "package-lock.json" ||
    lower === "yarn.lock"
  )
    return {
      origin: "generated",
      evidence: lower.startsWith("artifacts/")
        ? "Stored under the repository's QA/artifact directory; original source is not established."
        : "Machine-maintained dependency lockfile; not a standalone authored source file.",
    };
  if (
    lower.startsWith(".figma/") ||
    lower.startsWith("src/imports/") ||
    lower.startsWith("src\\imports\\")
  )
    return {
      origin: "figma-or-imported-unverified",
      evidence:
        "The repository contains Figma Make project/import metadata. This path and repository context indicate import/export provenance, but do not establish applicable tool terms, authorship, or ownership.",
    };
  if (lower === "reel-studio/src/assets/react.svg" || lower === "reel-studio/src/assets/vite.svg")
    return {
      origin: "third-party-scaffold-unverified",
      evidence:
        "Named React/Vite starter artwork; exact upstream version and applicable asset licence have not been independently verified.",
    };
  return {
    origin: "uncertain",
    evidence:
      "Repository content alone does not establish the original author, assignment, licence, or exclusive ownership.",
  };
}

function noticeStatus(path, bytes) {
  const extension = extname(path).toLowerCase();
  if (binaryExtensions.has(extension))
    return { applicable: false, status: "not-applicable-binary" };
  if (
    extension === ".json" ||
    extension === ".yaml" ||
    extension === ".yml" ||
    extension === ".toml" ||
    extension === ".webmanifest"
  )
    return { applicable: false, status: "not-applicable-comment-syntax" };
  if (
    ![
      ".cjs",
      ".css",
      ".html",
      ".js",
      ".jsx",
      ".md",
      ".mjs",
      ".mts",
      ".prisma",
      ".scss",
      ".sql",
      ".ts",
      ".tsx",
    ].includes(extension)
  )
    return { applicable: false, status: "not-applicable-comment-syntax" };
  if (bytes.length === 0) return { applicable: false, status: "empty-file-review" };
  const head = bytes.subarray(0, Math.min(bytes.length, 2048)).toString("utf8");
  const hasCopyright =
    /(?:^|\n)\s*(?:(?:\/\/|\/\*+|\*|<!--|--)\s*)?(?:copyright\s+(?:(?:©|\(c\))\s*)?(?:19|20)\d{2}|©\s*(?:19|20)\d{2}|\(c\)\s*(?:19|20)\d{2})\b/i.test(
      head,
    );
  return {
    applicable: true,
    status: hasCopyright ? "existing-notice-needs-rights-review" : "no-notice-observed",
  };
}

async function trackedFiles() {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files"], {
      cwd: root,
      maxBuffer: 4_000_000,
    });
    return new Set(stdout.split(/\r?\n/).filter(Boolean));
  } catch {
    return new Set();
  }
}

async function packageDependencies() {
  const manifestPaths = ["package.json", "reel-studio/package.json"];
  const packages = [];
  for (const manifestPath of manifestPaths) {
    let manifest;
    try {
      manifest = JSON.parse(await readFile(join(root, manifestPath), "utf8"));
    } catch {
      continue;
    }
    for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
      for (const [name, requested] of Object.entries(manifest[section] ?? {})) {
        const packageDirectory = await findPackageDirectory(name);
        let metadata = {};
        if (packageDirectory) {
          try {
            metadata = JSON.parse(await readFile(join(packageDirectory, "package.json"), "utf8"));
          } catch {
            metadata = {};
          }
        }
        packages.push({
          manifest: manifestPath,
          name,
          section,
          requested,
          installedVersion: metadata.version ?? null,
          declaredLicense: metadata.license ?? metadata.licenses ?? null,
          licenseTextObserved: packageDirectory
            ? await fileExists(join(packageDirectory, "LICENSE"))
            : false,
          note: "Package metadata is a lead for manual review, not independent licence verification.",
        });
      }
    }
  }
  return packages.sort((a, b) => {
    const left = `${a.manifest}:${a.name}`;
    const right = `${b.manifest}:${b.name}`;
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function findPackageDirectory(name) {
  for (const modulesPath of ["node_modules", "reel-studio/node_modules"]) {
    const packageDirectory = join(root, modulesPath, ...name.split("/"));
    if (await fileExists(join(packageDirectory, "package.json"))) return packageDirectory;
  }
  return null;
}

function markdownReport(files, dependencies) {
  const counts = new Map();
  for (const file of files) counts.set(file.origin, (counts.get(file.origin) ?? 0) + 1);
  const headerApplicable = files.filter((file) => file.copyrightHeader.applicable);
  const notices = headerApplicable.filter(
    (file) => file.copyrightHeader.status === "existing-notice-needs-rights-review",
  );
  const unresolved = files.filter(
    (file) => !["verified-first-party", "verified-third-party", "generated"].includes(file.origin),
  );
  const rows = [...counts.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([origin, count]) => `| \`${origin}\` | ${count} |`)
    .join("\n");
  return `# Intellectual-property inventory

Generated by \`scripts/build-ip-inventory.mjs\` from the current working tree.

- Meaningful files scanned: ${files.length}
- Header-capable text files: ${headerApplicable.length}
- Dated copyright statements in file headers requiring rights review: ${notices.length}
- Dependency declarations inspected: ${dependencies.length}
- Files with unresolved or non-verified origin: ${unresolved.length}
- Detailed per-file records and dependency metadata: [intellectual-property-inventory.json](./intellectual-property-inventory.json)

## Origin categories

| Category | Count |
|---|---:|
${rows}

## Limitations and required review

This is a reproducible repository census, not a legal ownership determination. It records paths, content hashes, file types, Git tracking status, observed notice status, and available package metadata. Git presence, a project folder name, a Figma Make import marker, or a package's declared \`license\` value does not by itself prove authorship, assignment, licence compatibility, or permission for commercial redistribution.

The repository contains Figma Make project/import indicators. The applicable Figma Make terms and project/export records were not available to this scan. Images, logos, videos, fonts, icons, template content, and imported/generated source with unverified provenance remain un-cleared until supporting records are reviewed. No VELORYZ ownership header has been added to files whose ownership is not established.

Files in the QA \`artifacts/\` directory and dependency lockfiles are marked generated. They are included so their presence is auditable, but they are not treated as first-party authored works. Installed package metadata is recorded where available; direct and transitive licences still require review against each dependency's actual licence text and applicable notices.

Local environment files, database files, runtime logs, Supabase temporary state, and database backups are excluded: they are not source inventory and may contain secrets, personal data, or operational material. Reproducible path-level copyright statuses are listed in [file-copyright-inventory.md](./file-copyright-inventory.md); evidence, sizes, hashes, and dependency metadata remain in the machine-readable [JSON inventory](./intellectual-property-inventory.json).

No files were renamed by this inventory operation. See [file-renaming-inventory.md](../engineering/file-renaming-inventory.md) for compatibility-sensitive naming notes.
`;
}

function copyrightMarkdownReport(files) {
  const rows = files
    .map(
      (file) =>
        `| \`${file.path.replaceAll("|", "\\|")}\` | \`${file.origin}\` | ${file.gitTracked ? "tracked" : "untracked"} | ${file.copyrightHeader.applicable ? "text-capable" : "not applicable"} | \`${file.copyrightHeader.status}\` |`,
    )
    .join("\n");
  return `# File copyright inventory

Generated by \`scripts/build-ip-inventory.mjs\`. This is a path-level evidence index, not a legal ownership determination. The matching [machine-readable inventory](./intellectual-property-inventory.json) records each file's SHA-256, byte length, observed evidence, and source-control status.

- Meaningful files inventoried: ${files.length}
- Verified first-party files: ${files.filter((file) => file.origin === "verified-first-party").length}
- Verified third-party files: ${files.filter((file) => file.origin === "verified-third-party").length}
- Generated files: ${files.filter((file) => file.origin === "generated").length}
- Figma/import-indicator files with unresolved rights: ${files.filter((file) => file.origin === "figma-or-imported-unverified").length}
- Third-party scaffold files awaiting licence verification: ${files.filter((file) => file.origin === "third-party-scaffold-unverified").length}
- Other uncertain-origin files: ${files.filter((file) => file.origin === "uncertain").length}

Headers are not applied merely because a file is present in this repository. JSON, YAML, TOML, binary, and other incompatible formats are not assigned comment headers. Existing notices require provenance review and must be preserved. A header is required only after authorship or authorized rights are evidenced and the path is added to \`copyright-header-policy.json\`.

| Path | Origin assessment | Git | Header eligibility | Observed notice |
|---|---|---|---|---|
${rows}
`;
}

const files = [];
const tracked = await trackedFiles();
for (const path of await walk()) {
  const absolutePath = join(root, path);
  const bytes = await readFile(absolutePath);
  const origin = originFor(path);
  files.push({
    path,
    fileType: extname(path).toLowerCase() || "extensionless",
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    gitTracked: tracked.has(path),
    ...origin,
    copyrightHeader: noticeStatus(path, bytes),
  });
}

const dependencies = await packageDependencies();
const inventory = {
  schemaVersion: 1,
  source:
    "current working tree; excludes dependencies, VCS internals, build output, and test output",
  ownershipPolicy:
    "Do not infer exclusive VELORYZ ownership from repository presence. No path is verified-first-party until documentary evidence is reviewed.",
  counts: {
    files: files.length,
    gitTracked: files.filter((file) => file.gitTracked).length,
    generated: files.filter((file) => file.origin === "generated").length,
    uncertain: files.filter((file) => file.origin === "uncertain").length,
    figmaOrImportedUnverified: files.filter(
      (file) => file.origin === "figma-or-imported-unverified",
    ).length,
    thirdPartyScaffoldUnverified: files.filter(
      (file) => file.origin === "third-party-scaffold-unverified",
    ).length,
    dependencies: dependencies.length,
  },
  files,
  dependencies,
};

await writeFile(join(root, outputJson), `${JSON.stringify(inventory, null, 2)}\n`);
await writeFile(join(root, outputMarkdown), markdownReport(files, dependencies));
await writeFile(join(root, outputCopyrightMarkdown), copyrightMarkdownReport(files));
console.log(
  `Inventoried ${files.length} files and ${dependencies.length} dependency declarations. ${inventory.counts.uncertain + inventory.counts.figmaOrImportedUnverified + inventory.counts.thirdPartyScaffoldUnverified} origins remain unverified.`,
);
