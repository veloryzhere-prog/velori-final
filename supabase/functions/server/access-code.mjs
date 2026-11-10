const encoder = new TextEncoder();

export const DEFAULT_ACCESS_CODE_ITERATIONS = 210_000;

/** @param {string} value */
function bytesFromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** @param {Uint8Array} bytes */
function base64FromBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** @param {string} code @param {Uint8Array} salt @param {number} iterations */
async function derive(code, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(code), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** @param {string} leftValue @param {string} rightValue */
export function timingSafeEqualString(leftValue, rightValue) {
  const left = encoder.encode(leftValue);
  const right = encoder.encode(rightValue);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

/** @param {string} code @param {number} [iterations] */
export async function hashAccessCode(code, iterations = DEFAULT_ACCESS_CODE_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(code, salt, iterations);
  return `pbkdf2$${iterations}$${base64FromBytes(salt)}$${base64FromBytes(derived)}`;
}

/**
 * Malformed or unsupported stored values fail closed.
 * @param {string} code
 * @param {string} stored
 */
export async function verifyAccessCode(code, stored) {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 1_000_000) {
    return false;
  }
  try {
    const expected = bytesFromBase64(parts[3]);
    const actual = await derive(code, bytesFromBase64(parts[2]), iterations);
    if (expected.length !== actual.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected[index] ^ actual[index];
    }
    return difference === 0;
  } catch {
    return false;
  }
}

/** @param {string} code @param {string} setupSecret @param {{code_hash: string, enabled: boolean} | null} storedCode */
export async function verifyBootstrapCode(code, setupSecret, storedCode) {
  const matchesSecret =
    !storedCode && Boolean(setupSecret) && timingSafeEqualString(code, setupSecret);
  const matchesStored = Boolean(
    storedCode?.enabled && (await verifyAccessCode(code, storedCode.code_hash)),
  );
  return { matchesSecret, matchesStored };
}
