export type Sealed = { format: "velori-sealed-v1"; nonce: string; ciphertext: string };
function encode(b: Uint8Array) {
  let s = "";
  for (let i = 0; i < b.length; i += 16384) s += String.fromCharCode(...b.subarray(i, i + 16384));
  return btoa(s);
}
const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function encryptionKey(value: string) {
  const b = decode(value);
  if (b.length !== 32) throw new Error("Studio requires a server-managed 32-byte encryption key.");
  return crypto.subtle.importKey("raw", b, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function seal(value: unknown, key: CryptoKey, context: string): Promise<Sealed> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: nonce,
      additionalData: new TextEncoder().encode(context),
      tagLength: 128,
    },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return {
    format: "velori-sealed-v1",
    nonce: encode(nonce),
    ciphertext: encode(new Uint8Array(data)),
  };
}
export async function open(value: unknown, key: CryptoKey, context: string): Promise<unknown> {
  const p = value as Sealed;
  if (
    !p ||
    p.format !== "velori-sealed-v1" ||
    typeof p.nonce !== "string" ||
    p.nonce.length !== 16 ||
    typeof p.ciphertext !== "string" ||
    p.ciphertext.length > 4000000
  )
    throw new Error("Invalid encrypted project.");
  const data = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decode(p.nonce),
      additionalData: new TextEncoder().encode(context),
      tagLength: 128,
    },
    key,
    decode(p.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(data));
}
