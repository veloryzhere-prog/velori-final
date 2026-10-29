// Read-only diagnostics for an administrator sign-in failure.
//
// Answers, without printing any secret, hash or password:
//   1. Is the `server` Edge Function deployed and configured for this project?
//   2. Does an `admin_accounts` row exist for the configured administrator?
//   3. Is the configured VELORI_ADMIN_INITIAL_PASSWORD the one the stored
//      PBKDF2 hash was created from? (verified locally, never transmitted)
//   4. Is the credential locked or throttled right now?
//
// This script performs no writes and never calls /admin/login, so it cannot
// consume the failure budget or lock the account it is diagnosing.

import { createHash } from "node:crypto";
import { resolveValue } from "./env.mjs";
import {
  normalizeUsername,
  verifyPassword,
} from "../supabase/functions/server/admin-password.mjs";

const supabaseUrl = (
  resolveValue("VITE_SUPABASE_URL") ||
  resolveValue("SUPABASE_URL", { secret: true })
).replace(/\/$/, "");
const publishableKey =
  resolveValue("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  resolveValue("SUPABASE_PUBLISHABLE_KEY", { secret: true });
const secretKey =
  resolveValue("VELORI_SUPABASE_SECRET_KEY", { secret: true }) ||
  resolveValue("SUPABASE_SECRET_KEY", { secret: true }) ||
  resolveValue("SUPABASE_SERVICE_ROLE_KEY", { secret: true });
const adminUsername = resolveValue("VELORI_ADMIN_USERNAME", { secret: true });
const adminInitialPassword = resolveValue("VELORI_ADMIN_INITIAL_PASSWORD", {
  secret: true,
});

const findings = [];
function record(status, name, detail) {
  findings.push({ status, name, detail });
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ""}`);
}

if (!supabaseUrl || !publishableKey) {
  console.error(
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (.env.local) before running.",
  );
  process.exit(1);
}
console.log(`Project: ${supabaseUrl}`);
console.log(
  `Configured VELORI_ADMIN_USERNAME: ${
    adminUsername
      ? `present (normalises to "${normalizeUsername(adminUsername)}")`
      : "ABSENT"
  }`,
);
console.log(
  `Configured VELORI_ADMIN_INITIAL_PASSWORD: ${adminInitialPassword ? "present" : "ABSENT"}`,
);
console.log("");

// ---------------------------------------------------------------------------
// 1. Edge Function health (public endpoint, no session required).
// ---------------------------------------------------------------------------
let health = null;
try {
  const response = await fetch(`${supabaseUrl}/functions/v1/server/health`, {
    headers: { apikey: publishableKey },
  });
  health = await response.json().catch(() => ({}));
  if (response.ok && health.status === "ok") {
    record(
      "PASS",
      "server Edge Function reachable",
      `configured=${health.configured} originsConfigured=${health.originsConfigured} setupCodeEnabled=${health.setupCodeEnabled}`,
    );
    if (health.configured === false) {
      record(
        "FAIL",
        "Edge Function secrets",
        "the function reports configured=false; its Supabase secret key is missing or invalid",
      );
    }
  } else {
    record(
      "FAIL",
      "server Edge Function reachable",
      `HTTP ${response.status} — ${health.error ?? "no body"}`,
    );
  }
} catch (error) {
  record("FAIL", "server Edge Function reachable", String(error));
}
// ---------------------------------------------------------------------------
// 2. Credential store inspection (service role, read-only).
// ---------------------------------------------------------------------------
if (!secretKey) {
  record(
    "WARN",
    "service secret key",
    "VELORI_SUPABASE_SECRET_KEY is not set locally; skipping credential inspection",
  );
} else {
  const headers = {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
  };
  let accounts = [];
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/admin_accounts?select=username,enabled,must_change_password,failed_attempts,locked_until,last_login_at,password_hash`,
      { headers: { ...headers, Accept: "application/json" } },
    );
    if (!response.ok) {
      const body = await response.text();
      record(
        "FAIL",
        "admin_accounts query",
        `HTTP ${response.status} — ${body.slice(0, 300)} (is the local secret key for THIS project?)`,
      );
    } else {
      accounts = await response.json();
      if (!accounts.length) {
        record(
          "FAIL",
          "administrator credential exists",
          "admin_accounts is EMPTY — the administrator was never initialized on this project, so every sign-in returns 'The username or password is incorrect.'",
        );
      } else {
        record(
          "PASS",
          "administrator credential exists",
          `${accounts.length} account(s): ${accounts.map((row) => row.username).join(", ")}`,
        );
      }
    }
  } catch (error) {
    record("FAIL", "admin_accounts query", String(error));
  }

  // -------------------------------------------------------------------------
  // 3. Password match + lock state per account.
  // -------------------------------------------------------------------------
  for (const account of accounts) {
    const normalizedStored = normalizeUsername(String(account.username ?? ""));
    const normalizedConfigured = adminUsername ? normalizeUsername(adminUsername) : "";
    if (normalizedConfigured && normalizedStored !== normalizedConfigured) {
      record(
        "WARN",
        `username for "${account.username}"`,
        "the stored username does not match the configured VELORI_ADMIN_USERNAME (compared case-insensitively)",
      );
    }

    const lockedUntil = account.locked_until
      ? new Date(account.locked_until).getTime()
      : 0;
    if (lockedUntil > Date.now()) {
      record(
        "FAIL",
        `lock state for "${account.username}"`,
        `locked until ${new Date(lockedUntil).toISOString()} — sign-in returns HTTP 429 until then`,
      );
    } else {
      record(
        "PASS",
        `lock state for "${account.username}"`,
        `not locked (failed_attempts=${account.failed_attempts ?? 0})`,
      );
    }

    if (!account.password_hash) {
      record(
        "FAIL",
        `password hash for "${account.username}"`,
        "the stored hash is empty, so every sign-in fails closed",
      );
      continue;
    }
    if (!adminInitialPassword) {
      record(
        "WARN",
        `password hash for "${account.username}"`,
        "a hash exists but VELORI_ADMIN_INITIAL_PASSWORD is not set locally, so the match cannot be verified",
      );
      continue;
    }
    const matches = await verifyPassword(adminInitialPassword, account.password_hash);
    record(
      matches ? "PASS" : "FAIL",
      `configured initial password vs stored hash for "${account.username}"`,
      matches
        ? "they match — the password you are typing may differ from this value (whitespace/casing)"
        : "they DO NOT match — the hash was made from a different password; sign-in will always fail until it is reset",
    );
  }

  // -------------------------------------------------------------------------
  // 4. Recent failed attempts (throttle window is 15 minutes, limit 5).
  // -------------------------------------------------------------------------
  const normalized = adminUsername ? normalizeUsername(adminUsername) : "";
  if (normalized) {
    const attemptHash = createHash("sha256")
      .update(`velori.admin.username|${normalized}`)
      .digest("hex");
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/admin_login_attempts?email_hash=eq.${attemptHash}&succeeded=eq.false&created_at=gte.${encodeURIComponent(since)}&select=id`,
        { headers: { ...headers, Accept: "application/json" } },
      );
      if (response.ok) {
        const recent = await response.json();
        record(
          recent.length >= 5 ? "WARN" : "PASS",
          "recent failed sign-in attempts (15-minute window)",
          `${recent.length} recorded for the configured username (throttle starts at 5)`,
        );
      }
    } catch {
      /* diagnostics-only; a failed count query does not change the verdict */
    }
  }
}

console.log("");
const failures = findings.filter((finding) => finding.status === "FAIL").length;
console.log(
  failures === 0
    ? "No failing checks. The credentials look consistent; retest sign-in."
    : `${failures} failing check(s) above explain the sign-in error.`,
);
