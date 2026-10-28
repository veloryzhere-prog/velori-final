import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  parsePages,
  parseGenerated,
  validateGeneratedCode,
  FORGE_GENERATION_INSTRUCTIONS,
  parseImage,
  tokenHash,
  boundedText,
  generate,
} from "./policy.ts";
import { seal, open, encryptionKey } from "./crypto.ts";
import { StripeClient, paymentMatches, verifyEvent, type Session } from "./payments.ts";
const page = { path: "index", html: "<h1>Hello</h1>", css: "", js: "" };
test("generation parsing rejects missing and oversized code", () => {
  assert.throws(() => parseGenerated({ title: "", pages: [page] }));
  assert.throws(() => parsePages([{ ...page, html: "🌸".repeat(200000) }]));
  assert.deepEqual(parseGenerated({ title: " App ", pages: [page] }), {
    title: "App",
    pages: [page],
  });
});
test("page validation rejects traversal, reserved paths, duplicates and missing home", () => {
  for (const pages of [
    [{ ...page, path: "../admin" }],
    [{ ...page, path: "constructor" }],
    [page, page],
    [{ ...page, path: "about" }],
    Array.from({ length: 9 }, (_, i) => ({ ...page, path: i ? `page-${i}` : "index" })),
  ])
    assert.throws(() => parsePages(pages));
});
test("image references require matching signatures and bounded base64", () => {
  assert.throws(() =>
    parseImage({ mimeType: "image/jpeg", data: btoa("This is a disguised text file") }),
  );
  assert.throws(() => parseImage({ mimeType: "image/svg+xml", data: btoa("<svg></svg>") }));
  const data = btoa("\xff\xd8\xff\xe0image-bytes");
  assert.deepEqual(parseImage({ mimeType: "image/jpeg", data }), { mimeType: "image/jpeg", data });
});
test("stream bounds and known token hashes are enforced", async () => {
  await assert.rejects(boundedText(new Response("too much"), 3), /size limit/);
  assert.equal(await boundedText(new Response("🌸"), 4), "🌸");
  assert.equal(
    await tokenHash("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
test("provider uses private headers/current pages and rejects truncated responses", async () => {
  let input = "";
  const fetcher: typeof fetch = async (url, init) => {
    assert.ok(!String(url).includes("private-key"));
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "private-key");
    input = String(init?.body);
    return new Response(
      JSON.stringify({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: JSON.stringify({ title: "App", pages: [page] }) }] },
          },
        ],
      }),
    );
  };
  assert.equal(
    (
      await generate(
        "private-key",
        "configured-model",
        "Change title",
        [page],
        new AbortController().signal,
        undefined,
        [],
        fetcher,
      )
    ).title,
    "App",
  );
  assert.ok(input.includes("currentPages"));
  await assert.rejects(
    generate(
      "k",
      "configured-model",
      "fix",
      [page],
      new AbortController().signal,
      undefined,
      [],
      async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        title: "App",
                        pages: [{ ...page, js: "const = invalid;" }],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        ),
    ),
    /syntax error/,
  );
  await assert.rejects(
    generate(
      "k",
      "configured-model",
      "x",
      [page],
      new AbortController().signal,
      undefined,
      [],
      async () => new Response(JSON.stringify({ candidates: [{ finishReason: "MAX_TOKENS" }] })),
    ),
    /Incomplete/,
  );
});
test("encrypted project source is owner-bound and rejects tampering", async () => {
  const key = await encryptionKey(
    btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i))),
  );
  const value = { pages: [page], history: [] };
  const stored = await seal(value, key, "project:owner:one");
  assert.ok(!JSON.stringify(stored).includes("<h1>"));
  assert.deepEqual(await open(stored, key, "project:owner:one"), value);
  await assert.rejects(open(stored, key, "project:outsider:one"));
  await assert.rejects(
    open(
      {
        ...stored,
        ciphertext: (stored.ciphertext[0] === "A" ? "B" : "A") + stored.ciphertext.slice(1),
      },
      key,
      "project:owner:one",
    ),
  );
});
test("encryption has no default, truncated or weak fallback key", async () => {
  for (const value of ["", btoa("short"), btoa("x".repeat(64))])
    await assert.rejects(encryptionKey(value));
});
test("webhook rejects altered bodies and replay timestamps but supports key rotation signatures", async () => {
  const raw = JSON.stringify({
    id: "evt_verified",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { id: "cs_verified" } },
  });
  const t = 1800000000;
  const sig = createHmac("sha256", "test-secret").update(`${t}.${raw}`).digest("hex");
  assert.equal(
    (await verifyEvent(raw, `t=${t},v1=${sig}`, "test-secret", t * 1000)).id,
    "evt_verified",
  );
  await assert.rejects(
    verifyEvent(raw.replace("verified", "tampered"), `t=${t},v1=${sig}`, "test-secret", t * 1000),
  );
  await assert.rejects(verifyEvent(raw, `t=${t},v1=${sig}`, "test-secret", (t + 301) * 1000));
  assert.equal(
    (await verifyEvent(raw, `t=${t},v1=${"0".repeat(64)},v1=${sig}`, "test-secret", t * 1000)).id,
    "evt_verified",
  );
});
test("paid fulfillment requires matching owner, SKU, amount, price, mode and currency", () => {
  const order = {
    id: "order",
    user_id: "owner",
    sku: "PACK100",
    price_id: "price_server",
    amount: 29900,
    currency: "inr",
    checkout_id: "cs_order",
    livemode: false,
  };
  const session: Session = {
    id: "cs_order",
    payment_status: "paid",
    status: "complete",
    payment_intent: "pi_payment",
    amount_total: 29900,
    currency: "inr",
    metadata: { veloriOrderId: "order", veloriUserId: "owner", veloriSku: "PACK100" },
    line_items: { data: [{ quantity: 1, price: { id: "price_server" } }] },
    livemode: false,
  };
  assert.equal(paymentMatches(session, order), true);
  for (const patch of [
    { payment_status: "unpaid" },
    { amount_total: 1 },
    { currency: "usd" },
    { livemode: true },
    { payment_intent: "" },
    { metadata: { ...session.metadata, veloriUserId: "outsider" } },
    { line_items: { data: [{ quantity: 2, price: { id: "price_server" } }] } },
  ])
    assert.equal(paymentMatches({ ...session, ...patch }, order), false);
});
test("checkout uses server-selected price, dynamic methods and order idempotency", async () => {
  let values = new URLSearchParams();
  const stripe = new StripeClient("server-test-key", async (_url, init) => {
    values = init?.body as URLSearchParams;
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "velori-studio-order-order-id");
    return new Response(
      JSON.stringify({ id: "cs_test", url: "https://checkout.stripe.com/example" }),
    );
  });
  await stripe.create(
    { id: "order-id", userId: "owner", sku: "PACK100", priceId: "price_configured" },
    "https://velori.example",
  );
  assert.equal(values.get("line_items[0][price]"), "price_configured");
  assert.ok(![...values.keys()].some((k) => k.startsWith("payment_method_types")));
  assert.match(values.get("integration_identifier")!, /^velori-forge-[a-z]{8}$/);
});

test("readiness fails closed until every cloud prerequisite is ready", async () => {
  const { capabilities } = await import("./runtime.ts");
  const ready = {
    database: true,
    encryption: true,
    serverEnabled: true,
    provider: true,
    generationEnabled: true,
    billing: true,
  };
  assert.equal(capabilities(ready).generation, true);
  for (const field of ["database", "encryption", "serverEnabled"] as const) {
    const state = capabilities({ ...ready, [field]: false });
    assert.equal(state.cloud, false);
    assert.equal(state.generation, false);
    assert.equal(state.billing, false);
  }
  assert.equal(capabilities({ ...ready, provider: false }).cloud, true);
  assert.equal(capabilities({ ...ready, provider: false }).generation, false);
  assert.equal(capabilities({ ...ready, generationEnabled: false }).generation, false);
});
test("protected runtime keys accept Supabase dictionaries without accepting malformed values", async () => {
  const { runtimeKey } = await import("./runtime.ts");
  const env: Record<string, string> = { DICT: '{"default":"private-fixture"}' };
  const read = (name: string) => env[name] ?? "";
  assert.equal(runtimeKey(read, ["DIRECT"], "DICT"), "private-fixture");
  env.DIRECT = "preferred-fixture";
  assert.equal(runtimeKey(read, ["DIRECT"], "DICT"), "preferred-fixture");
  delete env.DIRECT;
  env.DICT = '{"default":17}';
  assert.equal(runtimeKey(read, ["DIRECT"], "DICT"), "");
  env.DICT = "invalid";
  assert.equal(runtimeKey(read, ["DIRECT"], "DICT"), "");
});

test("generated syntax is compiled without running untrusted code", () => {
  assert.doesNotThrow(() =>
    validateGeneratedCode({
      title: "App",
      pages: [{ ...page, js: 'throw new Error("must never run")' }],
    }),
  );
  assert.throws(
    () => validateGeneratedCode({ title: "App", pages: [{ ...page, js: "const = ;" }] }),
    /syntax error/,
  );
});
test("generated code requires content and separated layers", () => {
  for (const html of [
    "",
    "  ",
    "<html><body>Hi</body></html>",
    "<script>alert(1)</script>",
    "<style>body{}</style>",
  ])
    assert.throws(() => validateGeneratedCode({ title: "App", pages: [{ ...page, html }] }));
  assert.equal(validateGeneratedCode({ title: "App", pages: [page] }).pages[0].html, page.html);
});
test("generation instructions preserve requests and require complete offline code", () => {
  for (const contract of [
    "Hinglish",
    "Return JSON only",
    "including unchanged pages",
    "#index",
    "320px",
    "prefers-reduced-motion",
    "Never request or output secrets",
  ])
    assert.ok(FORGE_GENERATION_INSTRUCTIONS.includes(contract));
});

test("provider 429 is classified as a provider quota failure without exposing credentials", async () => {
  await assert.rejects(
    generate("private-key", "configured-model", "create", [page], new AbortController().signal, undefined, [],
      async () => new Response("quota exceeded", {status: 429})),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "provider_quota"
      && !error.message.includes("private-key"),
  );
});
