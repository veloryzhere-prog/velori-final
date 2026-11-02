import { resolveValue } from "./env.mjs";

const supabaseUrl =
  resolveValue("VITE_SUPABASE_URL") || resolveValue("SUPABASE_URL", { secret: true });
const publishableKey =
  resolveValue("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  resolveValue("SUPABASE_PUBLISHABLE_KEY", { secret: true });
const setupCode = resolveValue("VELORI_ADMIN_SETUP_CODE", { secret: true });
const username = resolveValue("VELORI_ADMIN_USERNAME", { secret: true }) || "VELORYZMANAGEARYAN";

if (!supabaseUrl || !publishableKey || !setupCode) {
  throw new Error(
    "Set VITE_SUPABASE_URL, the publishable key, and VELORI_ADMIN_SETUP_CODE before initializing the administrator.",
  );
}

const response = await fetch(
  `${supabaseUrl.replace(/\/$/, "")}/functions/v1/server/admin/initialize`,
  {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ setupCode }),
  },
);
const payload = await response.json().catch(() => ({}));

if (response.status === 409 && payload.code === "already_initialized") {
  console.log(`The administrator account ${username} is already initialized.`);
} else if (!response.ok) {
  throw new Error(payload.error || `Administrator initialization failed (${response.status}).`);
} else {
  console.log(`The server initialized the administrator account ${username}.`);
}
