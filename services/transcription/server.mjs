import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createHandler } from "./worker.mjs";
const handler = createHandler({
  token: process.env.VELORI_TRANSCRIPTION_WORKER_TOKEN,
  config: {
    ffmpeg: process.env.FFMPEG_BINARY_PATH,
    ffprobe: process.env.FFPROBE_BINARY_PATH,
    whisper: process.env.WHISPER_BINARY_PATH,
    model: process.env.WHISPER_MODEL_PATH,
  },
});
const server = createServer(async (req, res) => {
  try {
    const request = new Request("http://worker.invalid" + req.url, {
      method: req.method,
      headers: req.headers,
      ...(req.method === "POST" ? { body: Readable.toWeb(req), duplex: "half" } : {}),
    });
    const result = await handler(request);
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(await result.text());
  } catch {
    res.writeHead(400, { "Cache-Control": "no-store" });
    res.end("Invalid request.");
  }
});
server.requestTimeout = 20000;
server.headersTimeout = 10000;
server.maxConnections = 16;
server.listen(Number(process.env.PORT || 8089), process.env.HOST || "127.0.0.1");
