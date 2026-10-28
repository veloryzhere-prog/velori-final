import { test } from "node:test";
import assert from "node:assert/strict";
import { handleTranscription } from "./transcription.ts";
const token = "x".repeat(40),
  user = "11111111-1111-4111-8111-111111111111";
const config = {
  enabled: true,
  url: "https://trusted.example/transcribe",
  token,
  authenticate: async (t: string) => (t === "verified" ? user : null),
};
function request(auth = "verified") {
  const f = new FormData();
  f.set("audio", new Blob(["audio"], { type: "audio/wav" }), "a.wav");
  return new Request("https://edge.example/transcribe", {
    method: "POST",
    headers: { authorization: "Bearer " + auth, "x-velori-user": "forged" },
    body: f,
  });
}
test("proxy authenticates a real session and fails closed without configuration", async () => {
  assert.equal((await handleTranscription(request("invalid"), config)).status, 401);
  assert.equal((await handleTranscription(request(), { ...config, enabled: false })).status, 503);
  assert.equal(
    (await handleTranscription(request(), { ...config, url: "http://localhost/transcribe" }))
      .status,
    503,
  );
});
test("proxy replaces caller identity with verified identity and forwards only bounded transcript", async () => {
  const response = await handleTranscription(request(), {
    ...config,
    fetcher: async (_url, init) => {
      assert.equal(new Headers(init?.headers).get("x-velori-user"), user);
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer " + token);
      assert.equal(init?.redirect, "error");
      return Response.json({ transcription: "Hello VELORI", private: "not forwarded" });
    },
  });
  assert.deepEqual(await response.json(), { transcription: "Hello VELORI" });
});
test("oversized payload and malformed worker output are refused", async () => {
  const r = request();
  r.headers.set("content-length", "9000000");
  assert.equal((await handleTranscription(r, config)).status, 413);
  const response = await handleTranscription(request(), {
    ...config,
    fetcher: async () => Response.json({ transcription: 123 }),
  });
  assert.equal(response.status, 502);
});
