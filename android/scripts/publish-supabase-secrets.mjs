import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseAllowedOrigins } from "./lib/guards.mjs";
import { resolveValue } from "./env.mjs";

const supabaseUrl =
  resolveValue("VITE_SUPABASE_URL") || resolveValue("SUPABASE_URL", { secret: true });
const publishableKey =
  resolveValue("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  resolveValue("SUPABASE_PUBLISHABLE_KEY", { secret: true });
// Privileged values are read only from process.env or .env.secrets.local, never
// from the Vite env files the frontend also loads.
const secretKey =
  resolveValue("VELORI_SUPABASE_SECRET_KEY", { secret: true }) ||
  resolveValue("SUPABASE_SECRET_KEY", { secret: true }) ||
  resolveValue("SUPABASE_SERVICE_ROLE_KEY", { secret: true });
const allowedOrigins =
  resolveValue("VELORI_ALLOWED_ORIGINS", { secret: true }) ||
  resolveValue("ALLOWED_ORIGINS", { secret: true });
const bootstrapCode = resolveValue("VELORI_ADMIN_SETUP_CODE", { secret: true });
const mediaCleanupToken = resolveValue("VELORI_MEDIA_CLEANUP_TOKEN", { secret: true });
const adminUsername = resolveValue("VELORI_ADMIN_USERNAME", { secret: true });
const adminInitialPassword = resolveValue("VELORI_ADMIN_INITIAL_PASSWORD", { secret: true });
const environmentManagementToken = resolveValue("VELORI_ENVIRONMENT_MANAGEMENT_TOKEN", {
  secret: true,
});
const studioEncryptionKey = resolveValue("VELORI_STUDIO_ENCRYPTION_KEY", { secret: true });
const studioEnabled = resolveValue("VELORI_STUDIO_ENABLED", { secret: true }) || "false";
const generationEnabled =
  resolveValue("VELORI_STUDIO_GENERATION_ENABLED", { secret: true }) || "false";
const geminiApiKey = resolveValue("GEMINI_API_KEY", { secret: true });
const geminiModel = resolveValue("VELORI_GEMINI_MODEL", { secret: true });
const publishInitialAdminPassword =
  resolveValue("VELORI_PUBLISH_INITIAL_ADMIN_PASSWORD", { secret: true }) === "true";

let parsedSupabaseUrl;
try {
  parsedSupabaseUrl = new URL(supabaseUrl);
} catch {
  throw new Error("Set VITE_SUPABASE_URL to the new Supabase project URL.");
}
const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  (parsedSupabaseUrl.hostname.endsWith(".supabase.co")
    ? parsedSupabaseUrl.hostname.slice(0, -".supabase.co".length)
    : "");
if (
  !projectRef ||
  parsedSupabaseUrl.protocol !== "https:" ||
  parsedSupabaseUrl.hostname !== `${projectRef}.supabase.co` ||
  parsedSupabaseUrl.pathname !== "/" ||
  parsedSupabaseUrl.search ||
  parsedSupabaseUrl.hash
) {
  throw new Error(
    "SUPABASE_PROJECT_REF and VITE_SUPABASE_URL must identify the same Supabase project.",
  );
}
if (!publishableKey || !secretKey || !allowedOrigins) {
  throw new Error("Required protected Supabase deployment values are missing.");
}
if (!mediaCleanupToken || mediaCleanupToken.length < 32) {
  throw new Error("Set VELORI_MEDIA_CLEANUP_TOKEN to a random secret of at least 32 characters.");
}
if (!secretKey.startsWith("sb_secret_")) {
  throw new Error("Use a current Supabase secret API key for VELORI_SUPABASE_SECRET_KEY.");
}
if (!environmentManagementToken.startsWith("sbp_")) {
  throw new Error(
    "Set VELORI_ENVIRONMENT_MANAGEMENT_TOKEN to a Supabase personal access token with project Edge-secrets access.",
  );
}
const encryptionBytes = Buffer.from(studioEncryptionKey, "base64");
if (encryptionBytes.length !== 32 || encryptionBytes.toString("base64") !== studioEncryptionKey) {
  throw new Error("Set VELORI_STUDIO_ENCRYPTION_KEY to a base64-encoded 32-byte key.");
}
if (!["true", "false"].includes(studioEnabled) || !["true", "false"].includes(generationEnabled)) {
  throw new Error("Studio enablement values must be true or false.");
}
if (generationEnabled === "true" && (studioEnabled !== "true" || !geminiApiKey || !geminiModel)) {
  throw new Error(
    "Enable Studio generation only after configuring Studio, GEMINI_API_KEY, and VELORI_GEMINI_MODEL.",
  );
}
if (
  [publishableKey, secretKey, allowedOrigins].some((value) =>
    /^(\*+|placeholder|change me|changeme|example|your_.*key)$/i.test(value.trim()),
  )
) {
  throw new Error(
    "Required protected Supabase deployment values are still placeholder values; replace them with the active project values before publishing secrets.",
  );
}

const keyClaims = publishableKey.startsWith("sb_publishable_")
  ? null
  : (() => {
      try {
        const payload = publishableKey.split(".")[1];
        return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      } catch {
        return null;
      }
    })();
if (
  (keyClaims && keyClaims.ref !== projectRef) ||
  (!keyClaims && !publishableKey.startsWith("sb_publishable_"))
) {
  throw new Error("The frontend anon key belongs to a different Supabase project.");
}

const origins = parseAllowedOrigins(allowedOrigins);

const values = {
  VELORI_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  VELORI_SUPABASE_SECRET_KEY: secretKey,
  VELORI_MEDIA_CLEANUP_TOKEN: mediaCleanupToken,
  ALLOWED_ORIGINS: origins.join(","),
  VELORI_ALLOWED_ORIGINS: origins.join(","),
  VELORI_STUDIO_ORIGINS: origins.join(","),
  VELORI_ENVIRONMENT_MANAGEMENT_TOKEN: environmentManagementToken,
  VELORI_STUDIO_ENCRYPTION_KEY: studioEncryptionKey,
  VELORI_STUDIO_ENABLED: studioEnabled,
  VELORI_STUDIO_GENERATION_ENABLED: generationEnabled,
};
// Use a custom name so the Edge Function can move to a rotatable sb_secret key
// without depending on the legacy auto-injected service_role JWT.
if (bootstrapCode) values.ADMIN_SETUP_CODE = bootstrapCode;
if (adminUsername) values.VELORI_ADMIN_USERNAME = adminUsername;
if (geminiApiKey) values.GEMINI_API_KEY = geminiApiKey;
if (geminiModel) values.VELORI_GEMINI_MODEL = geminiModel;
if (publishInitialAdminPassword && adminInitialPassword) {
  values.VELORI_ADMIN_INITIAL_PASSWORD = adminInitialPassword;
}

for (const [name, value] of Object.entries(values)) {
  if (/[\r\n]/.test(value)) throw new Error(`${name} contains an unsupported line break.`);
}

// The Supabase CLI is not a project dependency, so it is normally installed
// globally or provided by `supabase/setup-cli` in CI. Fall back to the pinned
// version via npx rather than failing with a bare ENOENT.
//
// The npx path is spawned as `node npx-cli.js ...` rather than `npx.cmd ...`
// with `shell: true`. Windows requires a shell to launch a .cmd shim, and Node
// warns that doing so concatenates arguments without escaping, which is how a
// secret value containing a shell metacharacter becomes a command injection.
// Invoking the JS entrypoint directly keeps arguments as a real argv array.
function resolveCli() {
  const pinned = process.env.SUPABASE_CLI_VERSION?.trim() || "2.119.0";
  const explicit = process.env.SUPABASE_CLI_PATH?.trim();
  if (explicit) return { command: explicit, prefix: [] };
  const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
  if (existsSync(npxCli))
    return { command: process.execPath, prefix: [npxCli, "--yes", `supabase@${pinned}`] };
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  return { command: npx, prefix: ["--yes", `supabase@${pinned}`] };
}

const cli = resolveCli();

const tempDirectory = await mkdtemp(join(tmpdir(), "velori-supabase-"));
const envPath = join(tempDirectory, "function-secrets.env");
try {
  const content =
    Object.entries(values)
      .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
      .join("\n") + "\n";
  await writeFile(envPath, content, { mode: 0o600, flag: "wx" });
  await chmod(envPath, 0o600);
  // The CLI authenticates the Management API with SUPABASE_ACCESS_TOKEN and
  // refuses to run without it. Values are read from process.env or the secret
  // file, so they must be forwarded explicitly into the child environment; they
  // are never written to disk outside the 0600 temp file and never printed.
  const accessToken = resolveValue("SUPABASE_ACCESS_TOKEN", { secret: true });
  if (!accessToken) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is required to publish Edge Function secrets. Set it in .env.secrets.local, the environment, or CI.",
    );
  }
  const result = spawnSync(
    cli.command,
    [...cli.prefix, "secrets", "set", "--env-file", envPath, "--project-ref", projectRef],
    {
      stdio: "inherit",
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error("Supabase rejected the protected Edge Function secret update.");
  console.log("Updated server-side Supabase Function secrets without printing their values.");
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
