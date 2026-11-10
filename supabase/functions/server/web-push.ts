import { importPKCS8, SignJWT } from "jose";

const encoder = new TextEncoder();
const MAX_PAYLOAD_BYTES = 3800;
const MAX_ATTEMPTS = 3;
const ALLOWED_ENDPOINT_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
];

export type WebPushSubscription = {
  id?: string;
  profile_id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type WebPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type WebPushOutcome = {
  status: "accepted" | "expired" | "failed";
  attempts: number;
  responseStatus: number | null;
  errorCode: string | null;
};

type WebPushOptions = {
  publicKey: string;
  privateKey: string;
  subject: string;
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
};

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_base64url");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
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

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(value.byteLength);
  new Uint8Array(buffer).set(value);
  return buffer;
}

function isAllowedPushEndpoint(value: string) {
  try {
    const endpoint = new URL(value);
    return (
      endpoint.protocol === "https:" &&
      !endpoint.username &&
      !endpoint.password &&
      (!endpoint.port || endpoint.port === "443") &&
      ALLOWED_ENDPOINT_HOSTS.some(
        (host) => endpoint.hostname === host || endpoint.hostname.endsWith(`.${host}`),
      )
    );
  } catch {
    return false;
  }
}

export function validWebPushConfiguration(options: WebPushOptions) {
  try {
    const publicKey = decodeBase64Url(options.publicKey);
    return (
      publicKey.length === 65 &&
      publicKey[0] === 4 &&
      options.privateKey.includes("-----BEGIN PRIVATE KEY-----") &&
      /^(?:mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/i.test(options.subject)
    );
  } catch {
    return false;
  }
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
    previous = await hmac(prk, concatenate(previous, info, Uint8Array.of(counter)));
    const size = Math.min(previous.length, length - offset);
    output.set(previous.subarray(0, size), offset);
    offset += size;
  }
  return output;
}

async function encryptPayload(subscription: WebPushSubscription, payload: WebPushPayload) {
  const clientPublicKey = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  if (clientPublicKey.length !== 65 || clientPublicKey[0] !== 4 || authSecret.length < 16) {
    throw new Error("invalid_subscription_keys");
  }

  const clientKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(clientPublicKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKeyPair.publicKey),
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      serverKeyPair.privateKey,
      256,
    ),
  );

  const keyPrk = await hmac(authSecret, sharedSecret);
  const keyInfo = concatenate(encoder.encode("WebPush: info\0"), clientPublicKey, serverPublicKey);
  const inputKeyMaterial = await hkdfExpand(keyPrk, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentPrk = await hmac(salt, inputKeyMaterial);
  const contentKey = await hkdfExpand(
    contentPrk,
    encoder.encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdfExpand(contentPrk, encoder.encode("Content-Encoding: nonce\0"), 12);
  const body = encoder.encode(JSON.stringify(payload));
  if (body.length + 1 > MAX_PAYLOAD_BYTES) throw new Error("payload_too_large");
  const plaintext = concatenate(body, Uint8Array.of(2));
  const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toArrayBuffer(nonce) },
      aesKey,
      toArrayBuffer(plaintext),
    ),
  );

  const recordHeader = concatenate(
    salt,
    Uint8Array.of(0, 0, 16, 0),
    Uint8Array.of(serverPublicKey.length),
    serverPublicKey,
  );
  return concatenate(recordHeader, ciphertext);
}

function retryDelay(response: Response | null, attempt: number) {
  const header = response?.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(100, Math.min(3000, seconds * 1000));
    const timestamp = Date.parse(header);
    if (Number.isFinite(timestamp)) return Math.max(100, Math.min(3000, timestamp - Date.now()));
  }
  return Math.min(250 * 2 ** (attempt - 1), 1000);
}

export async function createWebPushSender(options: WebPushOptions) {
  if (!validWebPushConfiguration(options)) throw new Error("web_push_not_configured");
  const publicKey = decodeBase64Url(options.publicKey);
  const privateKey = await importPKCS8(options.privateKey, "ES256");
  const fetcher = options.fetcher ?? fetch;
  const sleep =
    options.sleep ??
    ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

  return async function send(
    subscription: WebPushSubscription,
    payload: WebPushPayload,
  ): Promise<WebPushOutcome> {
    if (!isAllowedPushEndpoint(subscription.endpoint)) {
      return { status: "failed", attempts: 0, responseStatus: null, errorCode: "invalid_endpoint" };
    }

    let body: Uint8Array;
    try {
      body = await encryptPayload(subscription, payload);
    } catch (error) {
      const code = error instanceof Error ? error.message : "encryption_failed";
      return {
        status: "failed",
        attempts: 0,
        responseStatus: null,
        errorCode: code === "payload_too_large" ? code : "invalid_subscription",
      };
    }

    const endpoint = new URL(subscription.endpoint);
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256" })
      .setAudience(endpoint.origin)
      .setExpirationTime(Math.floor(Date.now() / 1000) + 12 * 60 * 60)
      .setSubject(options.subject)
      .sign(privateKey);

    let response: Response | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        response = await fetcher(subscription.endpoint, {
          method: "POST",
          headers: {
            authorization: `vapid t=${token}, k=${options.publicKey}`,
            "content-encoding": "aes128gcm",
            "content-type": "application/octet-stream",
            ttl: "86400",
            urgency: "normal",
          },
          body: toArrayBuffer(body),
          signal: AbortSignal.timeout(10_000),
          redirect: "manual",
        });
      } catch {
        if (attempt === MAX_ATTEMPTS) {
          return {
            status: "failed",
            attempts: attempt,
            responseStatus: null,
            errorCode: "provider_unreachable",
          };
        }
        await sleep(retryDelay(null, attempt));
        continue;
      }

      if (response.ok) {
        return {
          status: "accepted",
          attempts: attempt,
          responseStatus: response.status,
          errorCode: null,
        };
      }
      if (response.status === 404 || response.status === 410) {
        return {
          status: "expired",
          attempts: attempt,
          responseStatus: response.status,
          errorCode: "subscription_expired",
        };
      }
      const retryable =
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS) {
        return {
          status: "failed",
          attempts: attempt,
          responseStatus: response.status,
          errorCode: `provider_http_${response.status}`,
        };
      }
      await sleep(retryDelay(response, attempt));
    }
    return {
      status: "failed",
      attempts: MAX_ATTEMPTS,
      responseStatus: response?.status ?? null,
      errorCode: "delivery_failed",
    };
  };
}
