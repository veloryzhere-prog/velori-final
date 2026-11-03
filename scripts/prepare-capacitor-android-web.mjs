import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webBuild = resolve(projectRoot, "dist");
const androidWebBuild = resolve(projectRoot, ".capacitor-android-web");
const excludedExtensions = new Set([".apk", ".aab"]);

try {
  await stat(resolve(webBuild, "index.html"));
} catch (error) {
  throw new Error("Build the web app before preparing Capacitor assets.", { cause: error });
}

await rm(androidWebBuild, { recursive: true, force: true });
await mkdir(androidWebBuild, { recursive: true });
await cp(webBuild, androidWebBuild, {
  recursive: true,
  filter: (source) => !excludedExtensions.has(extname(source).toLowerCase()),
});

console.log("Prepared Capacitor assets without downloadable Android release archives.");

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["exec", "cap", "sync", "android"], {
  cwd: projectRoot,
  env: { ...process.env, VELORI_CAPACITOR_ANDROID_BUILD: "true" },
  shell: process.platform === "win32",
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
