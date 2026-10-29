// Shared primitives for the VELORI administrator API.
//
// Extracted from index.tsx so the admin-console handlers and the original handlers
// use one definition of authentication, authorization, body parsing and auditing.
// Nothing here is browser-reachable: the service-role key is only ever read inside
// this module and the Edge Function's own environment.

import { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
function isPlaceholderValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (/^\*+$/.test(normalized)) return true;
  return [
    "changeme",
    "example",
    "placeholder",
    "replace_me",
    "your_supabase_service_role_key",
    "your_service_role_key",
  ].some((token) => normalized.includes(token));
}
function defaultInjectedKey(variable: string): string {
  const raw = Deno.env.get(variable);
  if (!raw) return "";
  try {
    const keys = JSON.parse(raw) as Record<string, unknown>;
    if (typeof keys.default === "string") return keys.default;
    const first = Object.values(keys).find((value): value is string => typeof value === "string");
    return first ?? "";
  } catch {
    return "";
  }
}

// Supabase reserves the SUPABASE_ prefix for injected values. Prefer the
// modern runtime key dictionaries, then support the custom deployment names
// and legacy injected variables for projects that have not finished migration.
export const PUBLISHABLE_KEY =
  Deno.env.get("VELORI_SUPABASE_PUBLISHABLE_KEY") ||
  defaultInjectedKey("SUPABASE_PUBLISHABLE_KEYS") ||
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY") ||
  "";
export const SERVICE_ROLE_KEY =
  Deno.env.get("VELORI_SUPABASE_SECRET_KEY") ||
  defaultInjectedKey("SUPABASE_SECRET_KEYS") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";
export const SETUP_CODE = Deno.env.get("ADMIN_SETUP_CODE") ?? "";
export const CONFIGURED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// Primary administrator username. It is a username, not an email address. The
// fixed default is the canonical VELORI name. The password is never defaulted
// and is loaded only from protected server configuration during initialization.
export const ADMIN_USERNAME = (Deno.env.get("VELORI_ADMIN_USERNAME") ?? "").trim();
export const ADMIN_INITIAL_PASSWORD = Deno.env.get("VELORI_ADMIN_INITIAL_PASSWORD") ?? "";

// The primary administrator's username. A username is not a credential, so a
// stable default lets the one-time server-side initializer use the required name.
export const PRIMARY_ADMIN_USERNAME = ADMIN_USERNAME || "VELORIMANAGEARYAN";

// Origins permitted when ALLOWED_ORIGINS has not been set yet. This keeps local
// development usable without ever emitting `Access-Control-Allow-Origin: *`, and
// it means a forgotten configuration cannot silently expose the administrator API
// to every site on the internet.
export const DEVELOPMENT_ORIGINS = [
  "http://localhost:3001",
  "https://velori-social-platform.sweetriver32.chatgpt.site",
  "http://localhost:5173",
  "http://localhost:8443",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8443",
];

export const ALLOWED_ORIGINS = [...new Set([...CONFIGURED_ORIGINS, ...DEVELOPMENT_ORIGINS])];
export const ADMIN_SESSION_COOKIE_NAME = "__Host-velori_admin_session";

export function adminSessionCookie(token: string, maxAgeSeconds: number): string {
  return `${ADMIN_SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${Math.max(
    0,
    Math.floor(maxAgeSeconds),
  )}; Secure; HttpOnly; SameSite=None`;
}

export function clearAdminSessionCookie(): string {
  return `${ADMIN_SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=None`;
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_MAX_FAILURES_PER_IP = 20;

// Lockout is enforced in the product, not only at the gateway, so a burst of
// failed sign-ins temporarily freezes the credential itself.
export const ADMIN_LOCKOUT_THRESHOLD = 5;
export const ADMIN_LOCKOUT_MINUTES = 15;
// Namespaced so credential attempts and login attempts never share, or consume,
// each other's budget in the shared admin_login_attempts table.
export const ADMIN_USERNAME_ATTEMPT_NAMESPACE = "velori.admin.username|";

export const SETUP_CODE_WINDOW_MINUTES = 30;
export const SETUP_CODE_MAX_FAILURES_PER_IP = 8;
export const SETUP_CODE_ATTEMPT_NAMESPACE = "velori.setup-code|";

export const ACCESS_CODE_MIN_LENGTH = 12;
export const ACCESS_CODE_MAX_LENGTH = 128;

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_ANIMATION_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_BODY_BYTES = 256 * 1024;

export const ASSET_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdminRoleKey = "super_admin" | "admin" | "moderator" | "content_manager" | "support";

export const ADMIN_ROLE_KEYS: readonly AdminRoleKey[] = [
  "super_admin",
  "admin",
  "moderator",
  "content_manager",
  "support",
];

export type AdminProfile = {
  user_id: string;
  role: "admin" | "super_admin";
  role_key: AdminRoleKey;
  display_name: string;
  job_title: string;
  bio: string;
  avatar_url: string | null;
  is_active: boolean;
  mfa_required: boolean;
  must_change_password: boolean;
  session_timeout_minutes: number;
  created_at: string;
  updated_at: string;
};

export type AdminSessionRow = {
  id: string;
  admin_user_id: string;
  expires_at: string;
  revoked_at: string | null;
  reauthenticated_at: string | null;
  last_seen_at: string;
};

/** The credential half of an administrator: a username and a password hash.
 * Loaded only inside the Edge Function; the hash never leaves the server. */
export type AdminAccountRow = {
  id: string;
  user_id: string;
  username: string;
  role_key: AdminRoleKey;
  enabled: boolean;
  must_change_password: boolean;
  failed_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
};

export type AdminPrincipal = {
  user: User;
  profile: AdminProfile;
  /** The credential record for this administrator, when one exists. Absent on a
   * deployment that has not run first-time setup yet. */
  account: AdminAccountRow | null;
  roleKey: AdminRoleKey;
  permissions: Set<string>;
  session: AdminSessionRow | null;
};

export type AdminEnv = { Variables: { admin: AdminPrincipal } };
export type Ctx = Context<AdminEnv>;

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export function service(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function publicClient(): SupabaseClient {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function misconfigured() {
  if (
    !SUPABASE_URL ||
    !PUBLISHABLE_KEY ||
    !SERVICE_ROLE_KEY ||
    isPlaceholderValue(SUPABASE_URL) ||
    isPlaceholderValue(PUBLISHABLE_KEY) ||
    isPlaceholderValue(SERVICE_ROLE_KEY)
  ) {
    return true;
  }
  try {
    const url = new URL(SUPABASE_URL);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co")) {
      return true;
    }
    const projectRef = url.hostname.slice(0, -".supabase.co".length);
    if (PUBLISHABLE_KEY.startsWith("sb_publishable_")) return false;
    const tokenPayload = PUBLISHABLE_KEY.split(".")[1];
    if (tokenPayload) {
      const claims = JSON.parse(atob(tokenPayload.replace(/-/g, "+").replace(/_/g, "/"))) as {
        ref?: string;
      };
      return claims.ref !== projectRef;
    }
    return true;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const value = forwarded?.split(",")[0]?.trim();
  return value && value.length <= 45 ? value : null;
}

export function referenceId() {
  return crypto.randomUUID();
}

/**
 * Type predicate rather than a plain `boolean`.
 *
 * `c.req.param("id")` is typed `string | undefined` in Hono v4 because a route
 * pattern may not contain that segment. Declaring the parameter as `unknown` and
 * returning `value is string` makes the very common
 *
 *   const id = c.req.param("id")
 *   if (!isUuid(id)) return c.json({ error: "..." }, 400)
 *
 * narrow `id` to `string` for the compiler. That is exactly the runtime
 * behaviour already relied on here: a missing or non-UUID segment is rejected
 * with a 400 before the value reaches the database or the Auth admin API, so
 * `undefined` can never be forwarded as an identifier.
 */
export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Device label derived from the user agent. Approximate by design: the console
 * shows "Chrome on Windows", never a fingerprint. */
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const platform = /Windows/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad|iPod/.test(userAgent)
        ? "iOS"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "Unknown OS";
  return `${browser} on ${platform}`;
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

export async function readJson(
  request: Request,
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; error: string }> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { ok: false, error: "The request body is too large." };
  }
  if (!request.body) return { ok: false, error: "A JSON body is required." };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, error: "The request body is too large." };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: "The request body could not be read." };
  } finally {
    reader.releaseLock();
  }
  if (totalBytes === 0) return { ok: false, error: "A JSON body is required." };
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isPlainObject(parsed)) {
      return { ok: false, error: "A JSON object is required." };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, error: "The request body is not valid JSON." };
  }
}

/** Returns a trimmed string, or null when the value is present but not text.
 * `undefined` means "absent", which callers treat as "leave unchanged". */
export function readString(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null | undefined {
  if (!(key in source)) return undefined;
  const value = source[key];
  if (value === null) return "";
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength + 1);
}

export function readSecret(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | null | undefined {
  if (!(key in source)) return undefined;
  const value = source[key];
  if (typeof value !== "string") return null;
  return value.slice(0, maxLength + 1);
}

export function readBoolean(
  source: Record<string, unknown>,
  key: string,
): boolean | null | undefined {
  if (!(key in source)) return undefined;
  const value = source[key];
  if (typeof value !== "boolean") return null;
  return value;
}

export function readInteger(
  source: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): number | null | undefined {
  if (!(key in source)) return undefined;
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export function readEnum<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T | null | undefined {
  if (!(key in source)) return undefined;
  const value = source[key];
  if (value === null) return null;
  if (typeof value !== "string" || !allowed.includes(value as T)) return null;
  return value as T;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

// `reason` and `result` arrived with migration 20261013000000. Probing once and
// caching the answer means an un-migrated database keeps receiving audit rows
// (with the two values folded into `metadata`) instead of silently losing every
// privileged action from the log.
let auditColumns: Promise<boolean> | null = null;

function auditHasExtendedColumns(): Promise<boolean> {
  if (!auditColumns) {
    auditColumns = (async () => {
      const { error } = await service().from("admin_audit_logs").select("reason,result").limit(1);
      return error === null;
    })();
  }
  return auditColumns;
}

export async function writeAudit(
  request: Request,
  entry: {
    adminUserId: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    reason?: string;
    result?: "success" | "failure" | "denied";
    metadata?: Record<string, unknown>;
    errorId?: string;
  },
) {
  const base = {
    admin_user_id: entry.adminUserId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
    ip_address: clientIp(request),
    user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    error_id: entry.errorId ?? null,
  };
  const db = service();
  if (await auditHasExtendedColumns()) {
    const { error } = await db.from("admin_audit_logs").insert({
      ...base,
      reason: entry.reason ?? "",
      result: entry.result ?? "success",
    });
    if (error) throw new Error("Administrator audit record could not be saved.");
    return;
  }
  const { error } = await db.from("admin_audit_logs").insert({
    ...base,
    metadata: {
      ...base.metadata,
      ...(entry.reason ? { reason: entry.reason } : {}),
      result: entry.result ?? "success",
    },
  });
  if (error) throw new Error("Administrator audit record could not be saved.");
}

export async function recordLoginAttempt(emailHash: string, ip: string | null, succeeded: boolean) {
  await service()
    .from("admin_login_attempts")
    .insert({ email_hash: emailHash, ip_address: ip, succeeded });
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

// Permissions reserved for Super Admin. This set exists so the console keeps
// working on a database that has not applied migration 20261013000000 yet: the
// legacy two-role deployment maps `admin` to "every permission except these",
// which is exactly the grant migration 20261013000000 writes for the admin role.
// The three newer roles cannot exist before that migration, because
// admin_profiles.role_key has a foreign key into admin_roles.
export const SUPER_ADMIN_ONLY_PERMISSIONS: readonly string[] = [
  "security.edit",
  "admins.create",
  "admins.disable",
  "admins.delete",
  "roles.edit",
  "system.emergency",
  "messages.view_reports",
];

const FALLBACK_PERMISSION_KEYS: readonly string[] = [
  "users.view",
  "users.edit",
  "users.verify",
  "users.restrict",
  "users.suspend",
  "users.ban",
  "users.notes",
  "users.sessions",
  "users.delete",
  "posts.view",
  "posts.hide",
  "posts.restore",
  "posts.delete",
  "comments.view",
  "comments.hide",
  "comments.restore",
  "comments.delete",
  "reports.view",
  "reports.update",
  "groups.view",
  "groups.lock",
  "cms.view",
  "cms.edit",
  "cms.publish",
  "cms.delete",
  "navigation.view",
  "navigation.edit",
  "branding.view",
  "branding.edit",
  "animations.view",
  "animations.edit",
  "theme.view",
  "theme.edit",
  "errorpages.view",
  "errorpages.edit",
  "notifications.view",
  "notifications.edit",
  "notifications.send",
  "ads.view",
  "ads.edit",
  "offers.view",
  "offers.edit",
  "referrals.view",
  "referrals.edit",
  "referrals.reverse",
  "flags.view",
  "flags.edit",
  "settings.view",
  "settings.edit",
  "maintenance.edit",
  "emails.view",
  "emails.edit",
  "admins.view",
  "audit.view",
  "system.view",
  "system.export",
];

function fallbackPermissions(roleKey: AdminRoleKey): Set<string> {
  if (roleKey === "super_admin") return new Set(FALLBACK_PERMISSION_KEYS);
  return new Set(
    FALLBACK_PERMISSION_KEYS.filter((key) => !SUPER_ADMIN_ONLY_PERMISSIONS.includes(key)),
  );
}

/** Resolves the caller's effective permissions from the database. Falls back to
 * the legacy role mapping when migration 20261013000000 has not been applied, so
 * upgrading the function never locks every administrator out of their own console. */
export async function resolvePermissions(
  userId: string,
  roleKey: AdminRoleKey,
): Promise<Set<string>> {
  const { data, error } = await service().rpc("admin_effective_permissions", {
    p_user_id: userId,
  });
  if (error || !Array.isArray(data) || data.length === 0) {
    return fallbackPermissions(roleKey);
  }
  return new Set(data.filter((key): key is string => typeof key === "string"));
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** Route group that stays reachable while a password change is outstanding. */
const PASSWORD_CHANGE_ALLOWED = new Set([
  `${"/admin"}/me`,
  `${"/admin"}/credentials`,
  `${"/admin"}/profile`,
]);

const SESSION_TOUCH_INTERVAL_MS = 60_000;

export const requireAdmin = createMiddleware<AdminEnv>(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const headerToken = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const cookieHeader = c.req.header("Cookie") ?? "";
  const cookieToken =
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE_NAME}=`))
      ?.slice(ADMIN_SESSION_COOKIE_NAME.length + 1) ?? "";
  const cookieOnly = !headerToken && Boolean(cookieToken);
  const token = headerToken || cookieToken;
  if (!token) return c.json({ error: "Sign in to continue." }, 401);

  // HttpOnly cookies can accompany cross-origin requests. Validate their Origin
  // explicitly to prevent a hostile site from using a browser's admin cookie.
  if (cookieOnly) {
    const origin = c.req.header("Origin");
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return c.json({ error: "This administrator request is not allowed." }, 403);
    }
  }

  const db = service();
  const tokenHash = await sha256Hex(token);
  const { data: sessionRow } = await db
    .from("admin_sessions")
    .select("id,admin_user_id,expires_at,revoked_at,reauthenticated_at,last_seen_at")
    .eq("session_token_hash", tokenHash)
    .maybeSingle();
  const session = sessionRow as AdminSessionRow | null;
  if (!session) {
    return c.json({ error: "Your administrator session has expired. Sign in again." }, 401);
  }
  if (session.revoked_at) {
    return c.json(
      {
        error: "This administrator session was signed out.",
        code: "session_revoked",
      },
      401,
    );
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return c.json(
      {
        error: "This administrator session has expired. Sign in again.",
        code: "session_expired",
      },
      401,
    );
  }

  const { data: userData, error: userError } = await db.auth.admin.getUserById(
    session.admin_user_id,
  );
  if (userError || !userData.user) {
    return c.json(
      {
        error: "Your administrator session has expired. Sign in again.",
      },
      401,
    );
  }
  const user = userData.user;

  const { data: profileRow } = await db
    .from("admin_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile = profileRow as AdminProfile | null;
  if (!profile || !profile.is_active) {
    return c.json({ error: "This account does not have administrator access." }, 403);
  }

  // The credential record for this administrator. When it exists, its `enabled`
  // flag is authoritative: disabling an account locks it out even if a stale
  // access token and session id are still presented.
  const { data: accountRow } = await db
    .from("admin_accounts")
    .select(
      "id,user_id,username,role_key,enabled,must_change_password,failed_attempts,locked_until,last_login_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  const account = (accountRow as AdminAccountRow | null) ?? null;
  if (!account) {
    return c.json(
      {
        error: "This administrator account is not configured.",
        code: "account_missing",
      },
      403,
    );
  }
  if (!account.enabled) {
    return c.json(
      {
        error: "This administrator account is disabled.",
        code: "account_disabled",
      },
      403,
    );
  }
  if (account?.locked_until && new Date(account.locked_until).getTime() > Date.now()) {
    return c.json(
      {
        error: "This administrator account is temporarily locked. Try again shortly.",
        code: "account_locked",
      },
      403,
    );
  }

  const lastSeen = new Date(session.last_seen_at).getTime();
  if (Date.now() - lastSeen > SESSION_TOUCH_INTERVAL_MS) {
    await db
      .from("admin_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", session.id);
  }

  const roleKey: AdminRoleKey =
    profile.role_key ?? (profile.role === "super_admin" ? "super_admin" : "admin");
  const permissions = await resolvePermissions(user.id, roleKey);

  // A forced password change blocks everything except the endpoints needed to
  // complete it. This is server-side, so clearing the flag in the browser does
  // nothing.
  if (profile.must_change_password && !PASSWORD_CHANGE_ALLOWED.has(c.req.path)) {
    return c.json(
      {
        error: "Choose a new administrator password before continuing.",
        code: "password_change_required",
      },
      428,
    );
  }

  c.set("admin", {
    user,
    profile,
    account,
    roleKey,
    permissions,
    session,
  });
  await next();
});

/** Server-side permission gate. The interface hides controls for usability, but
 * this is the enforcement point: a forged `isAdmin` boolean in the browser grants
 * nothing, because the handler still has to reach a route guarded by this. */
export function requirePermission(permission: string) {
  return createMiddleware<AdminEnv>(async (c, next) => {
    const principal = c.get("admin");
    if (!principal) {
      return c.json({ error: "Sign in to continue." }, 401);
    }
    if (principal.permissions.has(permission)) {
      await next();
      return;
    }
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: principal.user.id,
      action: "admin.permission.denied",
      targetType: "permission",
      targetId: permission,
      reason: "missing_permission",
      result: "denied",
      metadata: { path: c.req.path, role: principal.roleKey },
      errorId,
    });
    return c.json(
      {
        error: `Your role does not include the "${permission}" permission.`,
        code: "forbidden",
        permission,
        errorId,
      },
      403,
    );
  });
}

/** Requires a recent password re-entry before a high-risk action. The window is
 * read from platform_settings so an administrator can widen or tighten it. */
export async function requireRecentReauth(
  c: Ctx,
  fallbackMinutes: number,
): Promise<Response | null> {
  const session = c.get("admin").session;
  const reauthenticatedAt = session?.reauthenticated_at;
  if (!reauthenticatedAt) {
    return c.json(
      {
        error: "Confirm your password before this action.",
        code: "reauth_required",
      },
      428,
    );
  }
  const { data } = await service()
    .from("platform_settings")
    .select("require_admin_reauth_minutes")
    .eq("id", true)
    .maybeSingle();
  const configured = data?.require_admin_reauth_minutes;
  const minutes = typeof configured === "number" ? configured : fallbackMinutes;
  if (Date.now() - new Date(reauthenticatedAt).getTime() > minutes * 60_000) {
    return c.json(
      {
        error: "Confirm your password before this action.",
        code: "reauth_required",
      },
      428,
    );
  }
  return null;
}
