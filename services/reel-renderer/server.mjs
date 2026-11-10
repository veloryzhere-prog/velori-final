import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline";
import { Transform } from "node:stream";
import {
  createReelFfmpegArgs,
  createReelThumbnailFfmpegArgs,
  validateReelExportOptions,
} from "../../src/lib/reel-editor/export-pipeline.mjs";

const configuredPort = Number(process.env.PORT ?? 8788);
const PORT =
  Number.isInteger(configuredPort) && configuredPort >= 0 && configuredPort <= 65535
    ? configuredPort
    : 8788;
const TOKEN = process.env.VELORI_FFMPEG_RENDERER_TOKEN ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const OUTPUT_DIR = path.resolve(process.env.VELORI_RENDER_OUTPUT_DIR ?? "./render-output");
const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const configuredConcurrency = Number(process.env.VELORI_RENDER_CONCURRENCY ?? 1);
const MAX_ACTIVE_JOBS =
  Number.isInteger(configuredConcurrency) && configuredConcurrency > 0
    ? Math.min(4, configuredConcurrency)
    : 1;
const RETENTION_MS = 24 * 60 * 60 * 1000;
const jobs = new Map();
let activeJobs = 0;

if (TOKEN.length < 32)
  throw new Error("VELORI_FFMPEG_RENDERER_TOKEN must contain at least 32 characters.");
if (!SUPABASE_URL)
  throw new Error("SUPABASE_URL must be configured for signed source URL validation.");
const supabaseOrigin = new URL(SUPABASE_URL).origin;
await mkdir(OUTPUT_DIR, { recursive: true });

function authorized(request) {
  const provided = request.headers["x-velori-renderer-token"];
  if (typeof provided !== "string") return false;
  const supplied = Buffer.from(provided);
  const expected = Buffer.from(TOKEN);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateSourceUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.origin === supabaseOrigin &&
      url.pathname.includes("/storage/v1/object/sign/reel-media/") &&
      (url.protocol === "https:" || ["localhost", "127.0.0.1"].includes(url.hostname))
    );
  } catch {
    return false;
  }
}

function runFfmpeg(args, duration, progress) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.FFMPEG_PATH ?? "ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-4000);
    });
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      const [key, value] = line.split("=", 2);
      if (key === "out_time_ms" && /^\d+$/.test(value)) {
        progress(Math.min(99, Math.floor((Number(value) / (duration * 1_000_000)) * 100)));
      }
      if (key === "progress" && value === "end") progress(99);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function render(job) {
  activeJobs += 1;
  job.status = "running";
  job.progress = 1;
  job.startedAt = Date.now();
  let directory;
  const outputPath = path.join(OUTPUT_DIR, `${job.ownerId}-${job.id}.${job.options.container}`);
  const thumbnailPath = path.join(OUTPUT_DIR, `${job.ownerId}-${job.id}.jpg`);
  try {
    directory = await mkdtemp(path.join(tmpdir(), "velori-render-"));
    const input = path.join(directory, "source.mp4");
    const textPath = path.join(directory, "overlay.txt");
    const fontFile = process.env.VELORI_FFMPEG_FONT_FILE
      ? path.resolve(process.env.VELORI_FFMPEG_FONT_FILE)
      : "";
    const response = await fetch(job.sourceUrl, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok || !response.body)
      throw new Error("The signed source video could not be downloaded.");
    const sourceFile = createWriteStream(input, { flags: "wx" });
    let downloadedBytes = 0;
    const sizeGuard = new Transform({
      transform(chunk, _encoding, callback) {
        downloadedBytes += chunk.length;
        if (downloadedBytes > MAX_SOURCE_BYTES)
          callback(new Error("The source video exceeds the upload limit."));
        else callback(null, chunk);
      },
    });
    await pipeline(response.body, sizeGuard, sourceFile);
    await writeFile(textPath, job.options.overlayText, "utf8");
    await runFfmpeg(
      createReelFfmpegArgs({
        sourcePath: input,
        outputPath,
        textPath,
        fontFile,
        duration: job.duration,
        sourceStart: job.sourceStart,
        options: job.options,
      }),
      job.duration,
      (progress) => {
        job.progress = Math.max(job.progress, progress);
      },
    );
    await runFfmpeg(
      createReelThumbnailFfmpegArgs({
        sourcePath: input,
        thumbnailPath,
        textPath,
        fontFile,
        sourceStart: job.sourceStart,
        options: job.options,
      }),
      1,
      () => {},
    );
    job.outputPath = outputPath;
    job.thumbnailPath = thumbnailPath;
    job.status = "completed";
    job.progress = 100;
    job.completedAt = Date.now();
  } catch (error) {
    job.status = "failed";
    job.progress = 0;
    job.message =
      error instanceof Error && error.message.startsWith("FFmpeg exited")
        ? "FFmpeg could not encode this source with the selected settings. Check the renderer's codecs and try again."
        : error instanceof Error
          ? error.message
          : "The render failed.";
    job.completedAt = Date.now();
    await rm(outputPath, { force: true });
    await rm(thumbnailPath, { force: true });
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      job.sourceUrl = "";
      activeJobs -= 1;
    }
  }
}

function statusFor(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    ...(job.message ? { message: job.message } : {}),
  };
}

function cleanExpiredJobs() {
  const expiry = Date.now() - RETENTION_MS;
  for (const [key, job] of jobs) {
    if (job.completedAt && job.completedAt < expiry) {
      if (job.outputPath) void removeExpiredFile(job.outputPath);
      if (job.thumbnailPath) void removeExpiredFile(job.thumbnailPath);
      jobs.delete(key);
    }
  }
}

async function removeExpiredFile(filePath) {
  try {
    await rm(filePath, { force: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "renderer.output_cleanup_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
  }
}

setInterval(cleanExpiredJobs, 60 * 60 * 1000).unref();

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (request.method === "GET" && url.pathname === "/health")
    return sendJson(response, 200, { status: "ok" });
  if (!authorized(request)) return sendJson(response, 401, { error: "Unauthorized." });
  if (request.method === "POST" && url.pathname === "/jobs") {
    let body;
    try {
      body = await readJson(request);
    } catch {
      return sendJson(response, 400, { error: "Invalid render request." });
    }
    const { id, ownerId, sourceUrl, duration, sourceStart, options } = body ?? {};
    if (
      typeof id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(id) ||
      typeof ownerId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(ownerId) ||
      !validateSourceUrl(sourceUrl)
    ) {
      return sendJson(response, 400, { error: "Invalid source video or job identifier." });
    }
    const settingsError = validateReelExportOptions(options, duration);
    if (settingsError) return sendJson(response, 400, { error: settingsError });
    if (!Number.isFinite(sourceStart) || sourceStart < 0 || sourceStart + duration > 600)
      return sendJson(response, 400, { error: "Invalid source trim start." });
    if (jobs.has(id)) return sendJson(response, 409, { error: "This render job already exists." });
    if (activeJobs >= MAX_ACTIVE_JOBS)
      return sendJson(response, 429, { error: "The renderer is busy. Try again shortly." });
    const job = {
      id,
      ownerId,
      sourceUrl,
      duration,
      sourceStart,
      options,
      status: "queued",
      progress: 0,
    };
    jobs.set(id, job);
    void render(job).catch((error) => {
      job.status = "failed";
      job.progress = 0;
      job.message = "The renderer could not complete this job.";
      job.completedAt = Date.now();
      console.error(
        JSON.stringify({
          event: "renderer.job_failed",
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    });
    return sendJson(response, 202, statusFor(job));
  }
  const match = /^\/jobs\/([0-9a-f-]{36})\/([0-9a-f-]{36})(?:\/(output|thumbnail))?$/i.exec(
    url.pathname,
  );
  if (request.method !== "GET" || !match) return sendJson(response, 404, { error: "Not found." });
  const [, ownerId, id, file] = match;
  const job = jobs.get(id);
  if (!job || job.ownerId !== ownerId)
    return sendJson(response, 404, { error: "Export job not found." });
  if (!file) return sendJson(response, 200, statusFor(job));
  if (job.status !== "completed")
    return sendJson(response, 409, { error: "The export is not ready." });
  const filePath = file === "output" ? job.outputPath : job.thumbnailPath;
  if (!filePath) return sendJson(response, 404, { error: "Export file not found." });
  const extension = file === "thumbnail" ? "jpg" : job.options.container;
  const contentType =
    file === "thumbnail"
      ? "image/jpeg"
      : job.options.container === "mp4"
        ? "video/mp4"
        : "video/quicktime";
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": String((await stat(filePath)).size),
    "Content-Disposition": `attachment; filename="velori-reel-${id}.${extension}"`,
    "Cache-Control": "private, no-store",
  });
  await pipeline(createReadStream(filePath), response);
});

server.listen(PORT, "0.0.0.0", () => {
  const address = server.address();
  const listeningPort = address && typeof address === "object" ? address.port : PORT;
  console.log(`VELORI FFmpeg renderer listening on ${listeningPort}`);
});
