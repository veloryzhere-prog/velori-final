/* Copyright © 2026 VELORYZ. Local-only rootless container build companion. */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectPlan } from "../../src/features/artifacts/runtime/policy.ts";
import { parseSourceFiles } from "../../src/features/artifacts/multi-file.ts";
import {
  imageReference,
  isolationArgs,
  requestAllowed,
  archive,
  dockerExecutable,
} from "./policy.mjs";
export const DEFAULT_PORT = 7331;
export function docker(args, input, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const executable = dockerExecutable();
    const dockerDirectory = path.dirname(executable);
    const cliPath = [dockerDirectory, process.env.PATH].filter(Boolean).join(path.delimiter);
    const child = spawn(executable, args, {
      shell: false,
      env: { PATH: cliPath, HOME: process.env.HOME },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "",
      size = 0;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Error("Sandbox command timed out."));
    }, timeout);
    const collect = (data) => {
      size += data.length;
      if (size > 1000000) {
        child.kill("SIGKILL");
        return;
      }
      output = (output + data).slice(-64000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, output });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
}
export function createCompanion({ origin, token, nodeImage, pythonImage, runner = docker }) {
  const accepted = new URL(origin);
  if (!["https:", "http:"].includes(accepted.protocol) || accepted.origin !== origin)
    throw Error("Set one exact VELORI origin.");
  let busy = false;
  return createServer(async (req, res) => {
    if (!/^127\.0\.0\.1:[0-9]+$/.test(req.headers.host ?? "") || req.headers.origin !== origin) {
      res.writeHead(403);
      res.end();
      return;
    }
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...headers,
        "Access-Control-Allow-Headers": "authorization,content-type",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Private-Network": "true",
      });
      res.end();
      return;
    }
    if (!requestAllowed(req.headers, origin, token)) {
      res.writeHead(401, headers);
      res.end('{"error":"Pair this browser with the local companion."}');
      return;
    }
    const reply = (status, data) => {
      res.writeHead(status, headers);
      res.end(JSON.stringify(data));
    };
    if (req.method !== "POST" || req.url !== "/v1/run") {
      reply(404, { error: "Unknown companion operation." });
      return;
    }
    if (busy) {
      reply(409, { error: "A sandbox operation is already active." });
      return;
    }
    let name;
    try {
      let text = "",
        bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 2200000) throw Error("Project exceeds companion limit.");
        text += chunk;
      }
      const body = JSON.parse(text);
      busy = true;
      const info = await runner(["info", "--format", "{{json .SecurityOptions}}"]);
      if (info.exitCode !== 0 || !JSON.parse(info.output).some((x) => x === "name=rootless"))
        throw Error("Rootless Docker is required. No host execution fallback is available.");
      if (body.action === "preflight") {
        const available = async (image) => {
          try {
            imageReference(image);
            return (await runner(["image", "inspect", image])).exitCode === 0;
          } catch {
            return false;
          }
        };
        reply(200, {
          rootless: true,
          nodeBuild: await available(nodeImage),
          pythonCompile: await available(pythonImage),
          preview: false,
          network: "Denied by default",
          note: "Persistent development-server previews and Python dependency installation are not implemented.",
        });
        return;
      }
      if (!["build", "install"].includes(body.action))
        throw Error("Only install and build operations are supported.");
      const files = parseSourceFiles(body.files);
      if (files.some((f) => /(^|\/)\.(npmrc|yarnrc)/.test(f.path)))
        throw Error("Custom registry configuration is refused.");
      const python =
        !files.some((f) => f.path === "package.json") && files.some((f) => f.path.endsWith(".py"));
      const plan = python ? null : projectPlan(files);
      if (python && body.action === "install")
        throw Error("Python dependency installation is not implemented.");
      if (!python && body.allowRegistryNetwork !== true)
        throw Error("Explicit registry network permission is required.");
      if (body.action === "build" && !python && !plan.scripts.build)
        throw Error("No build script configured.");
      name = "velori-" + randomBytes(12).toString("hex");
      const image = imageReference(python ? pythonImage : nodeImage);
      const created = await runner(isolationArgs(image, name, !python ? "bridge" : "none"));
      if (created.exitCode !== 0)
        throw Error(created.output.slice(-300) || "Could not start sandbox.");
      const copied = await runner(
        ["exec", "-i", name, "tar", "-xf", "-", "-C", "/workspace"],
        archive(files),
      );
      if (copied.exitCode !== 0) throw Error("Could not mount project sources.");
      if (!python && body.action === "build") {
        const install = await runner(["exec", name, plan.install.executable, ...plan.install.args]);
        if (install.exitCode !== 0) {
          reply(200, { ...install, stage: "install" });
          return;
        }
        const offline = await runner(["network", "disconnect", "bridge", name]);
        if (offline.exitCode !== 0)
          throw Error("Could not enforce offline build network. Build refused.");
      }
      const command = python
        ? ["python", "-m", "compileall", "-q", "."]
        : body.action === "install"
          ? [plan.install.executable, ...plan.install.args]
          : [plan.manager, "run", "build"];
      const result = await runner(["exec", name, ...command]);
      reply(200, {
        ...result,
        command,
        preview: false,
        note:
          body.action === "install"
            ? "Install used an ephemeral sandbox; dependencies are discarded when this job ends."
            : "Build sandbox has no network.",
      });
    } catch (error) {
      reply(503, { error: error instanceof Error ? error.message : "Companion unavailable." });
    } finally {
      if (name) await runner(["rm", "-f", name]).catch(() => undefined);
      busy = false;
    }
  });
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const token = randomBytes(32).toString("hex");
  const server = createCompanion({
    origin: process.env.VELORI_FORGE_ORIGIN ?? "",
    token,
    nodeImage: process.env.VELORI_FORGE_NODE_IMAGE,
    pythonImage: process.env.VELORI_FORGE_PYTHON_IMAGE,
  });
  const port = Number(process.env.VELORI_FORGE_PORT ?? DEFAULT_PORT);
  server.listen(port, "127.0.0.1", () =>
    console.log(
      `FORGE companion listening only at 127.0.0.1:${port}. Pairing token (keep private): ${token}`,
    ),
  );
}
