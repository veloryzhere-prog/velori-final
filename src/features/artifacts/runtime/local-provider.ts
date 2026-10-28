/* Copyright © 2026 VELORYZ. Explicit local inference; never falls back to a remote provider. */
export function localEndpoint(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error("Use an HTTP localhost base URL with a port, without credentials or a path.");
  if (!url.port) throw Error("Specify the local model server port.");
  return url.origin;
}
export async function localConversation(
  config: { endpoint: string; model: string },
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  signal: AbortSignal,
) {
  const endpoint = localEndpoint(config.endpoint);
  if (!config.model.trim() || config.model.length > 150)
    throw Error("Choose a model installed in your local server.");
  const response = await fetch(`${endpoint}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    credentials: "omit",
    redirect: "error",
    body: JSON.stringify({ model: config.model, messages, stream: false }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw Error(
      `Local model request failed (${response.status}). Check its model and allowed browser origins.`,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw Error("Empty local model response.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 3000000) throw Error("Local model response is too large.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const part of chunks) {
    merged.set(part, offset);
    offset += part.length;
  }
  const data = JSON.parse(new TextDecoder().decode(merged));
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw Error("Local model returned no answer.");
  return text;
}
