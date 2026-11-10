// End-to-end verification of the administrator sign-in chain.
//
// Signs in at the live /admin/login endpoint using the credentials stored in
// .env.secrets.local, calls /admin/me with the issued session, then logs out so
// no session is left behind. The password and session token are never printed.
import { resolveValue } from "./env.mjs";

const supabaseUrl = (
  resolveValue("VITE_SUPABASE_URL") ||
  resolveValue("SUPABASE_URL", { secret: true })
).replace(/\/$/, "");
const publishableKey =
  resolveValue("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  resolveValue("SUPABASE_PUBLISHABLE_KEY", { secret: true });
const username = resolveValue("VELORI_ADMIN_USERNAME", { secret: true });
const password = resolveValue("VELORI_ADMIN_INITIAL_PASSWORD", { secret: true });

if (!supabaseUrl || !publishableKey || !username || !password) {
  console.error("Missing VITE_SUPABASE_URL, publishable key, or admin credentials.");
  process.exit(1);
}

const base = `${supabaseUrl}/functions/v1/server/admin`;

console.log(`Signing in as "${username}" at ${base}/login …`);
const login = await fetch(`${base}/login`, {
  method: "POST",
  headers: { apikey: publishableKey, "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
});
const session = await login.json().catch(() => ({}));
console.log(`login HTTP ${login.status}${session.error ? ` — ${session.error}` : ""}`);

if (!login.ok || !session.sessionToken) {
  console.log("SIGN-IN FAILED");
  process.exit(1);
}
console.log(
  `login OK — mustChangePassword=${Boolean(session.mustChangePassword)} expires=${session.sessionExpiresAt}`,
);

const me = await fetch(`${base}/me`, {
  headers: { apikey: publishableKey, Authorization: `Bearer ${session.sessionToken}` },
});
const meBody = await me.json().catch(() => ({}));
console.log(
  `me HTTP ${me.status} — role=${meBody.profile?.role_key ?? meBody.roleKey ?? "?"} username=${meBody.account?.username ?? "?"}`,
);

const logout = await fetch(`${base}/logout`, {
  method: "POST",
  headers: { apikey: publishableKey, Authorization: `Bearer ${session.sessionToken}` },
});
console.log(`logout HTTP ${logout.status} (test session revoked)`);
console.log(me.ok ? "END-TO-END SIGN-IN: PASS" : "END-TO-END SIGN-IN: PARTIAL (login ok, /me failed)");
