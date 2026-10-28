import {
  supabaseConfigured,
  supabaseConfigMessage,
  supabasePublishableKey,
  supabaseUrl,
} from "../../utils/supabase/info";

const baseUrl = `${supabaseUrl}/functions/v1/server/admin`;

const SESSION_TOKEN_KEY = "velori.admin.token";
const COOKIE_MODE_KEY = "velori.admin.cookie-mode";

export class AdminApiError extends Error {
  status: number;
  errorId?: string;
  /** Machine-readable cause. `reauth_required` (428) and `password_change_required`
   * are the two the console reacts to by opening a dialog rather than by showing
   * an error toast. */
  code?: string;
  permission?: string;
  constructor(
    message: string,
    status: number,
    errorId?: string,
    code?: string,
    permission?: string,
  ) {
    super(message);
    this.status = status;
    this.errorId = errorId;
    this.code = code;
    this.permission = permission;
  }
}

/** The fallback token is isolated to this tab and is never put in localStorage. */
export function adminSessionToken(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminSessionToken(token: string | null) {
  try {
    if (token) {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      window.sessionStorage.setItem(COOKIE_MODE_KEY, "true");
    } else {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      window.sessionStorage.removeItem(COOKIE_MODE_KEY);
      // Remove the non-credential session pointer used by the previous client.
      window.localStorage.removeItem("velori.admin.session");
    }
  } catch {
    /* storage unavailable; a cookie-backed session can still work in this tab */
  }
}

function discardFallbackWhenCookieWorks() {
  try {
    if (window.sessionStorage.getItem(COOKIE_MODE_KEY) === "true") {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    /* Keep the HttpOnly cookie session even when storage is unavailable. */
  }
}

export async function adminRequest<T>(
  path: string,
  options: RequestInit = {},
  serviceName: "server" | "velori-environment" = "server",
): Promise<T> {
  if (!supabaseConfigured) {
    throw new AdminApiError(
      `${supabaseConfigMessage || "Supabase is not configured."} Copy the values from .env.example into .env.local, then set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) to the active Supabase project before using the admin console.`,
      503,
      "supabase_unconfigured",
      "supabase_unconfigured",
    );
  }

  const token = adminSessionToken();
  let cookieMode = false;
  try {
    cookieMode = window.sessionStorage.getItem(COOKIE_MODE_KEY) === "true";
  } catch {
    cookieMode = false;
  }
  let response: Response;
  try {
    const send = (withToken: boolean) => {
      const headers = new Headers(options.headers);
      headers.set("apikey", supabasePublishableKey);
      if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      if (withToken && token) headers.set("Authorization", `Bearer ${token}`);
      else headers.delete("Authorization");
      const requestBase =
        serviceName === "server" ? baseUrl : `${supabaseUrl}/functions/v1/velori-environment/admin`;
      return fetch(`${requestBase}${path}`, {
        ...options,
        credentials: "include",
        headers,
      });
    };
    response = await send(!cookieMode);
    if (cookieMode && response.status === 401 && token) {
      response = await send(true);
      if (response.ok) {
        try {
          window.sessionStorage.setItem(COOKIE_MODE_KEY, "false");
        } catch {
          /* the bearer fallback remains available in this tab */
        }
      }
    }
  } catch {
    // A rejected fetch does not identify the cause: connectivity, origin
    // restrictions and an unavailable function can all fail before a response.
    // Only the explicit gateway 404 handling below diagnoses an absent deploy.
    throw new AdminApiError(
      "The administrator service could not be reached. Check the connection, allowed site origin and deployed function status, then retry.",
      0,
      undefined,
      "admin_service_unreachable",
    );
  }
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    errorId?: string;
    code?: string;
    permission?: string;
    message?: string;
  } & T;
  if (!response.ok) {
    // A missing or unknown session means this browser has to sign in again; drop
    // the stale id so the next attempt does not keep sending it.
    if (
      response.status === 401 &&
      ["session_missing", "session_unknown", "session_expired", "session_revoked"].includes(
        payload.code ?? "",
      )
    ) {
      setAdminSessionToken(null);
    }
    const gatewayCode = response.headers.get("sb-error-code");
    if (response.status === 404 && (gatewayCode === "NOT_FOUND" || payload.code === "NOT_FOUND")) {
      throw new AdminApiError(
        "The administrator service is not deployed to this Supabase project yet. Deploy the server Edge Function, then try signing in again.",
        404,
        undefined,
        "admin_service_not_deployed",
      );
    }
    throw new AdminApiError(
      payload.error ||
        payload.message ||
        "The administrator service could not complete this request.",
      response.status,
      payload.errorId,
      payload.code,
      payload.permission,
    );
  }
  return payload;
}

function post<T>(path: string, body?: unknown) {
  return adminRequest<T>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function patch<T>(path: string, body: unknown) {
  return adminRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

function put<T>(path: string, body: unknown) {
  return adminRequest<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

function remove<T>(path: string, body?: unknown) {
  return adminRequest<T>(path, {
    method: "DELETE",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function upload<T>(path: string, form: FormData) {
  return adminRequest<T>(path, { method: "POST", body: form });
}

function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress: (value: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = adminSessionToken();
    let cookieMode = false;
    try {
      cookieMode = window.sessionStorage.getItem(COOKIE_MODE_KEY) === "true";
    } catch {
      /* cookie auth still works */
    }
    const send = (withToken: boolean) => {
      const request = new XMLHttpRequest();
      request.open("POST", `${baseUrl}${path}`);
      request.withCredentials = true;
      request.setRequestHeader("apikey", supabasePublishableKey);
      if (withToken && token) request.setRequestHeader("Authorization", `Bearer ${token}`);
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      request.onerror = () =>
        reject(
          new AdminApiError(
            "The administrator service did not answer.",
            0,
            undefined,
            "admin_service_unreachable",
          ),
        );
      request.onload = () => {
        let payload: {
          error?: string;
          message?: string;
          errorId?: string;
          code?: string;
          permission?: string;
        } = {};
        try {
          payload = JSON.parse(request.responseText) as typeof payload;
        } catch {
          /* response may be empty */
        }
        if (request.status === 401 && cookieMode && token && !withToken) {
          send(true);
          return;
        }
        if (request.status < 200 || request.status >= 300) {
          reject(
            new AdminApiError(
              payload.error || payload.message || "Upload failed.",
              request.status,
              payload.errorId,
              payload.code,
              payload.permission,
            ),
          );
          return;
        }
        onProgress(100);
        resolve(payload as T);
      };
      request.send(form);
    };
    if (!supabaseConfigured) {
      reject(
        new AdminApiError(
          supabaseConfigMessage || "Supabase is not configured.",
          503,
          "supabase_unconfigured",
          "supabase_unconfigured",
        ),
      );
      return;
    }
    send(!cookieMode && Boolean(token));
  });
}

function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

// ---------------------------------------------------------------------------
// Identity and sessions
// ---------------------------------------------------------------------------

export type AdminPermission =
  | "users.view"
  | "users.edit"
  | "users.verify"
  | "users.restrict"
  | "users.suspend"
  | "users.ban"
  | "users.notes"
  | "users.sessions"
  | "users.delete"
  | "posts.view"
  | "posts.hide"
  | "posts.restore"
  | "posts.delete"
  | "comments.view"
  | "comments.hide"
  | "comments.restore"
  | "comments.delete"
  | "reels.view"
  | "reels.hide"
  | "reels.restore"
  | "reels.delete"
  | "stories.view"
  | "stories.hide"
  | "stories.delete"
  | "reports.view"
  | "reports.update"
  | "cms.view"
  | "cms.edit"
  | "cms.publish"
  | "cms.delete"
  | "navigation.view"
  | "navigation.edit"
  | "branding.view"
  | "branding.edit"
  | "animations.view"
  | "animations.edit"
  | "motion.read"
  | "motion.write"
  | "motion.publish"
  | "theme.view"
  | "theme.edit"
  | "errorpages.view"
  | "errorpages.edit"
  | "notifications.view"
  | "notifications.edit"
  | "notifications.send"
  | "ads.view"
  | "ads.edit"
  | "flags.view"
  | "flags.edit"
  | "settings.view"
  | "settings.edit"
  | "maintenance.edit"
  | "emails.view"
  | "emails.edit"
  | "admins.view"
  | "admins.create"
  | "admins.disable"
  | "admins.delete"
  | "security.edit"
  | "roles.edit"
  | "audit.view"
  | "system.view"
  | "system.export"
  | "system.emergency";

export type AdminRoleKey = "super_admin" | "admin" | "moderator" | "content_manager" | "support";

export type AdminMe = {
  userId: string;
  username: string;
  displayName: string;
  jobTitle: string;
  bio: string;
  avatarUrl: string | null;
  role: "admin" | "super_admin";
  roleKey: AdminRoleKey;
  permissions: AdminPermission[] | string[];
  isActive: boolean;
  mustChangePassword: boolean;
  sessionId: string;
  sessionExpiresAt: string;
  reauthenticatedAt: string | null;
  mfaRequired: boolean;
};

export type AdminSessionRow = {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  reauthenticated_at: string | null;
  device_label: string | null;
  ip_address: string | null;
  user_agent: string | null;
};

export function adminMe() {
  return adminRequest<AdminMe>("/me");
}

export function updateAdminProfile(body: {
  displayName?: string;
  jobTitle?: string;
  bio?: string;
}) {
  return put<{ updated: boolean }>("/profile", body);
}

/**
 * Changes the administrator password after verifying the current password.
 * The server revokes all console sessions after a successful change.
 */
export function changeAdminCredentials(body: {
  currentPassword: string;
  password: string;
  confirmation: string;
}) {
  return put<{ signedOut: boolean; sessionsRevoked: number }>("/credentials", body);
}

export function adminSessions() {
  return adminRequest<{ sessions: AdminSessionRow[] }>("/sessions");
}

export function revokeAdminSession(id: string) {
  return remove<{ revoked: boolean }>(`/sessions/${id}`);
}

export function revokeOtherAdminSessions() {
  return post<{ revoked: number }>("/sessions/revoke-others");
}

/** Refreshes the stamp that guards high-risk administrator actions. */
export function adminReauthenticate(password: string) {
  return post<{ reauthenticatedAt: string }>("/reauthenticate", { password });
}

export async function adminLogin(username: string, password: string) {
  setAdminSessionToken(null);
  const result = await adminRequest<{
    sessionToken: string;
    sessionId: string;
    sessionExpiresAt: string;
    mustChangePassword: boolean;
    username: string;
  }>("/login", { method: "POST", body: JSON.stringify({ username, password }) });
  if (!result.sessionToken) {
    throw new AdminApiError("The secure administrator session could not be established.", 500);
  }
  setAdminSessionToken(result.sessionToken);
  await adminMe();
  discardFallbackWhenCookieWorks();
  return {
    sessionId: result.sessionId,
    sessionExpiresAt: result.sessionExpiresAt,
    mustChangePassword: result.mustChangePassword,
    username: result.username,
  };
}

/** Ends only the separate administrator session; the public VELORI Auth session stays intact. */
export async function adminLogout() {
  try {
    await post<{ revoked: boolean }>("/logout");
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401) {
      setAdminSessionToken(null);
      return;
    }
    throw error;
  }
  setAdminSessionToken(null);
}
export type AdminAccessCodeStatus = {
  /** A rotated code hash exists in the database. */
  stored: boolean;
  /** The code is currently accepted by the one-time initialization endpoint. */
  enabled: boolean;
  /** An ADMIN_SETUP_CODE Edge Function secret is also configured. */
  setupSecretConfigured: boolean;
  rotatedAt: string | null;
  /** False when the access-code migration has not been applied yet. */
  migrationsApplied: boolean;
};

export function adminAccessCodeStatus() {
  return adminRequest<AdminAccessCodeStatus>("/access-code");
}

/**
 * Replaces the administrator access code. The server requires an active
 * administrator session, derives a salted PBKDF2-HMAC-SHA256 hash, and never
 * returns or logs the plaintext. Storing the new hash is what invalidates the
 * previous code. Pass `enabled: false` to switch the code off entirely.
 */
export async function adminChangeAccessCode(newCode: string, enabled: boolean) {
  return adminRequest<{ enabled: boolean; rotatedAt: string; message: string }>("/access-code", {
    method: "PUT",
    body: JSON.stringify(enabled ? { enabled: true, newCode } : { enabled: false }),
  });
}

// ---------------------------------------------------------------------------
// Dashboard, search and diagnostics
// ---------------------------------------------------------------------------

export type AdminDashboardReport = {
  range: { key: string; label: string; since: string | null };
  totals: Record<string, number>;
  period: { newUsers: number; newPosts: number; newComments: number; newReports: number };
  /** Counts are null where this deployment has no table for the resource, so the
   * screen can say "not configured" instead of showing a misleading zero. */
  resources: Record<string, { count: number | null; available: boolean } | null>;
  storage: { available: boolean; diagnosis: string | null };
  recentUsers: Record<string, unknown>[];
  recentReports: Record<string, unknown>[];
  recentAdminActions: Record<string, unknown>[];
};

export function adminDashboard(range?: "24h" | "7d" | "30d" | "all") {
  return adminRequest<AdminDashboardReport>(`/overview${query({ range })}`);
}

export type AdminSearchResult = {
  kind:
    | "user"
    | "post"
    | "comment"
    | "report"
    | "page"
    | "group"
    | "flag"
    | "audit"
    | "reel"
    | "story"
    | "advertisement"
    | "announcement";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export function adminSearch(term: string) {
  return adminRequest<{ results: AdminSearchResult[]; query: string }>(
    `/search${query({ q: term, limit: 6 })}`,
  );
}

export type AdminAuditRow = {
  id: string;
  admin_user_id: string | null;
  admin_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string;
  result: "success" | "failure" | "denied" | string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  error_id: string | null;
  created_at: string;
};

export function adminAuditLogs(filters: {
  page?: number;
  perPage?: number;
  action?: string;
  targetType?: string;
  targetId?: string;
  adminId?: string;
  result?: string;
  since?: string;
}) {
  return adminRequest<{ logs: AdminAuditRow[]; total: number; page: number; perPage: number }>(
    `/logs${query(filters)}`,
  );
}

export type AdminTableHealth = { name: string; ok: boolean; diagnosis: string | null };

export type AdminHealthStatus = "operational" | "degraded" | "unavailable" | "unknown";

export type AdminHealthCheck = {
  name: string;
  status: AdminHealthStatus;
  detail: string;
};

export type AdminHealthReport = {
  checkedAt: string;
  latencyMs: number;
  overall: AdminHealthStatus;
  checks: AdminHealthCheck[];
};

export function adminSystemHealth() {
  return adminRequest<AdminHealthReport>("/system-health");
}

export type AdminStorageBucket = {
  name: string;
  available: boolean;
  objects: number;
  bytes: number;
  diagnosis: string | null;
};

export function adminStorageReport() {
  return adminRequest<{
    checkedAt: string;
    buckets: AdminStorageBucket[];
    references: { postMedia: number; postDraftMedia: number };
    cleanup: { available: boolean; diagnosis: string };
  }>("/system/storage");
}

export type AdminVersionReport = {
  version: string;
  console: string;
  settingsUpdatedAt: string | null;
  migrations: { required: string[]; applied: string[]; pending: string[] };
};

export function adminVersion() {
  return adminRequest<AdminVersionReport>("/system/version");
}

/** Configuration snapshot. The server builds this from an explicit allowlist and
 * never includes secrets, so the download is safe to keep. */
export type AdminConfigExport = {
  exportedAt: string;
  exportedBy: string;
  note: string;
  [section: string]: unknown;
};

export function adminConfigExport() {
  return adminRequest<AdminConfigExport>("/system/config-export");
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type AdminUserRow = {
  email?: string;
  createdAt?: string;
  adminActive?: boolean | null;
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_verified: boolean;
  is_banned: boolean;
  is_suspended: boolean;
  is_restricted: boolean;
  is_private: boolean;
  post_count?: number;
  report_count?: number;
  admin_role?: string | null;
  admin_active?: boolean | null;
};

export function adminUsers(filters: { page?: number; perPage?: number; query?: string } = {}) {
  return adminRequest<{ users: AdminUserRow[]; total: number; page: number; perPage: number }>(
    `/users${query(filters)}`,
  );
}

export function adminUser(id: string) {
  return adminRequest<Record<string, unknown>>(`/users/${id}`);
}

export type AdminUserAction =
  | "suspend"
  | "unsuspend"
  | "restrict"
  | "unrestrict"
  | "ban"
  | "unban"
  | "verify"
  | "unverify"
  | "force_logout"
  | "add_note"
  | "remove_note";

export function adminUserAction(
  id: string,
  body: { action: AdminUserAction; reason?: string; note?: string },
) {
  return post<{
    applied: boolean;
    action: AdminUserAction;
    profile: Record<string, unknown> | null;
  }>(`/users/${id}/actions`, body);
}

export function adminUserProfile(id: string, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/users/${id}/profile`, body);
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export type AdminPostRow = {
  id: string;
  body: string;
  created_at: string;
  is_hidden: boolean;
  moderation_reason: string | null;
  author?: { username?: string; display_name?: string } | null;
  media?: { id: string; media_url: string; media_type?: string }[];
  report_count?: number;
};

export function adminPosts(filters: { page?: number; perPage?: number; query?: string } = {}) {
  return adminRequest<{ posts: AdminPostRow[]; total: number; page: number; perPage: number }>(
    `/posts${query(filters)}`,
  );
}

export function adminPostAction(id: string, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/posts/${id}`, body);
}

export function adminDeletePost(id: string, reason: string) {
  return remove<Record<string, unknown>>(`/posts/${id}`, { reason });
}

export type AdminCommentRow = {
  id: string;
  body: string;
  created_at: string;
  is_hidden: boolean;
  moderation_reason: string | null;
  author?: { username?: string; display_name?: string } | null;
  post?: { id: string; body?: string } | null;
};

export function adminComments(filters: { page?: number; perPage?: number; query?: string } = {}) {
  return adminRequest<{
    comments: AdminCommentRow[];
    total: number;
    page: number;
    perPage: number;
  }>(`/comments${query(filters)}`);
}

export function adminComment(id: string, body: { hidden: boolean; reason: string }) {
  return patch<Record<string, unknown>>(`/comments/${id}`, body);
}

export function adminDeleteComment(id: string, reason: string) {
  return remove<Record<string, unknown>>(`/comments/${id}`, { reason });
}

export type AdminReportRow = {
  id: string;
  target_type: string;
  target_id: string;
  category: string;
  status: string;
  reason: string;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter?: { username?: string } | null;
  target?: { id: string; body?: string; is_hidden?: boolean } | null;
};

type AdminReportFilters = { page?: number; perPage?: number; status?: string };

export function adminReports(filters: AdminReportFilters = {}) {
  return adminRequest<{ reports: AdminReportRow[]; total: number; page: number; perPage: number }>(
    `/reports${query(filters)}`,
  );
}

export function adminMessageReports(filters: AdminReportFilters = {}) {
  return adminRequest<{ reports: AdminReportRow[]; total: number; page: number; perPage: number }>(
    `/message-reports${query(filters)}`,
  );
}

export type AdminGroupRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  privacy: "public" | "private" | "hidden" | string;
  owner_id: string;
  is_locked: boolean;
  member_count: number;
  post_count: number;
  created_at: string;
  profiles?: SocialAuthor | SocialAuthor[];
};

export function adminGroups(
  filters: {
    query?: string;
    locked?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  return adminRequest<{ items: AdminGroupRow[]; count: number; limit: number; offset: number }>(
    `/groups${query(filters)}`,
  );
}

export function adminGroupModerate(id: string, body: { locked: boolean; reason: string }) {
  return patch<{ updated: boolean; locked: boolean; group: string }>(`/groups/${id}`, body);
}

export function adminReportPatch(id: string, body: { status: string; notes?: string }) {
  return patch<{ updated: boolean; status: string }>(`/reports/${id}`, body);
}

// ---------------------------------------------------------------------------
// Reels and stories
// ---------------------------------------------------------------------------

/** The moderation states the server accepts. `clean` restores the row to the
 * reader surfaces; `removed` is permanent for reels and archives the story. */
export type ModerationState = "clean" | "hidden" | "removed" | "restricted";

export const MODERATION_STATES: ModerationState[] = ["clean", "hidden", "removed", "restricted"];

type SocialAuthor = { id?: string; username?: string; display_name?: string } | null;

export type AdminReelRow = {
  id: string;
  author_id: string;
  title: string | null;
  caption: string | null;
  status: string;
  visibility: string | null;
  is_deleted: boolean;
  is_reported: boolean;
  moderation_state: ModerationState | string;
  moderation_reason: string | null;
  moderated_at: string | null;
  created_at: string;
  profiles?: SocialAuthor | SocialAuthor[];
};

export type AdminStoryRow = {
  id: string;
  author_id: string;
  caption: string | null;
  media_type: string | null;
  audience: string | null;
  status: string;
  expires_at: string | null;
  moderation_state: ModerationState | string;
  moderation_reason: string | null;
  moderated_at: string | null;
  created_at: string;
  profiles?: SocialAuthor | SocialAuthor[];
};

/** The reels and stories queue is offset-paged rather than page/perPage, because
 * the server reads it as a moderation worklist rather than a numbered archive. */
export function adminReels(filters: {
  state?: string;
  query?: string;
  limit?: number;
  offset?: number;
}) {
  return adminRequest<{ items: AdminReelRow[]; count: number }>(`/reels${query(filters)}`);
}

export function adminStories(filters: {
  state?: string;
  query?: string;
  limit?: number;
  offset?: number;
}) {
  return adminRequest<{ items: AdminStoryRow[]; count: number }>(`/stories${query(filters)}`);
}

/**
 * Applies a moderation decision. The server refuses without a reason for every
 * state except `clean`, and refuses with 403 when the role does not hold the
 * matching `reels.*`/`stories.*` permission for that state.
 */
export function adminModerateReel(id: string, body: { state: ModerationState; reason?: string }) {
  return patch<{ updated: boolean; state: string; moderatedAt: string }>(`/reels/${id}`, body);
}

export function adminModerateStory(id: string, body: { state: ModerationState; reason?: string }) {
  return patch<{ updated: boolean; state: string; moderatedAt: string }>(`/stories/${id}`, body);
}

// ---------------------------------------------------------------------------
// CMS, routes and navigation
// ---------------------------------------------------------------------------

export type CmsPage = {
  id: string;
  title: string;
  slug: string;
  route: string;
  status: "draft" | "published" | "scheduled" | "disabled" | string;
  content: string;
  seo_title: string | null;
  seo_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  hero_image: string | null;
  custom_html: string;
  custom_css: string;
  custom_js: string;
  content_mode: "visual" | "custom_html";
  content_blocks: Record<string, unknown>[];
  footer_enabled: boolean;
  animation_enabled: boolean;
  published_at: string | null;
  published_by?: string | null;
  published_version?: number;
  draft_content: Record<string, unknown> | null;
  draft_updated_at: string | null;
  updated_at: string;
};

export function adminCmsPages(
  filters: { page?: number; perPage?: number; status?: string; query?: string } = {},
) {
  return adminRequest<{ pages: CmsPage[]; total: number; page: number; perPage: number }>(
    `/cms/pages${query(filters)}`,
  );
}

export function adminCmsPage(id: string) {
  return adminRequest<{ page: CmsPage }>(`/cms/pages/${id}`);
}

export function adminCreateCmsPage(body: Record<string, unknown>) {
  return post<{ page: CmsPage }>("/cms/pages", body);
}

export function adminPatchCmsPage(id: string, body: Record<string, unknown>) {
  return patch<{ page: CmsPage }>(`/cms/pages/${id}`, body);
}

export function adminPublishCmsPage(
  id: string,
  summary: string,
  expectedDraftUpdatedAt?: string | null,
) {
  return post<{ page: CmsPage; version: number }>(`/cms/pages/${id}/publish`, {
    summary,
    expected_draft_updated_at: expectedDraftUpdatedAt,
  });
}

export function adminDeleteCmsPage(id: string, reason: string) {
  return remove<Record<string, unknown>>(`/cms/pages/${id}`, { reason });
}

export function adminDuplicateCmsPage(id: string) {
  return post<{ page: CmsPage }>(`/cms/pages/${id}/duplicate`);
}

export function adminCmsVersions(id: string) {
  return adminRequest<{ versions: Record<string, unknown>[] }>(`/cms/pages/${id}/versions`);
}

export function adminRestoreCmsVersion(id: string, version: string) {
  return post<{ page: CmsPage }>(`/cms/pages/${id}/versions/${version}/restore`);
}

export function adminRoutes(filters: { page?: number; perPage?: number } = {}) {
  return adminRequest<{ routes: Record<string, unknown>[]; total: number }>(
    `/routes${query(filters)}`,
  );
}

export function adminPatchRoute(route: string, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/routes/${route.replace(/^\//, "")}`, body);
}

export type NavItem = {
  id: string;
  label: string;
  route: string;
  icon: string;
  required_role: string;
  feature_flag: string;
  position: number;
  visible: boolean;
  desktop_visible: boolean;
  mobile_visible: boolean;
  /** Present once migration 20261016000000 is applied. */
  navigation_scope?: "public" | "admin";
};

export function adminNavigation(scope?: "public" | "admin") {
  return adminRequest<{ navigation: NavItem[]; scopes: string[] }>(
    `/navigation${query({ scope })}`,
  );
}

export function adminCreateNavigationItem(body: Record<string, unknown>) {
  return post<{ item: NavItem }>("/navigation", body);
}

export function adminPatchNavigationItem(id: string, body: Record<string, unknown>) {
  return patch<{ item: NavItem }>(`/navigation/${id}`, body);
}

export function adminDeleteNavigationItem(id: string, reason: string) {
  return remove<Record<string, unknown>>(`/navigation/${id}`, { reason });
}

export function adminReorderNavigation(order: string[]) {
  return post<{ items: NavItem[] }>("/navigation/reorder", { order });
}

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------

export function adminBranding() {
  return adminRequest<{
    assets: Record<string, unknown>[];
    slots: string[];
    live: Record<string, unknown>;
  }>("/branding");
}

export function adminUploadBranding(slot: string, file: File) {
  const form = new FormData();
  form.set("slot", slot);
  form.set("file", file);
  return upload<Record<string, unknown>>("/branding", form);
}

export function adminRestoreBrandingVersion(assetId: string, version: number) {
  return post<Record<string, unknown>>(`/branding/${assetId}/restore/${version}`);
}

export function adminPatchBranding(id: string, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/branding/${id}`, body);
}

export function adminAnimations() {
  return adminRequest<{
    animations: Record<string, unknown>[];
    reduceMotionSafeMode: boolean;
    availableTypes: string[];
    availableEasings: string[];
  }>("/animations");
}

export function adminMotionCms() {
  return adminRequest<{
    draft: Record<string, unknown>;
    published: Record<string, unknown>;
    publishedVersion: number;
    publishedAt: string;
    updatedAt: string;
    presets: Record<string, unknown>[];
    versions: Record<string, unknown>[];
    routes: Record<string, unknown>[];
    animations: Record<string, unknown>[];
  }>("/design/motion");
}

export type StudioTarget = "story" | "reel" | "post";
export type StudioCatalogAdmin = {
  music: Array<Record<string, unknown>>;
  stickers: Array<Record<string, unknown>>;
  categories: Array<{ id: string; name: string; sort_order: number; archived_at?: string | null }>;
};

export function adminStudioCatalog() {
  return adminRequest<StudioCatalogAdmin>("/studio-catalog");
}

export type CreatorSourceFile = { path: string; sha: string; bytes: number };
export type CreatorSourceManifest = {
  branch: string;
  baseSha: string;
  files: CreatorSourceFile[];
  deployment: { state: string; message: string };
};

export function adminCreatorSourceFiles() {
  return adminRequest<CreatorSourceManifest>("/creator-source/files");
}

export function adminCreatorSourceFile(path: string) {
  return adminRequest<{
    path: string;
    content: string;
    sha: string;
    baseSha: string;
    branch: string;
  }>(`/creator-source/file?path=${encodeURIComponent(path)}`);
}

export function adminCreateCreatorSourcePullRequest(body: {
  title: string;
  body?: string;
  baseSha: string;
  files: Array<{ path: string; content: string; sha: string }>;
}) {
  return post<{
    branch: string;
    commit: string;
    pullRequest: { number: number; url: string; state: string };
    reused?: boolean;
    deployment: { state: string; message: string };
  }>("/creator-source/pull-request", body);
}

export function adminCreateMusic(form: FormData, onProgress: (value: number) => void) {
  return uploadWithProgress<{ id: string }>("/studio-catalog/music", form, onProgress);
}

export function adminCreateSticker(form: FormData, onProgress: (value: number) => void) {
  return uploadWithProgress<{ id: string }>("/studio-catalog/stickers", form, onProgress);
}

export function adminPatchStudioCatalog(
  type: "music" | "stickers",
  id: string,
  body: Record<string, unknown>,
) {
  return patch<{ id: string; status: string }>(`/studio-catalog/${type}/${id}`, body);
}

export function adminDeleteStudioCatalog(type: "music" | "stickers", id: string) {
  return remove<{ ok: boolean }>(`/studio-catalog/${type}/${id}`);
}

export function adminCreateStickerCategory(name: string) {
  return post<{ id: string; name: string }>("/studio-catalog/sticker-categories", { name });
}

export function adminPatchStickerCategory(id: string, body: Record<string, unknown>) {
  return patch<{ id: string; name: string; sort_order: number; archived_at: string | null }>(
    `/studio-catalog/sticker-categories/${encodeURIComponent(id)}`,
    body,
  );
}

export function adminReplaceStudioCatalogAsset(
  type: "music" | "stickers",
  id: string,
  form: FormData,
  onProgress: (value: number) => void,
) {
  return uploadWithProgress<{ id: string; replaced: boolean }>(
    `/studio-catalog/${type}/${encodeURIComponent(id)}/asset`,
    form,
    onProgress,
  );
}

export function adminSaveMotionDraft(body: { config: Record<string, unknown>; summary: string }) {
  return put<Record<string, unknown>>("/design/motion/draft", body);
}

export function adminPublishMotion(summary: string) {
  return post<Record<string, unknown>>("/design/motion/publish", { summary });
}

export function adminRestoreMotionVersion(version: number) {
  return post<Record<string, unknown>>(`/design/motion/restore/${version}`);
}

export function adminPatchAnimation(key: string, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/animations/${encodeURIComponent(key)}`, body);
}

export function adminUploadMotion(target: "library", file: File, key?: string) {
  const form = new FormData();
  form.set("target", target);
  if (key) form.set("key", key);
  form.set("file", file);
  return upload<Record<string, unknown>>("/motion", form);
}

export function adminAppearance() {
  return adminRequest<Record<string, unknown>>("/appearance");
}

export async function adminSaveAppearance(body: Record<string, unknown>) {
  const result = await put<{ theme: Record<string, unknown> }>("/appearance", body);
  if (typeof window !== "undefined" && result.theme) {
    window.dispatchEvent(new CustomEvent("public-theme-updated", { detail: result.theme }));
    try {
      window.localStorage.setItem("velori-public-theme-updated", JSON.stringify(result.theme));
    } catch {
      // Realtime remains available when local storage cannot notify other tabs.
    }
  }
  return result;
}

export function adminErrorPages() {
  return adminRequest<{
    pages: Record<string, unknown>[];
    codes: string[];
    live: Record<string, unknown>;
  }>("/error-pages");
}

export function adminPatchErrorPage(code: string, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/error-pages/${code}`, body);
}

/** Uploads a sanitized SVG for selection in an unpublished motion draft. */
export function adminUploadErrorIllustration(code: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  return upload<{ url: string; path: string }>(
    `/media/error-illustrations/${encodeURIComponent(code)}`,
    form,
  );
}

// ---------------------------------------------------------------------------
// Announcements, notifications, ads, flags
// ---------------------------------------------------------------------------

export function adminAnnouncements(
  filters: { page?: number; perPage?: number; status?: string; state?: string; q?: string } = {},
) {
  return adminRequest<{
    announcements: Record<string, unknown>[];
    total: number;
    counts?: Record<string, number>;
  }>(`/announcements${query(filters)}`);
}

export function adminCreateAnnouncement(body: Record<string, unknown>) {
  return post<{ announcement: Record<string, unknown> }>("/announcements", body);
}

export function adminUploadAnnouncementMedia(file: File) {
  const form = new FormData();
  form.set("file", file);
  return upload<{ url: string; path: string; type: string }>("/announcements/media", form);
}

export function adminPatchAnnouncement(id: string, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/announcements/${id}`, body);
}

export function adminPublishAnnouncement(id: string, expectedVersion: number) {
  return post<Record<string, unknown>>(`/announcements/${id}/publish`, {
    expected_version: expectedVersion,
  });
}

export function adminAnnouncementVersions(id: string) {
  return adminRequest<{ versions: Record<string, unknown>[] }>(`/announcements/${id}/versions`);
}

export function adminRestoreAnnouncementVersion(id: string, version: number) {
  return post<Record<string, unknown>>(`/announcements/${id}/restore`, { version });
}

export function adminDeleteAnnouncement(id: string, reason: string) {
  return remove<Record<string, unknown>>(`/announcements/${id}`, { reason });
}

export function adminNotifications(
  filters: { status?: string; page?: number; perPage?: number } = {},
) {
  return adminRequest<{ notifications: Record<string, unknown>[]; total: number }>(
    `/notifications${query(filters)}`,
  );
}

export function adminCreateNotification(body: Record<string, unknown>) {
  return post<{
    sent: true;
    recipientCount: number;
    notification: Record<string, unknown>;
  }>("/notifications", body);
}

export function adminDeleteNotification(id: string, reason: string) {
  return remove<Record<string, unknown>>(`/notifications/${id}`, { reason });
}

export function adminAds(
  filters: { page?: number; perPage?: number; status?: string; q?: string } = {},
) {
  return adminRequest<{
    advertisements: Record<string, unknown>[];
    total: number;
    counts?: Record<string, number>;
  }>(`/ads${query(filters)}`);
}

export function adminCreateAd(body: Record<string, unknown>) {
  return post<Record<string, unknown>>("/ads", body);
}

export function adminUploadAdMedia(file: File) {
  const form = new FormData();
  form.set("file", file);
  return upload<{ url: string; path: string; type: string }>("/ads/media", form);
}

export function adminPatchAd(id: string, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/ads/${id}`, body);
}

export function adminDeleteAd(id: string, reason: string) {
  return remove<Record<string, unknown>>(`/ads/${id}`, { reason });
}

export function adminPublishAd(id: string, expectedVersion: number) {
  return post<Record<string, unknown>>(`/ads/${id}/publish`, {
    expected_version: expectedVersion,
  });
}

export function adminAdVersions(id: string) {
  return adminRequest<{ versions: Record<string, unknown>[] }>(`/ads/${id}/versions`);
}

export function adminRestoreAdVersion(id: string, version: number) {
  return post<Record<string, unknown>>(`/ads/${id}/restore`, { version });
}

export function adminFeatureFlags() {
  return adminRequest<{
    flags: Record<string, unknown>[];
    consumed: Record<string, string>;
    roles: AdminRoleKey[];
  }>("/feature-flags");
}

export function adminPatchFeatureFlag(key: string, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/feature-flags/${encodeURIComponent(key)}`, body);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function adminSiteSettings() {
  return adminRequest<{ settings: Record<string, unknown> }>("/settings");
}

export async function adminSaveSiteSettings(body: Record<string, unknown>) {
  const result = await put<{ settings: Record<string, unknown> }>("/settings", body);
  if (typeof window !== "undefined") {
    const update = { settings: result.settings, updatedAt: Date.now() };
    window.dispatchEvent(new CustomEvent("site-settings-updated", { detail: result.settings }));
    try {
      window.localStorage.setItem("velori-site-settings-updated", JSON.stringify(update));
    } catch {
      // Realtime remains available when local storage cannot notify other tabs.
    }
  }
  return result;
}

export function adminPlatformSettings() {
  return adminRequest<{ settings: Record<string, unknown> }>("/platform-settings");
}

export function adminSavePlatformSettings(body: Record<string, unknown>) {
  return put<{ settings: Record<string, unknown> }>("/platform-settings", body);
}

/** Maintenance mode. Destructive: requires recent reauthentication and a reason. */
export function adminEmergencyMode(body: { enabled: boolean; reason: string; message?: string }) {
  return post<{
    applied: boolean;
    settings: { maintenance_mode: boolean };
    warning?: string | null;
  }>("/platform-settings/emergency", body);
}

export function adminUploadAsset(file: File, kind: string) {
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  const path = kind === "maintenance_animation_url" ? "/maintenance-assets" : "/assets";
  return upload<{ url: string; path: string }>(path, form);
}

// ---------------------------------------------------------------------------
// Administrators, roles, provisioning, email templates
// ---------------------------------------------------------------------------

export function adminAdmins() {
  return adminRequest<{ administrators: Record<string, unknown>[] }>("/admins");
}

export function adminCreateAdmin(body: Record<string, unknown>) {
  return post<Record<string, unknown>>("/admins", body);
}

export function adminPatchAdmin(id: string, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/admins/${id}`, body);
}

export function adminDeleteAdmin(id: string, body: { reason: string }) {
  return remove<Record<string, unknown>>(`/admins/${id}`, body);
}

export function adminRoles() {
  return adminRequest<{
    roles: Record<string, unknown>[];
    permissions: Record<string, unknown>[];
  }>("/roles");
}

export function adminPatchRole(roleKey: AdminRoleKey, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/roles/${roleKey}`, body);
}

export type AdminProvisioningStatus = {
  primaryUsername: string;
  initialPasswordConfigured: boolean;
  initialized: boolean;
  administrators: Record<string, unknown>[];
};

export function adminProvisioningStatus() {
  return adminRequest<AdminProvisioningStatus>("/provisioning");
}

export function adminEmails() {
  return adminRequest<{ templates: Record<string, unknown>[] }>("/emails");
}

export function adminPatchEmail(key: string, body: Record<string, unknown>) {
  return patch<Record<string, unknown>>(`/emails/${encodeURIComponent(key)}`, body);
}

/**
 * Not implemented server-side: Supabase delivers transactional email through the
 * project's own SMTP provider, which this function cannot reach. The endpoint
 * answers 501 with a diagnosis rather than pretending a send succeeded.
 */
export function adminTestEmail(key: string, recipient: string) {
  return post<{ error: string; code: string; howToVerify: string }>(
    `/emails/${encodeURIComponent(key)}/test`,
    { recipient },
  );
}

export function environmentRequest<T>(options: RequestInit = {}) {
  return adminRequest<T>("/environment", { ...options, cache: "no-store" }, "velori-environment");
}
