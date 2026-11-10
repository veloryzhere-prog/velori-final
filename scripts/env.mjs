import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

export const repoRoot = fileURLToPath(new URL("../", import.meta.url));

/**
 * Secret file names, in precedence order. These are read explicitly rather than
 * through Vite's `loadEnv` because Vite only knows about `.env`,
 * `.env.local`, `.env.[mode]` and `.env.[mode].local`. Keeping privileged values
 * in a file Vite never opens means a `VITE_*`-only public `.env.local` cannot
 * silently accumulate deploy credentials again.
 */
const SECRET_ENV_FILES = [".env.secrets.local", ".env.secrets.production.local"];

/** Minimal dotenv parser. Values may be bare or JSON-quoted. */
function parseDotenv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const name = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else {
      const hashIndex = value.indexOf(" #");
      if (hashIndex !== -1) value = value.slice(0, hashIndex).trim();
    }
    out[name] = value;
  }
  return out;
}

function loadSecretFiles() {
  const merged = {};
  for (const name of SECRET_ENV_FILES) {
    let text;
    try {
      // join() rather than a file:// URL: the repository path can contain spaces
      // and parentheses, which are not valid unescaped in a URL and would make
      // new URL() throw before the file was ever read.
      text = readFileSync(join(repoRoot, name), "utf8");
    } catch {
      continue;
    }
    Object.assign(merged, parseDotenv(text));
  }
  return merged;
}

/**
 * Public values fall back to Vite env files. Secret values are restricted to
 * process.env and the explicit secret files and never fall through to `.env.local`.
 */
export function resolveValue(name, { secret = false } = {}) {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  if (secret) {
    const fromSecretFile = loadSecretFiles()[name]?.trim();
    if (fromSecretFile) return fromSecretFile;
    return "";
  }
  return loadEnv("production", repoRoot, "")[name]?.trim() ?? "";
}

/** Names that must never appear in a browser bundle or a tracked file. */
export const FORBIDDEN_IN_BROWSER = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VELORI_SUPABASE_SECRET_KEY",
  "VELORI_MEDIA_CLEANUP_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "VELORI_ADMIN_SETUP_CODE",
  "VELORI_ADMIN_INITIAL_PASSWORD",
  "VELORI_ADMIN_USERNAME",
  "VELORI_PUBLISH_INITIAL_ADMIN_PASSWORD",
  "ADMIN_SETUP_CODE",
  "SMTP_PASSWORD",
  "SUPABASE_SMTP_PASSWORD",
];

/** Names that are safe to ship to a browser. */
export const PUBLIC_BROWSER_NAMES = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
