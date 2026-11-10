import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../public/service-worker.js", import.meta.url), "utf8");
function harness(fetcher = async () => new Response("online")) {
  const handlers = {},
    saved = new Map(),
    timers = new Map();
  let failOffline = false,
    serial = 0;
  const key = (request) => (typeof request === "string" ? request : request.url);
  const cache = {
    add: async (request) => {
      if (failOffline && key(request).endsWith("offline.html"))
        throw Error("offline asset unavailable");
      saved.set(key(request), new Response("<h1>Reconnect</h1>"));
    },
    match: async (request) => saved.get(key(request))?.clone(),
    put: async (request, response) => saved.set(key(request), response),
    keys: async () => [...saved.keys()].map((url) => new Request(url)),
    delete: async (request) => saved.delete(key(request)),
  };
  const displayed = [],
    opened = [];
  const self = {
    registration: {
      scope: "https://velori.test/",
      showNotification: async (title, options) => displayed.push({ title, ...options }),
    },
    location: { origin: "https://velori.test" },
    clients: {
      claim: async () => {},
      matchAll: async () => [],
      openWindow: async (url) => opened.push(url),
    },
    addEventListener: (name, handler) => (handlers[name] = handler),
  };
  vm.runInNewContext(source, {
    self,
    caches: {
      open: async () => cache,
      keys: async () => ["velori-static-v2"],
      delete: async () => true,
    },
    fetch: fetcher,
    Request,
    Response,
    URL,
    AbortController,
    setTimeout: (callback) => {
      timers.set(++serial, callback);
      return serial;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    displayed,
    opened,
    push: (payload) => {
      let promise;
      handlers.push({ data: { json: () => payload }, waitUntil: (task) => (promise = task) });
      return promise;
    },
    click: (url) => {
      let promise;
      handlers.notificationclick({
        notification: { data: { url }, close: () => {} },
        waitUntil: (task) => (promise = task),
      });
      return promise;
    },
    saved,
    timers,
    setFailOffline: () => (failOffline = true),
    install: () => {
      let promise;
      handlers.install({ waitUntil: (task) => (promise = task) });
      return promise;
    },
    request: (path, mode = "navigate") => {
      let promise;
      handlers.fetch({
        request: { method: "GET", url: "https://velori.test" + path, mode },
        respondWith: (task) => (promise = task),
      });
      return promise;
    },
  };
}
test("network failure serves cached recovery on a deep URL with 503 and no-store", async () => {
  const worker = harness(async () => {
    throw TypeError("network");
  });
  await worker.install();
  const result = await worker.request("/profile/someone");
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.match(await result.text(), /Reconnect/);
});
test("notification taps cannot escape to another origin through backslashes or protocol-relative links", async () => {
  const worker = harness();
  for (const url of [
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "javascript:alert(1)",
  ]) {
    await worker.push({ title: "VELORI", url });
    assert.equal(worker.displayed.at(-1).data.url, "/notifications");
    await worker.click(url);
    assert.equal(worker.opened.at(-1), "/notifications");
  }
  await worker.click("/messages?conversation=abc");
  assert.equal(worker.opened.at(-1), "/messages?conversation=abc");
});
test("server failures use recovery while 404 and sign-in responses remain intact", async () => {
  for (const status of [200, 401, 404, 500, 502, 503, 504]) {
    const worker = harness(async () => new Response("server", { status }));
    await worker.install();
    const result = await worker.request("/messages");
    assert.equal(result.status, status >= 500 ? 503 : status);
    assert.equal(await result.text(), status >= 500 ? "<h1>Reconnect</h1>" : "server");
  }
});
test("stalled navigation aborts and returns the cached recovery document", async () => {
  const worker = harness(
    (_request, options) =>
      new Promise((_resolve, reject) =>
        options.signal.addEventListener("abort", () => reject(Error("timeout"))),
      ),
  );
  await worker.install();
  const pending = worker.request("/reels");
  for (const timer of worker.timers.values()) timer();
  assert.equal((await pending).status, 503);
  assert.equal(worker.timers.size, 0);
});
test("new installation fails if its required recovery document cannot be cached", async () => {
  const worker = harness();
  worker.setFailOffline();
  await assert.rejects(worker.install(), /offline asset unavailable/);
});
test("installation caches no authenticated page HTML", async () => {
  const worker = harness();
  await worker.install();
  assert.equal(worker.saved.has("https://velori.test/"), false);
  assert.equal(worker.saved.has("https://velori.test/offline.html"), true);
});
test("API data and connection probes bypass static caching", () => {
  const worker = harness();
  assert.equal(worker.request("/rest/v1/messages", "cors"), undefined);
  assert.equal(worker.request("/home?velori_connection_check=1", "cors"), undefined);
});
test("asset eviction preserves the offline recovery document", async () => {
  const worker = harness(async () => {
    const response = new Response("body", { headers: { "content-type": "text/css" } });
    Object.defineProperty(response, "type", { value: "basic" });
    return response;
  });
  await worker.install();
  for (let i = 0; i < 121; i++)
    worker.saved.set("https://velori.test/assets/old-abcdefgh" + i + ".css", new Response("css"));
  await worker.request("/assets/new-abcdefgh.css", "cors");
  assert.equal(worker.saved.has("https://velori.test/offline.html"), true);
});
test("storage failure still yields a readable service-unavailable response", async () => {
  const worker = harness(async () => {
    throw Error("offline");
  });
  const result = await worker.request("/stories");
  assert.equal(result.status, 503);
  assert.match(await result.text(), /VELORI is unavailable/);
});
