/* Copyright © 2026 VELORYZ. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dockerExecutable } from "../services/forge-companion/policy.mjs";

const digestImage = /^[a-z0-9./:_-]+@sha256:[a-f0-9]{64}$/;

function execute(command, args) {
  const executable = dockerExecutable();
  const cliPath = [path.dirname(executable), process.env.PATH].filter(Boolean).join(path.delimiter);
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    env: { ...process.env, PATH: cliPath },
    timeout: 15_000,
    windowsHide: true,
    shell: false,
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    error: result.error,
  };
}

export function checkCompanionPrerequisites(
  env = process.env,
  run = execute,
  nodeVersion = process.versions.node,
) {
  const issues = [];
  if (Number(nodeVersion.split(".")[0]) < 24) issues.push("Node.js 24 or newer is required.");

  try {
    const origin = new URL(env.VELORI_FORGE_ORIGIN ?? "");
    if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== env.VELORI_FORGE_ORIGIN)
      issues.push("Set VELORI_FORGE_ORIGIN to one exact HTTP(S) origin without a path.");
  } catch {
    issues.push("Set VELORI_FORGE_ORIGIN to one exact HTTP(S) origin without a path.");
  }

  const port = Number(env.VELORI_FORGE_PORT ?? 7331);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    issues.push("VELORI_FORGE_PORT must be an integer from 1 to 65535.");

  const image = env.VELORI_FORGE_NODE_IMAGE ?? "";
  if (!digestImage.test(image))
    issues.push("Set VELORI_FORGE_NODE_IMAGE to a reviewed image pinned by SHA-256 digest.");

  const info = run("docker", ["info", "--format", "{{json .SecurityOptions}}"]);
  let rootless = false;
  if (info.error)
    issues.push("Docker CLI is unavailable; install rootless Docker Desktop or Engine.");
  else if (info.status !== 0) issues.push("Docker daemon is unavailable or not responding.");
  else {
    try {
      rootless = JSON.parse(info.output).includes("name=rootless");
    } catch {
      issues.push(
        "Docker returned unreadable security options; rootless mode could not be verified.",
      );
    }
    if (!rootless && !issues.some((issue) => issue.includes("unreadable")))
      issues.push("Docker is not running in rootless mode; companion execution is refused.");
  }

  if (rootless && digestImage.test(image)) {
    const available = run("docker", ["image", "inspect", image]);
    if (available.error || available.status !== 0)
      issues.push("The configured digest-pinned Node image is not available locally.");
  }

  return { ok: issues.length === 0, issues };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = checkCompanionPrerequisites();
  console.log(`FORGE companion preflight: ${result.ok ? "PASS" : "FAILED"}`);
  for (const issue of result.issues) console.log(`- ${issue}`);
  console.log(
    "This preflight does not execute project code or verify container escape resistance.",
  );
  if (!result.ok) process.exitCode = 1;
}
