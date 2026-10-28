export async function handleTranscription(
  request: Request,
  config: {
    enabled: boolean;
    url: string;
    token: string;
    authenticate: (token: string) => Promise<string | null>;
    fetcher?: typeof fetch;
  },
) {
  const reply = (body: unknown, status = 200) => Response.json(body, { status });
  const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!bearer) return reply({ error: "Sign in to transcribe audio." }, 401);
  const user = await config.authenticate(bearer).catch(() => null);
  if (!user) return reply({ error: "Sign in to transcribe audio." }, 401);
  let destination: URL;
  try {
    destination = new URL(config.url);
  } catch {
    return reply({ error: "Transcription awaits worker setup." }, 503);
  }
  if (
    !config.enabled ||
    config.token.length < 32 ||
    destination.protocol !== "https:" ||
    destination.username ||
    destination.password ||
    destination.search ||
    destination.hash ||
    destination.pathname !== "/transcribe"
  )
    return reply({ error: "Transcription awaits worker setup." }, 503);
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("multipart/form-data;"))
    return reply({ error: "Upload multipart audio." }, 415);
  const limit = 8 * 1024 * 1024 + 65536;
  if (Number(request.headers.get("content-length")) > limit)
    return reply({ error: "Audio upload is too large." }, 413);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Audio is required." }, 400);
  const deadline = AbortSignal.timeout(15000);
  const abort = new Promise<never>((_, reject) =>
    deadline.addEventListener(
      "abort",
      () => {
        void reader.cancel();
        reject(new Error("timeout"));
      },
      { once: true },
    ),
  );
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await Promise.race([reader.read(), abort]);
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) return reply({ error: "Audio upload is too large." }, 413);
      parts.push(part.value);
    }
  } catch {
    return reply({ error: "Audio upload failed or timed out." }, 408);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.byteLength;
  }
  try {
    const upstream = await (config.fetcher || fetch)(destination, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(75000),
      headers: {
        authorization: "Bearer " + config.token,
        "content-type": type,
        "x-velori-user": user,
      },
      body: body.buffer,
    });
    if (!upstream.ok)
      return reply(
        {
          error:
            upstream.status === 429
              ? "Transcription is busy. Try again shortly."
              : "Transcription could not finish.",
        },
        upstream.status === 429 ? 429 : 502,
      );
    const outputReader = upstream.body?.getReader();
    if (!outputReader) throw new Error();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const p = await outputReader.read();
        if (p.done) break;
        bytes += p.value.byteLength;
        if (bytes > 65536) throw new Error();
        chunks.push(p.value);
      }
    } finally {
      await outputReader.cancel().catch(() => {});
      outputReader.releaseLock();
    }
    const output = new Uint8Array(bytes);
    let i = 0;
    for (const p of chunks) {
      output.set(p, i);
      i += p.byteLength;
    }
    const data = JSON.parse(new TextDecoder().decode(output));
    if (typeof data.transcription !== "string" || data.transcription.length > 50000)
      throw new Error();
    return reply({ transcription: data.transcription });
  } catch {
    return reply({ error: "Transcription is temporarily unavailable." }, 502);
  }
}
