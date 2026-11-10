/* Copyright © 2026 VELORYZ. */
import { parseSourceFiles, type SourceFile } from "../multi-file.ts";
export type PackageManager = "npm" | "pnpm" | "yarn";
export type Command = { executable: string; args: string[] };
export function projectPlan(input: SourceFile[]) {
  const files = parseSourceFiles(input);
  if (
    files.some(
      (f) =>
        /(?:^|\/)(?:\.npmrc|\.yarnrc(?:\.yml)?|\.pnpmfile\.cjs|pnpm-workspace\.yaml|yarn\.config\.cjs)$/.test(
          f.path,
        ) || f.path.startsWith(".yarn/"),
    )
  )
    throw Error("Package-manager hooks and custom registry configuration require manual review.");
  const manifest = files.find((f) => f.path === "package.json");
  if (!manifest) throw Error("No package.json. Python needs the desktop execution adapter.");
  let pkg;
  try {
    pkg = JSON.parse(manifest.content);
  } catch {
    throw Error("package.json is not valid JSON.");
  }
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg))
    throw Error("Invalid package manifest.");
  const locks = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"].filter((p) =>
    files.some((f) => f.path === p),
  );
  if (locks.length > 1)
    throw Error("Conflicting lockfiles. Keep the intended package manager lockfile.");
  const declared =
    typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : undefined;
  if (declared && !["npm", "pnpm", "yarn"].includes(declared))
    throw Error("Unsupported package manager.");
  const inferred =
    locks[0] === "pnpm-lock.yaml" ? "pnpm" : locks[0] === "yarn.lock" ? "yarn" : "npm";
  if (declared && locks.length && declared !== inferred)
    throw Error("packageManager conflicts with its lockfile.");
  const manager = (declared || inferred) as PackageManager;
  for (const group of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const deps = pkg[group] ?? {};
    if (typeof deps !== "object" || Array.isArray(deps)) throw Error("Invalid dependency list.");
    for (const [name, version] of Object.entries(deps)) {
      if (
        !/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name) ||
        typeof version !== "string" ||
        !/^[~^<>=*\d][\dA-Za-z.*+<>=~^| -]{0,100}$/.test(version)
      )
        throw Error(
          "Only registry packages with version ranges are supported. URL, git, local and aliased dependencies are refused.",
        );
    }
  }
  for (const field of ["overrides", "resolutions", "pnpm", "workspaces"])
    if (pkg[field]) throw Error(`Review ${field} manually before using this installer.`);
  const locked = locks.length > 0;
  const install: Command =
    manager === "npm"
      ? {
          executable: "npm",
          args: [locked ? "ci" : "install", "--ignore-scripts", "--no-audit", "--no-fund"],
        }
      : manager === "pnpm"
        ? {
            executable: "pnpm",
            args: ["install", "--ignore-scripts", ...(locked ? ["--frozen-lockfile"] : [])],
          }
        : {
            executable: "yarn",
            args: ["install", "--ignore-scripts", ...(locked ? ["--frozen-lockfile"] : [])],
          };
  if (manager === "yarn" && pkg.packageManager && !/^yarn@1\./.test(pkg.packageManager))
    throw Error(
      "Only Yarn Classic is verified by this adapter; modern Yarn requires a separate policy.",
    );
  const scripts = pkg.scripts ?? {};
  if (typeof scripts.dev !== "string") throw Error("Add a development script to package.json.");
  return { manager, install, locked, scripts, files };
}
export function previewUrl(value: string, origins: string[]) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    !origins.includes(url.origin) ||
    !["https:", "http:"].includes(url.protocol)
  )
    throw Error("Runtime returned an unapproved preview origin.");
  return url.href;
}
export function runtimePreflight(env: {
  secure: boolean;
  isolated: boolean;
  sharedMemory: boolean;
  licensed: boolean;
}) {
  const errors: string[] = [];
  if (!env.licensed) errors.push("Browser execution awaits a verified commercial runtime license.");
  if (!env.secure) errors.push("A secure context (HTTPS or localhost) is required.");
  if (!env.isolated)
    errors.push(
      "Cross-origin isolation is unavailable. Serve the runner with reviewed COOP/COEP headers.",
    );
  if (!env.sharedMemory) errors.push("SharedArrayBuffer is unavailable in this browser.");
  return errors;
}
export type FileChange = { path: string; before?: string; after?: string };
export function fileChanges(before: SourceFile[], after: SourceFile[]): FileChange[] {
  const a = new Map(parseSourceFiles(before).map((f) => [f.path, f.content]));
  const b = new Map(parseSourceFiles(after).map((f) => [f.path, f.content]));
  return [...new Set([...a.keys(), ...b.keys()])]
    .filter((p) => a.get(p) !== b.get(p))
    .map((path) => ({ path, before: a.get(path), after: b.get(path) }));
}
export function applyRevision(
  current: SourceFile[],
  expected: SourceFile[],
  next: SourceFile[],
  approveDelete = false,
  locked: string[] = [],
) {
  if (JSON.stringify(current) !== JSON.stringify(expected))
    throw Error("Files changed during generation. Review the revision again.");
  const changes = fileChanges(current, next);
  if (changes.some((f) => locked.includes(f.path)))
    throw Error("A revision changes a locked file.");
  if (!approveDelete && changes.some((f) => f.after === undefined))
    throw Error("File deletion requires approval.");
  return parseSourceFiles(next);
}
