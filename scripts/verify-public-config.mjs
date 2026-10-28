import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveValue } from "./env.mjs";

export function validatePublicConnection(urlValue, keyValue) {
  let url;
  try {
    url = new URL(String(urlValue).trim());
  } catch {
    throw Error("Set VITE_SUPABASE_URL before building VELORI.");
  }
  if (
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    url.hostname === "placeholder.supabase.co"
  )
    throw Error("Use the actual Supabase project URL for this build.");
  const key = String(keyValue ?? "").trim();
  if (/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) return true;
  try {
    const parts = key.split(".");
    const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8"));
    if (parts.length === 3 && payload.role === "anon") return true;
  } catch {
    /* Never echo a supplied key. */
  }
  throw Error(
    "Set a Supabase publishable or legacy anon key. Private and service-role keys cannot be used in the browser.",
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    validatePublicConnection(
      resolveValue("VITE_SUPABASE_URL"),
      resolveValue("VITE_SUPABASE_ANON_KEY") || resolveValue("VITE_SUPABASE_PUBLISHABLE_KEY"),
    );
    console.log("Public Supabase configuration is present; production build can continue.");
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Public Supabase configuration is missing.",
    );
    process.exitCode = 1;
  }
}
