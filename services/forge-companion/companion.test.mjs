/* Copyright © 2026 VELORYZ. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  isolationArgs,
  requestAllowed,
  archive,
  imageReference,
  dockerExecutable,
} from "./policy.mjs";
import { createCompanion, DEFAULT_PORT } from "./server.mjs";
import { checkCompanionPrerequisites } from "../../scripts/verify-forge-companion.mjs";
const image = "node@sha256:" + "a".repeat(64);
test("default companion port matches the FORGE workspace endpoint", () => {
  assert.equal(DEFAULT_PORT, 7331);
});
test("Windows Docker Desktop per-user CLI path is resolved without weakening daemon checks", () => {
  const env = { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" };
  const result = dockerExecutable(env, "win32", (candidate) => candidate.endsWith("\\docker.exe"));
  assert.equal(
    result,
    "C:\\Users\\test\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin\\docker.exe",
  );
});
test("companion preflight requires rootless Docker and a local pinned image", () => {
  const env = { VELORI_FORGE_ORIGIN: "https://velori.test", VELORI_FORGE_NODE_IMAGE: image };
  const result = checkCompanionPrerequisites(
    env,
    (_command, args) =>
      args[0] === "info" ? { status: 0, output: '["name=rootless"]' } : { status: 0, output: "" },
    "24.0.0",
  );
  assert.deepEqual(result, { ok: true, issues: [] });
  const missing = checkCompanionPrerequisites(
    env,
    () => ({ status: null, output: "", error: Error("missing") }),
    "24.0.0",
  );
  assert.equal(missing.ok, false);
  assert.match(missing.issues.join(" "), /Docker CLI is unavailable/);
});
test("Docker Desktop without rootless mode is refused before container creation", async () => {
  const calls = [];
  const server = createCompanion({
    origin: "https://velori.test",
    token: "secret",
    nodeImage: image,
    runner: async (args) => {
      calls.push(args);
      return {
        exitCode: 0,
        output: JSON.stringify(["name=seccomp,profile=builtin", "name=cgroupns"]),
      };
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/run`, {
      method: "POST",
      headers: {
        origin: "https://velori.test",
        authorization: "Bearer secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "build", files: [], allowRegistryNetwork: true }),
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /Rootless Docker/);
    assert.deepEqual(calls, [["info", "--format", "{{json .SecurityOptions}}"]]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test("container policy limits resources without privileged mode, host mounts or host network", () => {
  const args = isolationArgs(image, "velori-" + "a".repeat(24));
  for (const flag of [
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=128",
    "--memory=512m",
    "--cpus=1",
    "--pull=never",
  ])
    assert.ok(args.includes(flag));
  assert.equal(args[args.indexOf("--network") + 1], "none");
  assert.ok(!args.some((x) => x.includes("privileged") || x.includes("docker.sock")));
  assert.throws(() => imageReference("node:latest"));
  assert.throws(() => isolationArgs(image, "malicious; shell"));
});
test("pairing requires exact origin, host and bearer token", () => {
  const h = {
    host: "127.0.0.1:7331",
    origin: "https://velori.test",
    authorization: "Bearer token",
  };
  assert.equal(requestAllowed(h, h.origin, "token"), true);
  assert.equal(requestAllowed({ ...h, origin: "https://evil.test" }, h.origin, "token"), false);
  assert.equal(requestAllowed({ ...h, host: "evil.test" }, h.origin, "token"), false);
  assert.equal(requestAllowed(h, h.origin, "wrong"), false);
});
test("archive encodes only regular entries and rejects oversized paths", () => {
  const tar = archive([{ path: "src/main.js", content: "hello" }]);
  assert.equal(tar[156], 48);
  assert.equal(tar.length % 512, 0);
  assert.throws(() => archive([{ path: "a".repeat(101), content: "" }]));
});
test("companion fails closed when Docker isolation is unavailable", async () => {
  const server = createCompanion({
    origin: "https://velori.test",
    token: "secret",
    nodeImage: image,
    runner: async () => ({ exitCode: 1, output: "no daemon" }),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/run`, {
      method: "POST",
      headers: {
        origin: "https://velori.test",
        authorization: "Bearer secret",
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "preflight" }),
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /Rootless Docker/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
