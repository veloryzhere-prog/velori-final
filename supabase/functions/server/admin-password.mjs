// Password hashing and username handling for the dedicated VELORI administrator
// credential store (`public.admin_accounts`).
//
// This module is the single definition of "what an administrator password is".
// It runs only inside the Edge Function (Deno) and in Node's test runner: nothing
// here is imported by the browser bundle, and no plaintext password or derived
// hash is ever placed in a browser-visible file.
//
// Stored format, identical to the access-code format so one verifier style covers
// both: `pbkdf2$<iterations>$<base64 salt>$<base64 derived key>`.
//   * PBKDF2-HMAC-SHA256 is provided by WebCrypto, which Deno and Node both
//     implement natively, so no third-party crypto dependency is introduced.
//   * The iteration count is stored in the hash, so a future increase keeps old
//     hashes verifiable while new ones are written at the higher cost.
//   * A malformed or truncated stored value fails closed.

const encoder = new TextEncoder();

export const DEFAULT_PASSWORD_ITERATIONS = 210_000;
export const MIN_ADMIN_PASSWORD_LENGTH = 12;
export const MAX_ADMIN_PASSWORD_LENGTH = 200;
export const MIN_ADMIN_USERNAME_LENGTH = 3;
export const MAX_ADMIN_USERNAME_LENGTH = 64;

// Usernames are stored exactly as typed (so an operator can use an upper-case
// name such as VELORYZMANAGEARYAN) but compared case-insensitively, which is what
// the unique index in the migration enforces.
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;

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

/** @param {string} password @param {Uint8Array} salt @param {number} iterations */
async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/**
 * Case-folds a submitted username for lookup. The stored value keeps its original
 * casing for display; every comparison goes through this function.
 * @param {string} username
 */
export function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

/** @param {unknown} username */
export function isValidUsername(username) {
  return typeof username === "string" && USERNAME_PATTERN.test(username.trim());
}

/** @param {unknown} password */
export function isValidNewPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= MIN_ADMIN_PASSWORD_LENGTH &&
    password.length <= MAX_ADMIN_PASSWORD_LENGTH
  );
}

/**
 * @param {string} password
 * @param {number} [iterations]
 * @returns {Promise<string>}
 */
export async function hashPassword(password, iterations = DEFAULT_PASSWORD_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(password, salt, iterations);
  return `pbkdf2$${iterations}$${base64FromBytes(salt)}$${base64FromBytes(derived)}`;
}

/**
 * Constant-time verification. Any malformed stored value returns false rather
 * than throwing, so a corrupted row can never be treated as a valid credential.
 * @param {string} password
 * @param {string | null | undefined} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, stored) {
  if (typeof stored !== "string" || stored.length === 0) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 1_000_000) {
    return false;
  }
  try {
    const expected = bytesFromBase64(parts[3]);
    const actual = await derive(password, bytesFromBase64(parts[2]), iterations);
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

/**
 * A stable synthetic Supabase Auth email for an administrator username.
 *
 * The administrator never sees or types this address; it exists only so that the
 * authorization layer (admin_profiles, admin_roles, RLS that keys off auth.uid())
 * keeps working unchanged. It is inside the reserved `.invalid` TLD, so it can
 * never collide with, or deliver mail to, a real user address.
 * @param {string} username
 */
export function adminIdentityEmail(username) {
  const local = normalizeUsername(username).replace(/[^a-z0-9._-]/g, "-");
  return `${local}@admin.veloryz.invalid`;
}
