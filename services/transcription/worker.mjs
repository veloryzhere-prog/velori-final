import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, isAbsolute } from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
export const MAX_UPLOAD = 8 * 1024 * 1024;
const runFile = promisify(execFile);
const types = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
]);
export class WorkerError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export async function transcribe(audio, config, run = runFile) {
  for (const name of ["ffmpeg", "ffprobe", "whisper", "model"])
    if (!isAbsolute(config[name] || ""))
      throw new WorkerError("Transcription is not configured.", 503);
  const directory = await mkdtemp(join(config.tempRoot || tmpdir(), "velori-whisper-"));
  try {
    const input = join(directory, "input"),
      output = join(directory, "audio.wav");
    await writeFile(input, audio);
    const options = { shell: false, windowsHide: true, timeout: 15000, maxBuffer: 256000 };
    const probe = await run(
      config.ffprobe,
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        "wav,mp3,mov,matroska,webm,ogg",
        "-show_entries",
        "format=duration:stream=codec_type",
        "-of",
        "json",
        input,
      ],
      options,
    );
    const info = JSON.parse(probe.stdout);
    const seconds = Number(info.format?.duration);
    if (
      !Number.isFinite(seconds) ||
      seconds <= 0 ||
      seconds > 120 ||
      !info.streams?.some((s) => s.codec_type === "audio")
    )
      throw new WorkerError("Choose an audio clip up to two minutes.");
    await run(
      config.ffmpeg,
      [
        "-nostdin",
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        "wav,mp3,mov,matroska,webm,ogg",
        "-i",
        input,
        "-map",
        "0:a:0",
        "-vn",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        "-t",
        "120",
        "-threads",
        "2",
        output,
      ],
      options,
    );
    const result = await run(
      config.whisper,
      ["-m", config.model, "-f", output, "-nt", "-np", "-t", "4"],
      { ...options, timeout: 45000 },
    );
    const text = result.stdout.trim();
    if (text.length > 50000) throw new WorkerError("Transcription output exceeded its limit.", 502);
    return { transcription: text };
  } finally {
    // Only the freshly created task directory is removed.
    await rm(directory, { recursive: true, force: true });
  }
}
async function readBounded(request) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_UPLOAD + 65536))
    throw new WorkerError("Choose an audio file up to 8 MiB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new WorkerError("Audio is required.");
  const chunks = [];
  let size = 0;
  let expire;
  const deadline = new Promise((_, reject) => {
    expire = setTimeout(() => {
      void reader.cancel();
      reject(new WorkerError("Upload timed out.", 408));
    }, 15000);
  });
  try {
    while (true) {
      const part = await Promise.race([reader.read(), deadline]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_UPLOAD + 65536)
        throw new WorkerError("Choose an audio file up to 8 MiB.", 413);
      chunks.push(part.value);
    }
  } finally {
    clearTimeout(expire);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export function createHandler({ token, config, perform = transcribe, now = Date.now }) {
  if (typeof token !== "string" || token.length < 32)
    throw new Error("Configure a worker token of at least 32 characters.");
  const digest = (v) => createHash("sha256").update(v).digest();
  let active = false;
  const users = new Map();
  return async (request) => {
    const reply = (body, status = 200) =>
      Response.json(body, {
        status,
        headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      });
    if (request.method !== "POST" || new URL(request.url).pathname !== "/transcribe")
      return reply({ error: "Not found." }, 404);
    if (
      !timingSafeEqual(
        digest(request.headers.get("authorization") || ""),
        digest("Bearer " + token),
      )
    )
      return reply({ error: "Unauthorized." }, 401);
    const user = request.headers.get("x-velori-user");
    if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(user || ""))
      return reply({ error: "A verified user is required." }, 401);
    if (active) return reply({ error: "Transcription is busy. Try again shortly." }, 429);
    const time = now();
    for (const [id, last] of users) if (time - last >= 60000) users.delete(id);
    if (users.has(user) || users.size >= 5000)
      return reply({ error: "Try again in one minute." }, 429);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
      return reply({ error: "Upload multipart audio." }, 415);
    active = true;
    users.set(user, time);
    try {
      const bytes = await readBounded(request);
      const form = await new Request("https://worker.invalid", {
        method: "POST",
        headers: { "content-type": request.headers.get("content-type") },
        body: bytes,
      }).formData();
      const audio = form.get("audio");
      if (audio instanceof Blob && audio.size > MAX_UPLOAD)
        throw new WorkerError("Choose an audio file up to 8 MiB.", 413);
      if (!(audio instanceof Blob) || audio.size === 0 || !types.has(audio.type))
        throw new WorkerError("Choose a supported audio file up to 8 MiB.");
      return reply(await perform(new Uint8Array(await audio.arrayBuffer()), config));
    } catch (error) {
      return reply(
        {
          error:
            error instanceof WorkerError
              ? error.message
              : "Transcription could not finish. Try a shorter audio clip.",
        },
        error instanceof WorkerError ? error.status : 502,
      );
    } finally {
      active = false;
    }
  };
}
