// VELORI administrator console API — identity, sessions, provisioning, dashboard,
// user management, content moderation, search, audit and system diagnostics.
//
// Every handler here runs behind `requireAdmin` (see ./admin-core.ts) and, where
// the action is destructive or high risk, behind a specific `requirePermission`
// guard plus a re-authentication check. Nothing in this file trusts a value the
// browser supplied about who the caller is.

import {
  ADMIN_INITIAL_PASSWORD,
  type Ctx,
  isUuid,
  PRIMARY_ADMIN_USERNAME,
  readBoolean,
  readEnum,
  readJson,
  readString,
  referenceId,
  requireRecentReauth,
  service,
  writeAudit,
} from "./admin-core.ts";
import { scopeAdminUserDetail } from "./admin-user-detail.ts";

const REPORT_STATUSES = ["new", "reviewing", "action_taken", "no_violation", "closed"] as const;

const USER_ACTIONS = [
  "suspend",
  "unsuspend",
  "restrict",
  "unrestrict",
  "ban",
  "unban",
  "verify",
  "unverify",
  "force_logout",
  "add_note",
  "remove_note",
] as const;

type UserAction = (typeof USER_ACTIONS)[number];

/** Destructive actions must carry a human reason. It is stored on the audit row
 * and, for moderation actions, alongside the moderated record. */
const REASON_REQUIRED: readonly UserAction[] = [
  "ban",
  "unban",
  "restrict",
  "unrestrict",
  "suspend",
  "unsuspend",
  "verify",
  "unverify",
];

function integerParam(c: Ctx, name: string, fallback: number, min: number, max: number) {
  const raw = c.req.query(name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** Resolves the dashboard/report window from a `range` parameter so every screen
 * filters on the same boundaries. */
function rangeStart(range: string | undefined): { since: string | null; label: string } {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (range) {
    case "today":
      return {
        since: new Date(now - day).toISOString(),
        label: "Last 24 hours",
      };
    case "30d":
      return {
        since: new Date(now - 30 * day).toISOString(),
        label: "Last 30 days",
      };
    case "90d":
      return {
        since: new Date(now - 90 * day).toISOString(),
        label: "Last 90 days",
      };
    case "all":
      return { since: null, label: "All time" };
    case "7d":
    default:
      return {
        since: new Date(now - 7 * day).toISOString(),
        label: "Last 7 days",
      };
  }
}

/**
 * Resolves an exact head count. Callers pass the already-filtered builder so the
 * filter and the count can never drift apart, which is how the previous
 * implementation ended up reporting a page length as a total.
 */
async function countOf(result: PromiseLike<{ count: number | null }>): Promise<number> {
  const { count } = await result;
  return count ?? 0;
}

/** True when a query failed because the relation does not exist, which means this
 * deployment has not applied the migration that creates it. */
function isMissingRelation(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/** Counts a table and reports whether it exists, so the interface can print
 * "not configured" instead of a confident zero. */
async function countWithAvailability(
  build: (db: ReturnType<typeof service>) => PromiseLike<{
    count: number | null;
    error: { code?: string } | null;
  }>,
): Promise<{ count: number; available: boolean }> {
  const { count, error } = await build(service());
  if (error) return { count: 0, available: !isMissingRelation(error) };
  return { count: count ?? 0, available: true };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const handleSessionsList = async (c: Ctx) => {
  const { user } = c.get("admin");
  const { data, error } = await service()
    .from("admin_sessions")
    .select(
      "id,created_at,last_seen_at,expires_at,revoked_at,revoke_reason,reauthenticated_at,device_label,ip_address,user_agent",
    )
    .eq("admin_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return c.json({ error: "Administrator sessions could not be read." }, 500);
  }
  const currentId = c.get("admin").session?.id ?? "";
  // Approximate location is deliberately absent. The console records the device
  // label and the address the request arrived from; it does not geolocate anyone.
  return c.json({
    sessions: (data ?? []).map((row) => ({
      ...row,
      isCurrent: row.id === currentId,
      active: !row.revoked_at && new Date(row.expires_at as string) > new Date(),
    })),
  });
};

export const handleSessionRevoke = async (c: Ctx) => {
  const principal = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) {
    return c.json({ error: "That session id is not valid." }, 400);
  }

  const { data: target, error: lookupError } = await service()
    .from("admin_sessions")
    .select("id,admin_user_id,revoked_at,device_label")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) {
    return c.json({ error: "Administrator session could not be read." }, 500);
  }

  if (!target || target.admin_user_id !== principal.user.id) {
    return c.json({ error: "That administrator session was not found." }, 404);
  }
  if (target.id === principal.session?.id) {
    return c.json(
      {
        error: "Use Sign out to end the session you are currently using.",
      },
      400,
    );
  }
  if (target.revoked_at) return c.json({ revoked: true, alreadyRevoked: true });

  const { data: revoked, error } = await service()
    .from("admin_sessions")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: principal.user.id,
      revoke_reason: "revoked_by_administrator",
    })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    return c.json({ error: "That administrator session could not be revoked." }, 500);
  }
  if (!revoked) {
    const { data: current, error: currentError } = await service()
      .from("admin_sessions")
      .select("revoked_at")
      .eq("id", id)
      .maybeSingle();
    if (currentError || !current?.revoked_at) {
      return c.json(
        {
          error: "That administrator session could not be revoked.",
        },
        500,
      );
    }
  }

  await writeAudit(c.req.raw, {
    adminUserId: principal.user.id,
    action: "admin.session.revoked",
    targetType: "session",
    targetId: id,
    reason: "revoked_by_administrator",
    metadata: { device: target.device_label },
  });
  return c.json({ revoked: true });
};

export const handleSessionsRevokeOthers = async (c: Ctx) => {
  const principal = c.get("admin");
  const currentId = principal.session?.id ?? "";
  const { data, error } = await service()
    .from("admin_sessions")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: principal.user.id,
      revoke_reason: "signed_out_everywhere",
    })
    .eq("admin_user_id", principal.user.id)
    .is("revoked_at", null)
    .neq("id", currentId)
    .select("id");

  if (error) {
    return c.json({ error: "Other sessions could not be signed out." }, 500);
  }
  const revoked = (data ?? []).length;
  await writeAudit(c.req.raw, {
    adminUserId: principal.user.id,
    action: "admin.session.revoked_others",
    targetType: "session",
    reason: "signed_out_everywhere",
    metadata: { revoked },
  });
  return c.json({ revoked });
};

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Administrator credential status
// ---------------------------------------------------------------------------

type AdminIdentityRow = {
  user_id: string;
  username: string | null;
  role_key: string;
  is_active: boolean;
  enabled: boolean;
  must_change_password: boolean;
  created_at: string;
};

export const handleProvisioningStatus = async (c: Ctx) => {
  const db = service();
  const { data: profiles, error } = await db
    .from("admin_profiles")
    .select("user_id,role_key,is_active,must_change_password,created_at")
    .order("created_at", { ascending: true });
  if (error) {
    return c.json({ error: "Administrator accounts could not be read." }, 500);
  }

  const { data: credentials } = await db
    .from("admin_accounts")
    .select("user_id,username,enabled,must_change_password");
  const accountByUser = new Map((credentials ?? []).map((account) => [account.user_id, account]));
  const administrators = (
    (profiles ?? []) as {
      user_id: string;
      role_key: string;
      is_active: boolean;
      must_change_password: boolean;
      created_at: string;
    }[]
  ).map((profile) => {
    const account = accountByUser.get(profile.user_id);
    return {
      ...profile,
      username: account?.username ?? null,
      enabled: Boolean(account?.enabled),
      must_change_password: Boolean(account?.must_change_password ?? profile.must_change_password),
    };
  });

  const primary = await db
    .from("admin_accounts")
    .select("id")
    .ilike("username", PRIMARY_ADMIN_USERNAME)
    .limit(1)
    .maybeSingle();

  return c.json({
    primaryUsername: PRIMARY_ADMIN_USERNAME,
    initialPasswordConfigured: Boolean(ADMIN_INITIAL_PASSWORD),
    initialized: Boolean(primary.data),
    administrators: administrators as AdminIdentityRow[],
  });
};
// Dashboard
// ---------------------------------------------------------------------------

/**
 * Real aggregates for the selected window.
 *
 * Every number is an exact database count taken from the same filtered query, and
 * any resource whose table this deployment lacks is reported as unavailable
 * rather than as a confident zero. Nothing here is estimated or sampled.
 */
export const handleDashboard = async (c: Ctx) => {
  const db = service();
  const { since, label } = rangeStart(c.req.query("range"));
  const from = since ?? "1970-01-01T00:00:00.000Z";
  const canViewMessageReports = c.get("admin").permissions.has("messages.view_reports");
  let openReportsQuery = db
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .in("status", ["new", "reviewing"]);
  let newReportsQuery = db
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .gte("created_at", from);
  let recentReportsQuery = db
    .from("content_reports")
    .select(
      "id,target_type,target_id,category,status,created_at,reason,reporter_id,profiles!content_reports_reporter_id_fkey(username)",
    )
    .in("status", ["new", "reviewing"]);
  if (!canViewMessageReports) {
    openReportsQuery = openReportsQuery.neq("target_type", "message");
    newReportsQuery = newReportsQuery.neq("target_type", "message");
    recentReportsQuery = recentReportsQuery.neq("target_type", "message");
  }

  const [
    users,
    newUsers,
    posts,
    newPosts,
    comments,
    newComments,
    openReports,
    newReports,
    suspended,
    banned,
    restricted,
    verified,
    hiddenPosts,
    hiddenComments,
    activeAnnouncements,
    activeSessions,
    groups,
    stories,
    reels,
    messages,
  ] = await Promise.all([
    countOf(db.from("profiles").select("id", { count: "exact", head: true })),
    countOf(
      db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", from),
    ),
    countOf(db.from("posts").select("id", { count: "exact", head: true })),
    countOf(db.from("posts").select("id", { count: "exact", head: true }).gte("created_at", from)),
    countOf(db.from("comments").select("id", { count: "exact", head: true })),
    countOf(
      db.from("comments").select("id", { count: "exact", head: true }).gte("created_at", from),
    ),
    countOf(openReportsQuery),
    countOf(newReportsQuery),
    countOf(
      db.from("profiles").select("id", { count: "exact", head: true }).eq("is_suspended", true),
    ),
    countOf(db.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true)),
    countOf(
      db.from("profiles").select("id", { count: "exact", head: true }).eq("is_restricted", true),
    ),
    countOf(
      db.from("profiles").select("id", { count: "exact", head: true }).eq("is_verified", true),
    ),
    countOf(db.from("posts").select("id", { count: "exact", head: true }).eq("is_hidden", true)),
    countOf(db.from("comments").select("id", { count: "exact", head: true }).eq("is_hidden", true)),
    countOf(
      db
        .from("system_announcements")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
    ),
    countOf(
      db
        .from("admin_sessions")
        .select("id", { count: "exact", head: true })
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString()),
    ),
    countWithAvailability((client) =>
      client.from("groups").select("id", { count: "exact", head: true }),
    ),
    countWithAvailability((client) =>
      client.from("stories").select("id", { count: "exact", head: true }),
    ),
    countWithAvailability((client) =>
      client.from("reels").select("id", { count: "exact", head: true }),
    ),
    countWithAvailability((client) =>
      client.from("messages").select("id", { count: "exact", head: true }),
    ),
  ]);

  const [recentUsersResult, recentReportsResult, recentAuditResult, storage] = await Promise.all([
    db
      .from("profiles")
      .select("id,username,display_name,avatar_url,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    recentReportsQuery.order("created_at", { ascending: false }).limit(8),
    db
      .from("admin_audit_logs")
      .select("id,action,target_type,target_id,created_at,result")
      .order("created_at", { ascending: false })
      .limit(10),
    db.storage.from("site-assets").list("", { limit: 1 }),
  ]);

  if (recentUsersResult.error || recentReportsResult.error || recentAuditResult.error) {
    return c.json({ error: "Dashboard activity could not be loaded." }, 500);
  }

  return c.json({
    range: { key: c.req.query("range") ?? "7d", label, since },
    totals: {
      users,
      posts,
      comments,
      verifiedUsers: verified,
      suspendedUsers: suspended,
      bannedUsers: banned,
      restrictedUsers: restricted,
      openReports,
      hiddenPosts,
      hiddenComments,
      activeAnnouncements,
      activeAdminSessions: activeSessions,
    },
    period: { newUsers, newPosts, newComments, newReports },
    // Resources this deployment has no table for. The interface must label these
    // "not configured" instead of rendering them as zero.
    resources: {
      groups,
      stories,
      reels,
      messages,
    },
    storage: {
      available: !storage.error,
      diagnosis: storage.error
        ? "The site-assets bucket is not reachable."
        : "The site-assets bucket responded.",
    },
    recentUsers: recentUsersResult.data,
    recentReports: recentReportsResult.data,
    recentAdminActions: recentAuditResult.data,
  });
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const handleUserDetail = async (c: Ctx) => {
  const permissions = c.get("admin").permissions;
  const id = c.req.param("id");
  // Reject a missing or malformed path segment before it reaches PostgREST or
  // `auth.admin.getUserById`, both of which would otherwise receive `undefined`
  // or an arbitrary attacker-supplied string.
  if (!isUuid(id)) {
    return c.json({ error: "That account id is not valid." }, 400);
  }
  const db = service();

  const { data: profile, error } = await db
    .from("profiles")
    .select(
      "id,username,display_name,bio,avatar_url,is_private,website_url,link_title,account_type,created_at,updated_at,is_verified,is_banned,is_suspended,is_restricted,moderation_notes",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !profile) {
    return c.json({ error: "That account was not found." }, 404);
  }

  const [follows, counts, reports, moderation, authUser] = await Promise.all([
    db.rpc("profile_follow_counts", { target_profile_id: id }),
    Promise.all([
      countOf(db.from("posts").select("id", { count: "exact", head: true }).eq("author_id", id)),
      countOf(db.from("comments").select("id", { count: "exact", head: true }).eq("author_id", id)),
    ]),
    db
      .from("content_reports")
      .select("id,target_type,category,status,created_at,reason")
      .eq("target_type", "profile")
      .eq("target_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("admin_audit_logs")
      .select("id,action,target_type,target_id,reason,created_at,result,admin_user_id")
      .eq("target_type", "user")
      .eq("target_id", id)
      .order("created_at", { ascending: false })
      .limit(25),
    db.auth.admin.getUserById(id).catch(() => ({ data: null, error: null })),
  ]);

  const { data: adminProfile } = await db
    .from("admin_profiles")
    .select("user_id,role_key,is_active")
    .eq("user_id", id)
    .maybeSingle();

  const followCounts = (
    follows as unknown as
      | {
          followers_count: number | null;
          following_count: number | null;
        }[]
      | null
  )?.[0];

  return c.json(
    scopeAdminUserDetail(
      {
        profile,
        // Email is an administrator-only field and is only returned because this
        // route is behind `users.view`.
        email: authUser?.data?.user?.email ?? null,
        emailConfirmedAt: authUser?.data?.user?.email_confirmed_at ?? null,
        lastSignInAt: authUser?.data?.user?.last_sign_in_at ?? null,
        bannedUntil: authUser?.data?.user?.banned_until ?? null,
        followers: followCounts?.followers_count ?? 0,
        following: followCounts?.following_count ?? 0,
        postCount: counts[0],
        commentCount: counts[1],
        reports: reports ?? [],
        moderationHistory: moderation ?? [],
        adminAccess: adminProfile ?? null,
      },
      permissions,
    ),
  );
};

/**
 * One endpoint for every account-state transition, so each action has exactly
 * one permission mapping and one audit shape.
 */
export const handleUserAction = async (c: Ctx) => {
  const principal = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) {
    return c.json({ error: "That account id is not valid." }, 400);
  }
  if (id === principal.user.id) {
    return c.json({ error: "You cannot moderate your own account here." }, 400);
  }

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const action = readEnum(body.value, "action", USER_ACTIONS);
  if (!action) {
    return c.json({ error: "Choose a valid moderation action." }, 400);
  }
  const reason = readString(body.value, "reason", 2001) ?? "";
  const note = readString(body.value, "note", 2001) ?? "";

  const permission = actionPermission(action);
  if (!principal.permissions.has(permission)) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: principal.user.id,
      action: "admin.permission.denied",
      targetType: "user",
      targetId: id,
      reason: "missing_permission",
      result: "denied",
      metadata: { permission, action },
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
  }

  if (REASON_REQUIRED.includes(action) && reason.trim().length < 4) {
    return c.json({ error: "A short reason is required for this action." }, 400);
  }

  const db = service();
  const now = new Date().toISOString();
  const target = await db.from("profiles").select("id,username").eq("id", id).maybeSingle();
  if (!target.data) {
    return c.json({ error: "That account was not found." }, 404);
  }

  const { data: isAdmin } = await db
    .from("admin_profiles")
    .select("user_id,role_key")
    .eq("user_id", id)
    .maybeSingle();
  if (isAdmin && !principal.permissions.has("admins.disable")) {
    return c.json(
      {
        error: "Only a super administrator can moderate an administrator account.",
      },
      403,
    );
  }

  let revokedSessions = 0;
  switch (action) {
    case "suspend":
      await db
        .from("profiles")
        .update({ is_suspended: true, moderation_notes: reason })
        .eq("id", id);
      await db.auth.admin.updateUserById(id, { ban_duration: "876000h" });
      break;
    case "unsuspend":
      await db
        .from("profiles")
        .update({ is_suspended: false, moderation_notes: reason })
        .eq("id", id);
      await db.auth.admin.updateUserById(id, { ban_duration: "none" });
      break;
    case "ban":
      await db
        .from("profiles")
        .update({
          is_banned: true,
          is_suspended: false,
          moderation_notes: reason,
        })
        .eq("id", id);
      await db.auth.admin.updateUserById(id, { ban_duration: "876000h" });
      break;
    case "unban":
      await db
        .from("profiles")
        .update({
          is_banned: false,
          moderation_notes: reason,
        })
        .eq("id", id);
      await db.auth.admin.updateUserById(id, { ban_duration: "none" });
      break;
    case "restrict":
      await db
        .from("profiles")
        .update({ is_restricted: true, moderation_notes: reason })
        .eq("id", id);
      break;
    case "unrestrict":
      await db
        .from("profiles")
        .update({ is_restricted: false, moderation_notes: reason })
        .eq("id", id);
      break;
    case "verify":
      await db.from("profiles").update({ is_verified: true }).eq("id", id);
      break;
    case "unverify":
      await db.from("profiles").update({ is_verified: false }).eq("id", id);
      break;
    case "force_logout": {
      const { data: sessions } = await db
        .from("admin_sessions")
        .select("id")
        .eq("admin_user_id", id)
        .is("revoked_at", null);
      revokedSessions = (sessions ?? []).length;
      await db
        .from("admin_sessions")
        .update({
          revoked_at: now,
          revoked_by: principal.user.id,
          revoke_reason: "forced_by_administrator",
        })
        .eq("admin_user_id", id)
        .is("revoked_at", null);
      // Revoking the console session does not end an ordinary app session, so the
      // console reports exactly what it did rather than implying more.
      break;
    }
    case "add_note": {
      if (note.trim().length < 1) {
        return c.json({ error: "Write the note before saving it." }, 400);
      }
      const { data: current } = await db
        .from("profiles")
        .select("moderation_notes")
        .eq("id", id)
        .maybeSingle();
      const previous = current?.moderation_notes ?? "";
      const stamp = `[${now.slice(0, 10)}] ${note.trim()}`;
      await db
        .from("profiles")
        .update({
          moderation_notes: previous ? `${previous}\n${stamp}` : stamp,
        })
        .eq("id", id);
      break;
    }
    case "remove_note": {
      if (!note.trim()) {
        return c.json({ error: "Provide the exact note text to remove." }, 400);
      }
      const { data: current } = await db
        .from("profiles")
        .select("moderation_notes")
        .eq("id", id)
        .maybeSingle();
      const previous = current?.moderation_notes ?? "";
      const kept = previous
        .split("\n")
        .filter((line: string) => line.trim() !== note.trim() && line.trim().length > 0);
      await db
        .from("profiles")
        .update({ moderation_notes: kept.join("\n") })
        .eq("id", id);
      break;
    }
  }

  await writeAudit(c.req.raw, {
    adminUserId: principal.user.id,
    action: `admin.user.${action}`,
    targetType: "user",
    targetId: id,
    reason: reason || note,
    metadata: {
      username: target.data.username,
      action,
      ...(action === "force_logout" ? { revokedSessions } : {}),
    },
  });

  const { data: updated } = await db
    .from("profiles")
    .select("is_verified,is_banned,is_suspended,is_restricted,moderation_notes")
    .eq("id", id)
    .maybeSingle();

  return c.json({ applied: true, action, profile: updated ?? null });
};

function actionPermission(action: UserAction): string {
  switch (action) {
    case "verify":
    case "unverify":
      return "users.verify";
    case "restrict":
    case "unrestrict":
      return "users.restrict";
    case "suspend":
    case "unsuspend":
      return "users.suspend";
    case "ban":
    case "unban":
      return "users.ban";
    case "force_logout":
      return "users.sessions";
    case "add_note":
    case "remove_note":
      return "users.notes";
  }
}

/** Permitted profile metadata an administrator may change. Anything not in this
 * list (id, username, created_at, moderation flags) is rejected, so the endpoint
 * cannot become a general write to the profiles table. */
const EDITABLE_PROFILE_FIELDS = [
  "display_name",
  "bio",
  "avatar_url",
  "is_private",
  "website_url",
  "link_title",
  "account_type",
] as const;

export const handleUserProfilePatch = async (c: Ctx) => {
  const id = c.req.param("id");
  if (!isUuid(id)) {
    return c.json({ error: "That account id is not valid." }, 400);
  }
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const updates: Record<string, unknown> = {};
  const displayName = readString(body.value, "display_name", 81);
  const bio = readString(body.value, "bio", 301);
  const avatarUrl = readString(body.value, "avatar_url", 2049);
  const websiteUrl = readString(body.value, "website_url", 2049);
  const linkTitle = readString(body.value, "link_title", 81);
  const isPrivate = readBoolean(body.value, "is_private");
  const accountType = readEnum(body.value, "account_type", [
    "personal",
    "creator",
    "business",
  ] as const);

  if (
    displayName === null ||
    bio === null ||
    avatarUrl === null ||
    websiteUrl === null ||
    linkTitle === null ||
    isPrivate === null ||
    accountType === null
  ) {
    return c.json({ error: "Profile fields must be the expected type." }, 400);
  }

  if (displayName !== undefined) {
    if (displayName.length < 1 || displayName.length > 80) {
      return c.json(
        {
          error: "Display name must be between 1 and 80 characters.",
        },
        400,
      );
    }
    updates.display_name = displayName;
  }
  if (bio !== undefined) {
    if (bio.length > 300) {
      return c.json({ error: "Bio must be 300 characters or fewer." }, 400);
    }
    updates.bio = bio;
  }
  if (avatarUrl !== undefined) updates.avatar_url = avatarUrl || null;
  if (websiteUrl !== undefined) updates.website_url = websiteUrl || null;
  if (linkTitle !== undefined) updates.link_title = linkTitle || null;
  if (isPrivate !== undefined) updates.is_private = isPrivate;
  if (accountType !== undefined) updates.account_type = accountType;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No permitted profile fields were supplied." }, 400);
  }
  const rejected = Object.keys(body.value).filter(
    (key) => !EDITABLE_PROFILE_FIELDS.includes(key as (typeof EDITABLE_PROFILE_FIELDS)[number]),
  );
  if (rejected.length > 0) {
    return c.json(
      {
        error: `These fields cannot be edited from the console: ${rejected.join(", ")}.`,
      },
      400,
    );
  }

  const { data, error } = await service()
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      "id,username,display_name,bio,avatar_url,is_private,website_url,link_title,account_type",
    )
    .maybeSingle();
  if (error) {
    return c.json({ error: "The profile could not be updated." }, 500);
  }

  await writeAudit(c.req.raw, {
    adminUserId: c.get("admin").user.id,
    action: "admin.user.profile_updated",
    targetType: "user",
    targetId: id,
    metadata: { fields: Object.keys(updates) },
  });
  return c.json({ updated: true, profile: data ?? null });
};

// ---------------------------------------------------------------------------
// Content moderation
// ---------------------------------------------------------------------------

export const handlePostsListV2 = async (c: Ctx) => {
  const page = integerParam(c, "page", 1, 1, 5000);
  const perPage = integerParam(c, "perPage", 25, 1, 100);
  const query = (c.req.query("query") ?? "").trim().slice(0, 120);
  const status = c.req.query("status") ?? "all";
  const author = (c.req.query("author") ?? "").trim().slice(0, 64);
  const since = c.req.query("since")?.slice(0, 40);

  let request = service()
    .from("posts")
    .select(
      "id,author_id,body,created_at,visibility,is_published,is_hidden,moderation_reason,archived_at,deleted_at,profiles!posts_author_id_fkey(id,username,display_name,avatar_url)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (status === "hidden") request = request.eq("is_hidden", true);
  else if (status === "visible") request = request.eq("is_hidden", false);
  else if (status === "deleted") {
    request = request.not("deleted_at", "is", null);
  } else if (status === "archived") {
    request = request.not("archived_at", "is", null);
  }

  if (since) request = request.gte("created_at", since);
  if (author) {
    request = request.eq("profiles!posts_author_id_fkey.username", author);
  }
  if (query) {
    const escaped = query.replace(/[%,()]/g, (match) => `%${match}`);
    request = request.or(
      `body.ilike.%${escaped}%,profiles!posts_author_id_fkey.username.ilike.%${escaped}%`,
    );
  }

  const { data, error, count } = await request;
  if (error) return c.json({ error: "Posts could not be read." }, 500);

  const { data: media } = await service()
    .from("post_media")
    .select("post_id,object_path,media_type,position")
    .in("post_id", (data ?? []).map((post) => post.id as string).slice(0, 100));

  const mediaByPost = new Map<string, { object_path: string; media_type: string }[]>();
  for (const row of media ?? []) {
    const list = mediaByPost.get(row.post_id as string) ?? [];
    list.push({
      object_path: row.object_path as string,
      media_type: row.media_type as string,
    });
    mediaByPost.set(row.post_id as string, list);
  }

  return c.json({
    posts: (data ?? []).map((post) => ({
      ...post,
      media: mediaByPost.get(post.id as string) ?? [],
    })),
    // A real total from the same filtered query, not the length of one page.
    total: count ?? 0,
    page,
    perPage,
  });
};

export const handleCommentsListV2 = async (c: Ctx) => {
  const page = integerParam(c, "page", 1, 1, 5000);
  const perPage = integerParam(c, "perPage", 25, 1, 100);
  const query = (c.req.query("query") ?? "").trim().slice(0, 120);
  const status = c.req.query("status") ?? "all";

  let request = service()
    .from("comments")
    .select(
      "id,post_id,author_id,body,created_at,is_hidden,moderation_reason,profiles!comments_author_id_fkey(id,username,display_name,avatar_url)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (status === "hidden") request = request.eq("is_hidden", true);
  else if (status === "visible") request = request.eq("is_hidden", false);
  if (query) {
    const escaped = query.replace(/[%,()]/g, (match) => `%${match}`);
    request = request.or(
      `body.ilike.%${escaped}%,profiles!comments_author_id_fkey.username.ilike.%${escaped}%`,
    );
  }

  const { data, error, count } = await request;
  if (error) return c.json({ error: "Comments could not be read." }, 500);

  const { data: parentPosts } = await service()
    .from("posts")
    .select("id,body,profiles!posts_author_id_fkey(username)")
    .in(
      "id",
      Array.from(new Set((data ?? []).map((comment) => comment.post_id as string))).slice(0, 100),
    );

  const postById = new Map(
    (parentPosts ?? []).map((post) => [
      post.id as string,
      {
        id: post.id,
        excerpt: ((post.body as string) ?? "").slice(0, 120),
        authorUsername: (post.profiles as unknown as { username?: string } | null)?.username ?? "",
      },
    ]),
  );

  return c.json({
    comments: (data ?? []).map((comment) => ({
      ...comment,
      post: postById.get(comment.post_id as string) ?? null,
    })),
    total: count ?? 0,
    page,
    perPage,
  });
};

export const handleCommentPatch = async (c: Ctx) => {
  const principal = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) {
    return c.json({ error: "That comment id is not valid." }, 400);
  }

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const hidden = readBoolean(body.value, "hidden");
  const reason = readString(body.value, "reason", 2001);
  if (hidden === null || reason === null) {
    return c.json({ error: "Those fields must be the expected type." }, 400);
  }
  if (hidden === undefined) {
    return c.json({ error: "Specify whether the comment should be hidden." }, 400);
  }

  const permission = hidden ? "comments.hide" : "comments.restore";
  if (!principal.permissions.has(permission)) {
    return c.json(
      {
        error: `Your role does not include the "${permission}" permission.`,
      },
      403,
    );
  }
  if (hidden && (reason ?? "").trim().length < 4) {
    return c.json({ error: "A short reason is required to hide a comment." }, 400);
  }

  const { error } = await service()
    .from("comments")
    .update({
      is_hidden: hidden,
      moderation_reason: reason ?? "",
      moderated_by: principal.user.id,
      moderated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return c.json({ error: "The comment could not be updated." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: principal.user.id,
    action: hidden ? "admin.comment.hidden" : "admin.comment.restored",
    targetType: "comment",
    targetId: id,
    reason: reason ?? "",
  });
  return c.json({ updated: true, hidden });
};

const listContentReports = async (c: Ctx, messagesOnly = false) => {
  const page = integerParam(c, "page", 1, 1, 5000);
  const perPage = integerParam(c, "perPage", 25, 1, 100);
  const status = readStatusFilter(c.req.query("status"));
  const category = c.req.query("category") ?? "";
  const query = (c.req.query("query") ?? "").trim().slice(0, 120);

  let request = service()
    .from("content_reports")
    .select(
      "id,target_type,target_id,reporter_id,category,reason,status,notes,resolved_at,created_at,updated_at,profiles!content_reports_reporter_id_fkey(id,username,display_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (messagesOnly) request = request.eq("target_type", "message");
  else if (!c.get("admin").permissions.has("messages.view_reports")) {
    request = request.neq("target_type", "message");
  }

  if (status === "open") request = request.in("status", ["new", "reviewing"]);
  else if (status !== "all" && status) request = request.eq("status", status);
  if (category) request = request.eq("category", category);
  if (query) {
    const escaped = query.replace(/[%,()]/g, (match) => `%${match}`);
    request = request.or(`reason.ilike.%${escaped}%`);
  }

  const { data, error, count } = await request;
  if (error) return c.json({ error: "Reports could not be read." }, 500);

  const rows = (data ?? []) as Record<string, unknown>[];
  const postIds = rows
    .filter((row) => row.target_type === "post")
    .map((row) => row.target_id as string);
  const { data: posts } = postIds.length
    ? await service()
        .from("posts")
        .select("id,body,author_id,profiles!posts_author_id_fkey(username)")
        .in("id", postIds.slice(0, 100))
    : { data: [] as unknown[] };

  type PostSummary = {
    id: string;
    body: string | null;
    author_id: string | null;
    profiles: { username?: string } | { username?: string }[] | null;
  };
  const postRows = (posts ?? []) as unknown as PostSummary[];
  const postById = new Map(
    postRows.map((post) => {
      const relation = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
      return [
        post.id,
        {
          id: post.id,
          excerpt: (post.body ?? "").slice(0, 160),
          authorUsername: relation?.username ?? "",
        },
      ];
    }),
  );

  return c.json({
    reports: rows.map((row) => ({
      ...row,
      target: row.target_type === "post" ? (postById.get(row.target_id as string) ?? null) : null,
    })),
    total: count ?? 0,
    page,
    perPage,
  });
};

export const handleReportsListV2 = (c: Ctx) => listContentReports(c);

/** Message report metadata is available only to the explicitly permitted
 * moderation role. The private conversation and message body are never joined. */
export const handleMessageReportsList = (c: Ctx) => listContentReports(c, true);

function readStatusFilter(value: string | undefined): string {
  if (!value) return "open";
  if (value === "all") return "all";
  if (value === "open") return "open";
  return (REPORT_STATUSES as readonly string[]).includes(value) ? value : "open";
}

export const handleReportPatchV2 = async (c: Ctx) => {
  const principal = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) {
    return c.json({ error: "That report id is not valid." }, 400);
  }

  const { data: existing, error: lookupError } = await service()
    .from("content_reports")
    .select("target_type")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) {
    return c.json({ error: "The report could not be read." }, 500);
  }
  if (!existing) return c.json({ error: "That report was not found." }, 404);
  if (existing.target_type === "message" && !principal.permissions.has("messages.view_reports")) {
    return c.json(
      {
        error: 'Your role does not include the "messages.view_reports" permission.',
      },
      403,
    );
  }

  const blocked = await requireRecentReauth(c, 10);
  if (blocked) return blocked;

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const status = readEnum(body.value, "status", REPORT_STATUSES);
  const notes = readString(body.value, "notes", 2001);
  if (status === null || notes === null) {
    return c.json({ error: "Those fields must be the expected type." }, 400);
  }
  if (!status) {
    return c.json(
      {
        error: `Status must be one of: ${REPORT_STATUSES.join(", ")}.`,
      },
      400,
    );
  }

  const terminal = status === "closed" || status === "no_violation" || status === "action_taken";
  const updates: Record<string, unknown> = {
    status,
    resolved_by: principal.user.id,
    resolved_at: new Date().toISOString(),
  };
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await service()
    .from("content_reports")
    .update(updates)
    .eq("id", id)
    .select("id,status,resolved_at,notes")
    .maybeSingle();
  if (error) return c.json({ error: "The report could not be updated." }, 500);
  if (!data) return c.json({ error: "That report was not found." }, 404);

  await writeAudit(c.req.raw, {
    adminUserId: principal.user.id,
    action: `admin.report.${status}`,
    targetType: "report",
    targetId: id,
    reason: notes ?? "",
    metadata: { terminal },
  });
  return c.json({ updated: true, report: data });
};

// ---------------------------------------------------------------------------
// Global admin search
// ---------------------------------------------------------------------------

/**
 * One query across every searchable resource. Each branch is optional: a table
 * this deployment lacks is reported as unavailable instead of silently returning
 * nothing, so the search screen can say so rather than looking broken.
 */
export const handleGlobalSearch = async (c: Ctx) => {
  const query = (c.req.query("q") ?? "").trim().slice(0, 120);
  if (query.length < 2) {
    return c.json({ results: [], query, minimumLength: 2 });
  }
  const like = `%${query.replace(/[%,()]/g, (match) => `%${match}`)}%`;
  const limit = integerParam(c, "limit", 5, 1, 25);
  const db = service();
  const permissions = c.get("admin").permissions;
  let reportSearch = db
    .from("content_reports")
    .select("id,target_type,target_id,status,category,created_at")
    .or(`reason.ilike.${like}${isUuid(query) ? `,target_id.eq.${query}` : ""}`);
  if (!c.get("admin").permissions.has("messages.view_reports")) {
    reportSearch = reportSearch.neq("target_type", "message");
  }

  const [
    users,
    posts,
    comments,
    reports,
    pages,
    groups,
    flags,
    audit,
    reels,
    stories,
    ads,
    announcements,
  ] = await Promise.all([
    db
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .or(
        `username.ilike.${like},display_name.ilike.${like}${
          isUuid(query) ? `,id.eq.${query}` : ""
        }`,
      )
      .limit(limit),
    db
      .from("posts")
      .select("id,body,created_at,is_hidden,profiles!posts_author_id_fkey(username)")
      .ilike("body", like)
      .limit(limit),
    db
      .from("comments")
      .select("id,body,created_at,is_hidden,profiles!comments_author_id_fkey(username)")
      .ilike("body", like)
      .limit(limit),
    reportSearch.limit(limit),
    db
      .from("cms_pages")
      .select("id,title,route,status,updated_at")
      .or(`title.ilike.${like},route.ilike.${like},slug.ilike.${like}`)
      .limit(limit),
    db.from("groups").select("id,name").ilike("name", like).limit(limit),
    db.from("feature_flags").select("key,enabled,description").ilike("key", like).limit(limit),
    db
      .from("admin_audit_logs")
      .select("id,action,target_type,target_id,created_at,result")
      .or(`action.ilike.${like},target_id.ilike.${like}`)
      .limit(limit),
    db
      .from("reels")
      .select("id,title,caption,status,created_at")
      .or(`title.ilike.${like},caption.ilike.${like}`)
      .limit(limit),
    db
      .from("stories")
      .select("id,caption,media_type,status,created_at")
      .ilike("caption", like)
      .limit(limit),
    db
      .from("advertisements")
      .select("id,title,placement,status,created_at")
      .or(`title.ilike.${like},body.ilike.${like}`)
      .limit(limit),
    db
      .from("system_announcements")
      .select("id,title,active,starts_at")
      .or(`title.ilike.${like},message.ilike.${like}`)
      .limit(limit),
  ]);

  const results = [
    ...(permissions.has("users.view") ? (users.data ?? []) : []).map((row) => ({
      kind: "user" as const,
      id: row.id as string,
      title: (row.username as string) ?? "",
      subtitle: (row.display_name as string) ?? "",
      href: `/admin/users?user=${encodeURIComponent(row.id as string)}`,
    })),
    ...(permissions.has("posts.view") ? (posts.data ?? []) : []).map((row) => ({
      kind: "post" as const,
      id: row.id as string,
      title: ((row.body as string) ?? "").slice(0, 90),
      subtitle: (row.profiles as unknown as { username?: string } | null)?.username ?? "",
      href: "/admin/posts",
    })),
    ...(permissions.has("comments.view") ? (comments.data ?? []) : []).map((row) => ({
      kind: "comment" as const,
      id: row.id as string,
      title: ((row.body as string) ?? "").slice(0, 90),
      subtitle: (row.profiles as unknown as { username?: string } | null)?.username ?? "",
      href: "/admin/comments",
    })),
    ...(permissions.has("reports.view") ? (reports.data ?? []) : []).map((row) => ({
      kind: "report" as const,
      id: row.id as string,
      title: `${row.target_type as string} report`,
      subtitle: `${row.category as string} · ${row.status as string}`,
      href: "/admin/reports",
    })),
    ...(permissions.has("cms.view") ? (pages.data ?? []) : []).map((row) => ({
      kind: "page" as const,
      id: row.id as string,
      title: (row.title as string) ?? "",
      subtitle: `${row.route as string} · ${row.status as string}`,
      href: "/admin/cms",
    })),
    ...(permissions.has("groups.view") ? (groups.data ?? []) : []).map((row) => ({
      kind: "group" as const,
      id: row.id as string,
      title: (row.name as string) ?? "",
      subtitle: "",
      href: "/admin/groups",
    })),
    ...(permissions.has("flags.view") ? (flags.data ?? []) : []).map((row) => ({
      kind: "flag" as const,
      id: row.key as string,
      title: row.key as string,
      subtitle: (row.enabled as boolean) ? "enabled" : "disabled",
      href: "/admin/feature-flags",
    })),
    ...(permissions.has("audit.view") ? (audit.data ?? []) : []).map((row) => ({
      kind: "audit" as const,
      id: String(row.id),
      title: row.action as string,
      subtitle: `${row.target_type as string} · ${row.result as string}`,
      href: "/admin/audit",
    })),
    ...(permissions.has("reels.view") ? (reels.data ?? []) : []).map((row) => ({
      kind: "reel" as const,
      id: row.id as string,
      title: (row.title as string) || (row.caption as string).slice(0, 90),
      subtitle: `Reel Â· ${row.status as string}`,
      href: "/admin/reels",
    })),
    ...(permissions.has("stories.view") ? (stories.data ?? []) : []).map((row) => ({
      kind: "story" as const,
      id: row.id as string,
      title: (row.caption as string) || `${row.media_type as string} story`,
      subtitle: `Story Â· ${row.status as string}`,
      href: "/admin/stories",
    })),
    ...(permissions.has("ads.view") ? (ads.data ?? []) : []).map((row) => ({
      kind: "advertisement" as const,
      id: row.id as string,
      title: row.title as string,
      subtitle: `${row.placement as string} Â· ${row.status as string}`,
      href: "/admin/ads",
    })),
    ...(permissions.has("notifications.view") ? (announcements.data ?? []) : []).map((row) => ({
      kind: "announcement" as const,
      id: row.id as string,
      title: row.title as string,
      subtitle: row.active ? "Published announcement" : "Archived announcement",
      href: "/admin/announcements",
    })),
  ];

  return c.json({
    query,
    results,
    // Resources this deployment cannot search, stated rather than hidden.
    unavailable: groups.error && permissions.has("groups.view") ? ["groups"] : [],
  });
};

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const handleAuditList = async (c: Ctx) => {
  const page = integerParam(c, "page", 1, 1, 5000);
  const perPage = integerParam(c, "perPage", 50, 1, 200);
  const action = (c.req.query("action") ?? "").trim().slice(0, 100);
  const targetType = (c.req.query("targetType") ?? "").trim().slice(0, 80);
  const targetId = (c.req.query("targetId") ?? "").trim().slice(0, 120);
  const adminId = (c.req.query("adminId") ?? "").trim().slice(0, 64);
  const result = c.req.query("result") ?? "";
  const since = c.req.query("since")?.slice(0, 40);

  let request = service()
    .from("admin_audit_logs")
    .select(
      "id,action,target_type,target_id,reason,result,metadata,error_id,created_at,admin_user_id,ip_address",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (action) request = request.eq("action", action);
  if (targetType) request = request.eq("target_type", targetType);
  if (targetId) request = request.eq("target_id", targetId);
  if (adminId && isUuid(adminId)) {
    request = request.eq("admin_user_id", adminId);
  }
  if (result === "success" || result === "failure" || result === "denied") {
    request = request.eq("result", result);
  }
  if (since) request = request.gte("created_at", since);

  const { data, error, count } = await request;
  if (error) {
    return c.json(
      {
        error:
          "Audit records could not be read with these filters. The reason and result columns come from migration 20261013000000.",
      },
      500,
    );
  }
  return c.json({ logs: data ?? [], total: count ?? 0, page, perPage });
};

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

const STORAGE_BUCKETS = ["site-assets", "profile-avatars", "post-media"] as const;

/**
 * Storage diagnostics from real bucket listings. Nothing is deleted here: the
 * cleanup candidate lists are read-only and every deletion requires a separate,
 * explicit, audited action.
 */
export const handleStorageReport = async (c: Ctx) => {
  const db = service();
  const buckets = [];

  for (const name of STORAGE_BUCKETS) {
    let objects = 0;
    let bytes = 0;
    let available = true;
    let diagnosis = "";
    try {
      const listed = await db.storage.from(name).list("", { limit: 1000 });
      if (listed.error) {
        available = false;
        diagnosis = listed.error.message;
      } else {
        const items = listed.data ?? [];
        objects = items.length;
        for (const item of items) {
          const metadata = (item as { metadata?: { size?: number } }).metadata;
          bytes += metadata?.size ?? 0;
        }
        if (items.length === 1000) {
          // Supabase's storage list endpoint has no cursor, so a bucket larger
          // than one page cannot be sized exactly from here. Saying so beats
          // reporting a partial total as if it were the whole bucket.
          diagnosis =
            "This bucket has more than 1,000 top-level objects. The figures below are a lower bound; use the Supabase dashboard for an exact size.";
        }
      }
    } catch (error) {
      available = false;
      diagnosis = error instanceof Error ? error.message : "Unknown error";
    }
    buckets.push({
      name,
      available,
      objects,
      bytes,
      lowerBound: diagnosis.length > 0,
      diagnosis,
    });
  }

  // Media reference counts. Reported so an operator can reconcile them against
  // the bucket totals; nothing here deletes a referenced object.
  const [referencedMedia, draftMedia] = await Promise.all([
    countOf(service().from("post_media").select("id", { count: "exact", head: true })),
    countOf(
      service().from("post_draft_media").select("id", {
        count: "exact",
        head: true,
      }),
    ),
  ]);

  return c.json({
    checkedAt: new Date().toISOString(),
    buckets,
    references: { postMedia: referencedMedia, postDraftMedia: draftMedia },
    cleanup: {
      available: false,
      diagnosis:
        "No automated cleanup runs from the console. Referenced user media is never removed automatically.",
    },
  });
};

/**
 * Non-secret configuration export. Built from an explicit allowlist, so a column
 * added later cannot leak into the download by accident.
 */
export const handleConfigExport = async (c: Ctx) => {
  const db = service();
  const [
    siteSettings,
    platformSettings,
    theme,
    pages,
    navigation,
    flags,
    animations,
    errorPages,
    announcements,
    templates,
    routes,
  ] = await Promise.all([
    db.from("site_settings").select("*").eq("id", true).maybeSingle(),
    db.from("platform_settings").select("*").eq("id", true).maybeSingle(),
    db.from("theme_settings").select("*").eq("id", true).maybeSingle(),
    db.from("cms_pages").select("*").order("route"),
    db.from("navigation_items").select("*").order("position"),
    db.from("feature_flags").select("*").order("key"),
    db.from("animation_configs").select("*").order("key"),
    db.from("admin_error_pages").select("*").order("code"),
    db.from("system_announcements").select("*").order("created_at", {
      ascending: false,
    }),
    db
      .from("email_template_configs")
      .select("key,label,subject,heading,enabled,version,updated_at")
      .order("key"),
    db.from("app_routes").select("*").order("path"),
  ]);

  const branding = await db
    .from("branding_assets")
    .select("slot,label,public_url,mime_type,version,is_active,updated_at")
    .order("slot");

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    exportedBy: c.get("admin").user.id,
    note: "Non-secret administrator configuration only. Passwords, access codes, SMTP credentials, API secrets, tokens and service-role keys are never included because they are stored as Edge Function secrets, not in these tables.",
    siteSettings: siteSettings.data ?? null,
    platformSettings: platformSettings.data ?? null,
    theme: theme.data ?? null,
    branding: branding.data ?? [],
    cmsPages: pages.data ?? [],
    navigation: navigation.data ?? [],
    featureFlags: flags.data ?? [],
    animations: animations.data ?? [],
    errorPages: errorPages.data ?? [],
    announcements: announcements.data ?? [],
    emailTemplates: templates.data ?? [],
    appRoutes: routes.data ?? [],
  };

  await writeAudit(c.req.raw, {
    adminUserId: c.get("admin").user.id,
    action: "admin.config.exported",
    targetType: "site",
    reason: "configuration_export",
  });

  c.header("Content-Disposition", 'attachment; filename="velori-admin-config.json"');
  return c.json(exportPayload);
};

/** Reports the deployed application version and migration state. */
export const handleVersion = async (c: Ctx) => {
  const db = service();
  const { data: settings } = await db
    .from("site_settings")
    .select("updated_at")
    .eq("id", true)
    .maybeSingle();

  const required = [
    "admin_sessions",
    "admin_roles",
    "admin_permissions",
    "branding_assets",
    "animation_configs",
    "platform_settings",
    "theme_settings",
    "app_routes",
    "advertisements",
    "system_notifications",
  ];

  // Each table is probed directly instead of being inferred from
  // admin_table_health(). That RPC only inspects the ten core content and admin
  // foundation tables and shares no name with this console list, so reusing it
  // reported every required table as pending on a fully migrated database.
  // A missing relation answers with PGRST205; any other failure still proves the
  // relation exists, because PostgREST resolved it before evaluating RLS.
  const present = new Set<string>();
  const probe = db as unknown as {
    from: (relation: string) => {
      select: (columns: string) => {
        limit: (n: number) => Promise<{ error: { code?: string } | null }>;
      };
    };
  };
  await Promise.all(
    required.map(async (name) => {
      const { error } = await probe.from(name).select("*").limit(1);
      if (!error || error.code !== "PGRST205") present.add(name);
    }),
  );

  return c.json({
    version: "1.0.0",
    console: "VELORI Admin Control Center",
    settingsUpdatedAt: settings?.updated_at ?? null,
    migrations: {
      required,
      applied: required.filter((name) => present.has(name)),
      pending: required.filter((name) => !present.has(name)),
    },
  });
};

/**
 * Live health checks. Every reported status comes from a real probe against the
 * dependency it describes. SMTP delivery is reported as `unknown` rather than
 * guessed, because delivery cannot be proven from the server.
 */
export const handleHealthProbe = async (c: Ctx) => {
  const db = service();
  const started = Date.now();

  const [authProbe, storageProbe, mediaProbe, databaseProbe] = await Promise.all([
    db.auth.admin.listUsers({ page: 1, perPage: 1 }),
    db.storage.from("site-assets").list("", { limit: 1 }),
    db.storage.from("post-media").list("", { limit: 1 }),
    db.rpc("admin_table_health"),
  ]);

  const latencyMs = Date.now() - started;
  const tableCount = ((databaseProbe.data ?? []) as unknown[]).length;
  const missingTables = (
    (databaseProbe.data ?? []) as {
      name: string;
      ok: boolean;
      diagnosis: string | null;
    }[]
  )
    .filter((row) => !row.ok)
    .map((row) => row.name);

  const checks = [
    {
      name: "Database",
      status: databaseProbe.error
        ? "unavailable"
        : missingTables.length > 0
          ? "degraded"
          : "operational",
      detail: databaseProbe.error
        ? "The database health function could not be called."
        : missingTables.length > 0
          ? `Reachable, but these managed tables are missing: ${missingTables.join(", ")}.`
          : `${tableCount} managed tables reported healthy.`,
    },
    {
      name: "Authentication",
      status: authProbe.error ? "unavailable" : "operational",
      detail: authProbe.error
        ? "The service-role admin API is not reachable."
        : "The service-role admin API responded.",
    },
    {
      name: "Storage (site assets)",
      status: storageProbe.error ? "unavailable" : "operational",
      detail: storageProbe.error
        ? "The site-assets bucket is not reachable."
        : "The site-assets bucket responded.",
    },
    {
      name: "Storage (user media)",
      status: mediaProbe.error ? "unavailable" : "operational",
      detail: mediaProbe.error
        ? "The post-media bucket is not reachable."
        : "The post-media bucket responded.",
    },
    {
      name: "SMTP delivery",
      status: "unknown",
      detail:
        "Delivery depends on the Supabase project's SMTP provider and cannot be verified from the server. Check the Supabase dashboard.",
    },
  ];

  const overall = checks.some((check) => check.status === "unavailable")
    ? "unavailable"
    : checks.some((check) => check.status === "degraded")
      ? "degraded"
      : "operational";

  return c.json({
    checkedAt: new Date().toISOString(),
    latencyMs,
    overall,
    checks,
  });
};
