import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHandler, transcribe, MAX_UPLOAD } from "./worker.mjs";
const token = "test-worker-token-with-at-least-32-characters";
const user = "11111111-1111-4111-8111-111111111111";
function request({ auth = token, type = "audio/wav", bytes = 3 } = {}) {
  const f = new FormData();
  f.append("audio", new Blob([new Uint8Array(bytes)], { type }), "evil;name.wav");
  return new Request("https://worker.invalid/transcribe", {
    method: "POST",
    headers: { authorization: "Bearer " + auth, "x-velori-user": user },
    body: f,
  });
}
test("authentication, MIME, upload limits and per-user cooldown reject before processing", async () => {
  let calls = 0;
  const handler = () =>
    createHandler({
      token,
      perform: async () => {
        calls++;
        return { transcription: "hello" };
      },
    });
  assert.equal((await handler()(request({ auth: "wrong" }))).status, 401);
  assert.equal((await handler()(request({ type: "text/html" }))).status, 400);
  assert.equal((await handler()(request({ bytes: MAX_UPLOAD + 1 }))).status, 413);
  const h = handler();
  assert.equal((await h(request())).status, 200);
  assert.equal((await h(request())).status, 429);
  assert.equal(calls, 1);
});
test("only one transcription runs at once and failures release the slot", async () => {
  let finish;
  const h = createHandler({ token, perform: () => new Promise((r) => (finish = r)) });
  const first = h(request());
  while (!finish) await new Promise((r) => setTimeout(r, 1));
  const second = request();
  second.headers.set("x-velori-user", "22222222-2222-4222-8222-222222222222");
  assert.equal((await h(second)).status, 429);
  finish({ transcription: "ok" });
  assert.equal((await first).status, 200);
});
test("fixed executable argument arrays, duration checks and cleanup apply on success and errors", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "velori-worker-test-"));
  const config = {
    tempRoot,
    ffmpeg: join(tempRoot, "ffmpeg.exe"),
    ffprobe: join(tempRoot, "ffprobe.exe"),
    whisper: join(tempRoot, "whisper.exe"),
    model: join(tempRoot, "model.bin"),
  };
  try {
    const seen = [];
    const run = async (file, args, options) => {
      seen.push({ file, args, options });
      return {
        stdout:
          file === config.ffprobe
            ? JSON.stringify({ format: { duration: 3 }, streams: [{ codec_type: "audio" }] })
            : "hello",
      };
    };
    assert.deepEqual(await transcribe(new Uint8Array([1]), config, run), {
      transcription: "hello",
    });
    assert.equal(seen.length, 3);
    assert.ok(seen.every((x) => x.options.shell === false && x.options.timeout > 0));
    assert.ok(seen[1].args.includes("file,pipe"));
    assert.ok(seen.slice(0, 2).every((s) => s.args.includes("-format_whitelist")));
    assert.deepEqual(await readdir(tempRoot), []);
    await assert.rejects(
      transcribe(new Uint8Array([1]), config, async () => {
        throw Error("binary failed");
      }),
    );
    assert.deepEqual(await readdir(tempRoot), []);
    await assert.rejects(
      transcribe(new Uint8Array([1]), config, async () => ({
        stdout: JSON.stringify({ format: { duration: 121 }, streams: [{ codec_type: "audio" }] }),
      })),
      /two minutes/,
    );
    assert.deepEqual(await readdir(tempRoot), []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
