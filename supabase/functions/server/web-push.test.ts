import { validWebPushConfiguration, createWebPushSender } from "./web-push.ts";

const encode = (value: Uint8Array) => {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};
const decodeBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};
function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}
async function hmac(keyBytes: Uint8Array, value: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, toArrayBuffer(value)));
}
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number) {
  const output = new Uint8Array(length);
  let previous = new Uint8Array();
  let offset = 0;
  for (let counter = 1; offset < length; counter += 1) {
    const input = new Uint8Array(previous.length + info.length + 1);
    input.set(previous);
    input.set(info, previous.length);
    input[input.length - 1] = counter;
    previous = await hmac(prk, input);
    const size = Math.min(previous.length, length - offset);
    output.set(previous.subarray(0, size), offset);
    offset += size;
  }
  return output;
}
function concatenate(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function keys() {
  const [subscriber, vapid] = await Promise.all([
    crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]),
    crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]),
  ]);
  return {
    subscriber,
    vapidPrivateKey: await crypto.subtle.exportKey("pkcs8", vapid.privateKey),
    vapidPublicKey: encode(new Uint8Array(await crypto.subtle.exportKey("raw", vapid.publicKey))),
  };
}

function pem(bytes: ArrayBuffer) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
}

async function fixture() {
  const generated = await keys();
  const subscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
    p256dh: encode(
      new Uint8Array(await crypto.subtle.exportKey("raw", generated.subscriber.publicKey)),
    ),
    auth: encode(crypto.getRandomValues(new Uint8Array(16))),
  };
  const options = {
    publicKey: generated.vapidPublicKey,
    privateKey: pem(generated.vapidPrivateKey),
    subject: "mailto:push@veloryz.online",
  };
  return { ...generated, subscription, options };
}

Deno.test("Web Push sends an encrypted aes128gcm payload with a scoped VAPID token", async () => {
  const test = await fixture();
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const send = await createWebPushSender({
    ...test.options,
    fetcher: async (url, init) => {
      requestUrl = String(url);
      requestInit = init;
      return new Response(null, { status: 201 });
    },
  });
  const result = await send(test.subscription, {
    title: "VELORI update",
    body: "A new activity is ready.",
    url: "/notifications",
    tag: "campaign-1",
  });

  if (result.status !== "accepted" || result.responseStatus !== 201 || result.attempts !== 1) {
    throw new Error("A successful push service response must be recorded as accepted.");
  }
  if (requestUrl !== test.subscription.endpoint) {
    throw new Error("The encrypted payload must be sent to the stored subscription endpoint.");
  }
  const headers = new Headers(requestInit?.headers);
  if (requestInit?.redirect !== "manual") {
    throw new Error("Push endpoint redirects must not be followed.");
  }
  if (headers.get("content-encoding") !== "aes128gcm") {
    throw new Error("The push payload must use the aes128gcm content encoding.");
  }
  const authorization = headers.get("authorization") ?? "";
  if (
    !authorization.startsWith("vapid t=") ||
    !authorization.includes(`k=${test.options.publicKey}`)
  ) {
    throw new Error("The request must carry the configured VAPID public key and token.");
  }
  const token = authorization.match(/^vapid t=([^,]+)/)?.[1];
  if (!token) throw new Error("The VAPID token is missing.");
  const claims = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  if (
    claims.aud !== "https://fcm.googleapis.com" ||
    claims.sub !== test.options.subject ||
    typeof claims.exp !== "number"
  ) {
    throw new Error("The VAPID token must be scoped to the endpoint origin and subject.");
  }
  const encrypted = new Uint8Array(requestInit?.body as ArrayBuffer);
  const salt = encrypted.subarray(0, 16);
  const recordSize = new DataView(encrypted.buffer, encrypted.byteOffset + 16, 4).getUint32(0);
  const serverKeyLength = encrypted[20];
  if (
    encrypted.length < 21 + 65 + 16 ||
    recordSize !== 4096 ||
    serverKeyLength !== 65 ||
    encrypted[0] === undefined
  ) {
    throw new Error("The request body must contain a complete encrypted Web Push record.");
  }
  const serverPublicKeyBytes = encrypted.subarray(21, 21 + serverKeyLength);
  const serverPublicKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(serverPublicKeyBytes),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: serverPublicKey },
      test.subscriber.privateKey,
      256,
    ),
  );
  const clientPublicKey = decodeBase64Url(test.subscription.p256dh);
  const authSecret = decodeBase64Url(test.subscription.auth);
  const keyInfo = concatenate(
    new TextEncoder().encode("WebPush: info\0"),
    clientPublicKey,
    serverPublicKeyBytes,
  );
  const inputKeyMaterial = await hkdfExpand(await hmac(authSecret, sharedSecret), keyInfo, 32);
  const contentPrk = await hmac(salt, inputKeyMaterial);
  const contentKey = await hkdfExpand(
    contentPrk,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdfExpand(
    contentPrk,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12,
  );
  const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["decrypt"]);
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(nonce) },
      aesKey,
      toArrayBuffer(encrypted.subarray(21 + serverKeyLength)),
    ),
  );
  if (plaintext.at(-1) !== 2) {
    throw new Error("The decrypted payload must include the final-record delimiter.");
  }
  const payload = JSON.parse(new TextDecoder().decode(plaintext.subarray(0, -1)));
  if (
    payload.title !== "VELORI update" ||
    payload.body !== "A new activity is ready." ||
    payload.url !== "/notifications" ||
    payload.tag !== "campaign-1"
  ) {
    throw new Error("The encrypted payload must decrypt to the exact notification content.");
  }
});

Deno.test("Web Push rejects untrusted subscription endpoints without making a request", async () => {
  const test = await fixture();
  let requests = 0;
  const send = await createWebPushSender({
    ...test.options,
    fetcher: async () => {
      requests += 1;
      return new Response(null, { status: 201 });
    },
  });
  const result = await send(
    { ...test.subscription, endpoint: "https://127.0.0.1/private" },
    { title: "Test", body: "Test", url: "/notifications", tag: "test" },
  );
  if (result.status !== "failed" || result.errorCode !== "invalid_endpoint" || requests !== 0) {
    throw new Error("Untrusted endpoints must be rejected before the server makes a request.");
  }
  const nonstandardPortResult = await send(
    { ...test.subscription, endpoint: "https://fcm.googleapis.com:8443/fcm/send/test" },
    { title: "Test", body: "Test", url: "/notifications", tag: "test" },
  );
  if (nonstandardPortResult.status !== "failed" || requests !== 0) {
    throw new Error("Push endpoints on nonstandard ports must be rejected.");
  }
});

Deno.test("Web Push removes expired endpoints based on the provider response", async () => {
  const test = await fixture();
  const send = await createWebPushSender({
    ...test.options,
    fetcher: async () => new Response(null, { status: 410 }),
  });
  const result = await send(test.subscription, {
    title: "Test",
    body: "Test",
    url: "/notifications",
    tag: "test",
  });
  if (result.status !== "expired" || result.errorCode !== "subscription_expired") {
    throw new Error("An expired endpoint must be reported for server-side cleanup.");
  }
});

Deno.test("Web Push retries transient provider failures and reports the final attempt", async () => {
  const test = await fixture();
  let attempts = 0;
  const send = await createWebPushSender({
    ...test.options,
    sleep: async () => {},
    fetcher: async () => {
      attempts += 1;
      return attempts < 3
        ? new Response(null, { status: 503 })
        : new Response(null, { status: 201 });
    },
  });
  const result = await send(test.subscription, {
    title: "Test",
    body: "Test",
    url: "/notifications",
    tag: "test",
  });
  if (result.status !== "accepted" || result.attempts !== 3 || attempts !== 3) {
    throw new Error("Transient push failures must use bounded retries.");
  }
});

Deno.test("Web Push configuration rejects malformed public keys and subjects", async () => {
  const test = await fixture();
  if (!validWebPushConfiguration(test.options)) {
    throw new Error("Valid VAPID key material and subject must be accepted.");
  }
  if (
    validWebPushConfiguration({
      ...test.options,
      publicKey: "not-a-public-key",
    }) ||
    validWebPushConfiguration({
      ...test.options,
      subject: "javascript:alert(1)",
    })
  ) {
    throw new Error("Malformed VAPID configuration must fail closed.");
  }
});
