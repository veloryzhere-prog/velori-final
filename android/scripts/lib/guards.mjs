/**
 * Pure guards shared by the deployment tooling, extracted so they can be unit
 * tested. Both protect the same thing: a privileged value or a write must never
 * reach the database or the browser by accident.
 */

/**
 * Conservative read-only classifier for SQL text.
 *
 * It errs toward refusing. Anything not positively identified as a read is
 * treated as a write, because the failure mode of a false "read" is silently
 * mutating production while the failure mode of a false "write" is an operator
 * adding `--write`. That asymmetry is deliberate.
 */
export function isReadOnlySql(sql) {
  if (typeof sql !== "string" || !sql.trim()) return false;

  // Remove comments and the contents of string literals before looking for
  // keywords, so `select 'delete me'` and `-- drop table` cannot be misread.
  const stripped = sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''");

  // Anything that can persist, mutate, escalate or escape a sandbox.
  const mutating =
    /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|comment|reset|copy|refresh|reindex|cluster|vacuum|reassign|security\s+label|do|call|lock|prepare)\b/i;
  if (mutating.test(stripped)) return false;

  // `set role`, `set session_authorization` and friends are privilege changes
  // even though `set` alone is harmless.
  if (/\bset\s+(?:role|session\s+authorization|local\s+role)\b/i.test(stripped)) return false;

  // SECURITY DEFINER definitions and bare EXECUTE escalate privilege.
  if (/\bsecurity\s+definer\b|\bexecute\b/i.test(stripped)) return false;

  return /^\s*(select|with|table|explain|values)\b/i.test(stripped.trim());
}

/**
 * Strip psql meta-commands so one gate file can run under both psql and the
 * Management API tool. A backslash command is only meaningful at the start of
 * an unquoted line, which is where `\set ON_ERROR_STOP on` appears.
 */
export function stripPsqlMetaCommands(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !/^\s*\\[a-zA-Z]+/.test(line))
    .join("\n");
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0:0:0:0:0:0:0:1"]);

/**
 * Validate the Edge Function origin allowlist.
 *
 * Returns the normalized origins, or throws with a message naming the problem.
 * Plain HTTP is accepted only for loopback hosts so local development keeps
 * working while every real deployment origin is forced to HTTPS.
 */
export function parseAllowedOrigins(raw) {
  const origins = String(raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins.length) {
    throw new Error("VELORI_ALLOWED_ORIGINS must list at least one origin.");
  }

  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`VELORI_ALLOWED_ORIGINS contains an unparseable origin: ${origin}`);
    }
    // A trailing slash, path, query or fragment means the value will not match
    // the browser's Origin header, which is always scheme + host + port.
    if (parsed.origin !== origin) {
      throw new Error(
        `VELORI_ALLOWED_ORIGINS must contain exact origins with no path, query or trailing slash: ${origin}`,
      );
    }
    if (parsed.protocol === "https:") continue;
    if (parsed.protocol !== "http:" || !LOOPBACK_HOSTS.has(parsed.hostname)) {
      throw new Error(
        `VELORI_ALLOWED_ORIGINS must use HTTPS, or plain HTTP only for localhost: ${origin}`,
      );
    }
  }

  return origins;
}
