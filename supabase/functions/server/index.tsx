// Versions are pinned so a deploy resolves the same dependency graph every
// time. `npm:hono` unversioned previously resolved to whatever was newest,
// which makes a deployment unreproducible.
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  DEFAULT_ACCESS_CODE_ITERATIONS as ACCESS_CODE_ITERATIONS,
  hashAccessCode,
  timingSafeEqualString,
  verifyBootstrapCode,
} from "./access-code.mjs";
import {
  adminIdentityEmail,
  hashPassword,
  isValidNewPassword,
  isValidUsername,
  normalizeUsername,
  verifyPassword,
} from "./admin-password.mjs";

// Authentication, authorization, body parsing and auditing live in ./admin-core.ts
// so that this file and ./admin-console.ts cannot drift apart on the rules that
// decide who is allowed to do what.
import {
  ACCESS_CODE_MAX_LENGTH,
  ACCESS_CODE_MIN_LENGTH,
  ADMIN_INITIAL_PASSWORD,
  ADMIN_LOCKOUT_MINUTES,
  ADMIN_LOCKOUT_THRESHOLD,
  ADMIN_USERNAME_ATTEMPT_NAMESPACE,
  type AdminEnv,
  adminSessionCookie,
  ALLOWED_ORIGINS,
  ASSET_TYPES,
  clearAdminSessionCookie,
  clientIp,
  CONFIGURED_ORIGINS,
  type Ctx,
  deviceLabel,
  isUuid,
  LOGIN_MAX_FAILURES,
  LOGIN_MAX_FAILURES_PER_IP,
  LOGIN_WINDOW_MINUTES,
  MAX_ANIMATION_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  misconfigured,
  PRIMARY_ADMIN_USERNAME,
  readJson,
  readSecret,
  readString,
  recordLoginAttempt,
  referenceId,
  requireAdmin,
  service,
  SETUP_CODE,
  SETUP_CODE_ATTEMPT_NAMESPACE,
  SETUP_CODE_MAX_FAILURES_PER_IP,
  SETUP_CODE_WINDOW_MINUTES,
  sha256Hex,
  SUPABASE_URL,
  writeAudit,
} from "./admin-core.ts";

// The console surface is split across two modules. `./admin-console.ts` owns
// identity, moderation and diagnostics; `./admin-content.ts` owns CMS, navigation,
// appearance and every configuration table. Both are registered below behind
// explicit permission guards, so a route's reachability is decided in one place.
import {
  handleAuditList,
  handleCommentPatch,
  handleCommentsListV2,
  handleConfigExport,
  handleDashboard,
  handleGlobalSearch,
  handleHealthProbe,
  handleMessageReportsList,
  handlePostsListV2,
  handleProvisioningStatus,
  handleReportPatchV2,
  handleReportsListV2,
  handleSessionRevoke,
  handleSessionsList,
  handleSessionsRevokeOthers,
  handleStorageReport,
  handleUserAction,
  handleUserDetail,
  handleUserProfilePatch,
  handleVersion,
} from "./admin-console.ts";
import {
  handleReelPatch,
  handleReelsList,
  handleStoriesList,
  handleStoryPatch,
} from "./admin-social.ts";
import { handleGroupModerationPatch, handleGroupsList } from "./admin-groups.ts";
import {
  handleStudioCatalogAdminGet,
  handleStudioCatalogPublicGet,
  handleStudioMusicCreate,
  handleStudioStickerCreate,
  handleStudioCatalogPatch,
  handleStudioCatalogDelete,
  handleStudioStickerCategoryCreate,
  handleStudioStickerCategoryPatch,
  handleStudioCatalogAssetReplace,
} from "./studio-catalog.ts";
import {
  handleAdCreate,
  handleAdDelete,
  handleAdMediaUpload,
  handleAdPublish,
  handleAdminsCreate,
  handleAdminsDelete,
  handleAdminsList,
  handleAdminsPatch,
  handleAdPatch,
  handleAdsList,
  handleAnimationPatch,
  handleAnimationsList,
  handleAnnouncementCreate as handleAnnouncementCreateV2,
  handleAnnouncementDelete,
  handleAnnouncementMediaUpload,
  handleAnnouncementPublish,
  handleAnnouncementRestore,
  handleAnnouncementVersions,
  handleAnnouncementPatch,
  handleAnnouncementsList as handleAnnouncementsListV2,
  handleAppearanceGet,
  handleAppearancePut,
  handleBrandingList,
  handleBrandingPatch,
  handleBrandingRestoreVersion,
  handleBrandingUpload,
  handleCmsPageCreate as handleCmsPageCreateV2,
  handleCmsPageDelete,
  handleCmsPageDuplicate,
  handleCmsPageGet,
  handleCmsPagePatch,
  handleCmsPagePublish,
  handleCmsPagesList as handleCmsPagesListV2,
  handleCmsVersionRestore,
  handleCmsVersionsList,
  handleEmailPatch,
  handleEmailsList,
  handleEmailTestSend,
  handleEmergencyMode,
  handleErrorIllustrationUpload,
  handleFeatureFlagPatch as handleFeatureFlagPatchV2,
  handleFeatureFlagsList as handleFeatureFlagsListV2,
  handleMotionCmsDraftPut,
  handleMotionCmsGet,
  handleMotionCmsPublish,
  handleMotionCmsRestore,
  handleMotionUpload,
  handleNavigationCreate,
  handleNavigationDelete,
  handleNavigationList as handleNavigationListV2,
  handleNavigationPatch as handleNavigationPatchV2,
  handleNavigationReorder,
  handleNotificationCreate,
  handleNotificationDelete,
  handleNotificationsList,
  handlePlatformSettingsGet,
  handlePlatformSettingsPut,
  handleRolePatch,
  handleRolesList,
  handleRoutePatch,
  handleRoutesList,
} from "./admin-content.ts";
import {
  handleOfferCreate,
  handleOfferPatch,
  handleOffersList,
  handleReferralCodePatch,
  handleReferralEventsList,
  handleReferralProgramGet,
  handleReferralProgramPatch,
  handleReferralRewardReverse,
  handleReferralRewardsList,
  handleReferralsList,
} from "./admin-business.ts";
import { requirePermission } from "./admin-core.ts";
import { handleMediaCleanup } from "./media-cleanup.ts";
import {
  handleCreatorSourceFileGet,
  handleCreatorSourceFilesGet,
  handleCreatorSourcePullRequest,
} from "./github-source.ts";
import { SOURCE_PERMISSION_BY_ACTION } from "./github-source-guards.ts";

// ---------------------------------------------------------------------------
// VELORI administrator API.
//
// The browser never talks to the database for privileged work. It calls these
// routes with a Supabase access token; every route below re-verifies that
// token with the service-role client and re-reads the caller's admin_profiles
// row, so revoking an administrator takes effect on their very next request.
//
// Deployment target: the function is named after this directory (`server`);
// admin routes live at /functions/v1/server/admin/*.
//
// Secrets required (set with `supabase secrets set`, never in a VITE_ variable):
//   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
//   ALLOWED_ORIGINS     comma-separated exact origins
//   ADMIN_SETUP_CODE    one-time code that authorises initial account setup
//   VELORI_ADMIN_USERNAME / VELORI_ADMIN_INITIAL_PASSWORD
//                      server-side initial administrator credentials. Never sent to the
//                      browser and never stored in a migration or a VITE_ variable.
// ---------------------------------------------------------------------------

const app = new Hono<AdminEnv>();

app.use("*", logger(console.log));

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
//
// `apikey` MUST be allowed: the browser sets it on every request
// (src/lib/admin-api.ts) and the Supabase gateway rejects calls without it. The
// previous allowlist omitted it, which would have failed every administrator
// request at preflight even with the routes implemented.
//
// Credentials are limited to the exact server-side allowlist. Browsers use an
// HttpOnly cookie where cross-origin cookie policy permits and a per-tab token
// fallback where the Supabase function origin is treated as third-party.

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      return ALLOWED_ORIGINS.includes(origin) ? origin : null;
    },
    allowHeaders: [
      "Accept",
      "Authorization",
      "Content-Type",
      "apikey",
      "x-client-info",
      "x-supabase-api-version",
    ],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.onError((error, c) => {
  const errorId = referenceId();
  // Keep exception messages, headers and bodies out of both logs and responses;
  // request data can contain passwords, access codes or bearer tokens.
  console.error(
    JSON.stringify({
      event: "server.unhandled_error",
      errorId,
      method: c.req.method,
      path: c.req.path,
      errorType: error instanceof Error ? error.name : "UnknownError",
    }),
  );
  return c.json(
    {
      error: "The server could not complete this request.",
      errorId,
    },
    500,
  );
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// The setup-code path, and the only way to initialize the first administrator.
// The submitted code is compared against the ADMIN_SETUP_CODE
// Edge Function secret in constant time. The code is never logged, never
// returned, never written to the database, and never reaches the browser
// bundle. The route refuses to run once any administrator exists.
const handleInitializeAdmin = async (c: Ctx) => {
  if (misconfigured()) {
    return c.json({ error: "The server is missing its Supabase secrets." }, 500);
  }

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const setupCode = readSecret(body.value, "setupCode", ACCESS_CODE_MAX_LENGTH);
  if (!setupCode) {
    return c.json({ error: "Administrator initialization is unavailable." }, 503);
  }

  const request = c.req.raw;
  const ip = clientIp(request);
  const attemptHash = await sha256Hex(SETUP_CODE_ATTEMPT_NAMESPACE + (ip ?? "unknown"));
  const since = new Date(Date.now() - SETUP_CODE_WINDOW_MINUTES * 60_000).toISOString();
  const attempts = await service()
    .from("admin_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("email_hash", attemptHash)
    .eq("succeeded", false)
    .gte("created_at", since);
  if ((attempts.count ?? 0) >= SETUP_CODE_MAX_FAILURES_PER_IP) {
    await writeAudit(request, {
      adminUserId: null,
      action: "admin.initialize.throttled",
      targetType: "account",
      result: "denied",
    });
    return c.json({ error: "Too many setup attempts. Try again later." }, 429);
  }

  const { data: storedCode } = await service()
    .from("admin_access_code")
    .select("code_hash,enabled")
    .eq("id", true)
    .maybeSingle();
  const codeCheck = await verifyBootstrapCode(
    setupCode,
    SETUP_CODE,
    storedCode
      ? {
          code_hash: String(storedCode.code_hash),
          enabled: Boolean(storedCode.enabled),
        }
      : null,
  );
  if (!codeCheck.matchesSecret && !codeCheck.matchesStored) {
    await recordLoginAttempt(attemptHash, ip, false);
    await writeAudit(request, {
      adminUserId: null,
      action: "admin.initialize.denied",
      targetType: "account",
      reason: "invalid_setup_code",
      result: "denied",
    });
    return c.json({ error: "The administrator setup code is not valid." }, 403);
  }

  const existing = await service()
    .from("admin_accounts")
    .select("id", { count: "exact", head: true });
  if (existing.error) {
    return c.json(
      {
        error: "The administrator credential store is unavailable.",
      },
      500,
    );
  }
  if ((existing.count ?? 0) > 0) {
    return c.json(
      {
        error: "The administrator account is already initialized.",
        code: "already_initialized",
      },
      409,
    );
  }

  const username = PRIMARY_ADMIN_USERNAME;
  if (
    normalizeUsername(username) !== "velorimanagearyan" ||
    !isValidUsername(username) ||
    !isValidNewPassword(ADMIN_INITIAL_PASSWORD)
  ) {
    return c.json(
      {
        error:
          "The server-side administrator setup is incomplete. Check the username and initial password configuration.",
      },
      503,
    );
  }

  const identityEmail = adminIdentityEmail(username);
  const internalPassword = randomAdminToken();
  const { data: authResult, error: authError } = await service().auth.admin.createUser({
    email: identityEmail,
    password: internalPassword,
    email_confirm: true,
    user_metadata: { administrator_identity: true },
  });
  if (authError || !authResult.user) {
    await writeAudit(request, {
      adminUserId: null,
      action: "admin.initialize.failed",
      targetType: "account",
      reason:
        authError?.code === "email_exists"
          ? "reserved_identity_exists"
          : "auth_identity_create_failed",
      result: "failure",
    });
    return c.json(
      {
        error: "The administrator identity could not be initialized.",
        code: "identity_conflict",
      },
      authError?.code === "email_exists" ? 409 : 500,
    );
  }

  const userId = authResult.user.id;
  const { error: profileError } = await service().from("admin_profiles").insert({
    user_id: userId,
    role: "super_admin",
    role_key: "super_admin",
    display_name: "VELORI Administrator",
    is_active: true,
    must_change_password: false,
    password_changed_at: new Date().toISOString(),
    provisioned_by: "server_secret",
  });
  if (profileError) {
    await service().auth.admin.deleteUser(userId);
    await writeAudit(request, {
      adminUserId: null,
      action: "admin.initialize.failed",
      targetType: "account",
      reason: "profile_create_failed",
      result: "failure",
    });
    return c.json(
      {
        error: "The administrator profile could not be initialized.",
      },
      500,
    );
  }

  const credentialHash = await hashPassword(ADMIN_INITIAL_PASSWORD);
  const { error: accountError } = await service().from("admin_accounts").insert({
    user_id: userId,
    username,
    password_hash: credentialHash,
    role_key: "super_admin",
    enabled: true,
    must_change_password: false,
    password_changed_at: new Date().toISOString(),
  });
  if (accountError) {
    await service().from("admin_profiles").delete().eq("user_id", userId);
    await service().auth.admin.deleteUser(userId);
    await writeAudit(request, {
      adminUserId: null,
      action: "admin.initialize.failed",
      targetType: "account",
      reason: "credential_create_failed",
      result: "failure",
    });
    return c.json(
      {
        error: "The administrator credentials could not be initialized.",
      },
      500,
    );
  }

  await recordLoginAttempt(attemptHash, ip, true);
  await writeAudit(request, {
    adminUserId: userId,
    action: "admin.initialize.completed",
    targetType: "account",
    targetId: userId,
    metadata: { username },
  });
  return c.json({ initialized: true, username });
};

function randomAdminToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const handleLogin = async (c: Ctx) => {
  if (misconfigured()) {
    return c.json({ error: "The server is missing its Supabase secrets." }, 500);
  }

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const username = readString(body.value, "username", 64);
  const password = readSecret(body.value, "password", 200);
  if (!username) return c.json({ error: "Enter your username." }, 400);
  if (!password) return c.json({ error: "Enter your password." }, 400);
  if (!isValidUsername(username)) {
    return c.json({ error: "The username or password is incorrect." }, 401);
  }

  const normalized = normalizeUsername(username);
  const request = c.req.raw;
  const ip = clientIp(request);
  const usernameHash = await sha256Hex(ADMIN_USERNAME_ATTEMPT_NAMESPACE + normalized);
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000).toISOString();
  const db = service();
  const [perAccount, perAddress] = await Promise.all([
    db
      .from("admin_login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email_hash", usernameHash)
      .eq("succeeded", false)
      .gte("created_at", since),
    ip
      ? db
          .from("admin_login_attempts")
          .select("id", { count: "exact", head: true })
          .eq("ip_address", ip)
          .eq("succeeded", false)
          .gte("created_at", since)
      : Promise.resolve({ count: 0 }),
  ]);

  const accountBlocked = (perAccount.count ?? 0) >= LOGIN_MAX_FAILURES;
  const addressBlocked = (perAddress.count ?? 0) >= LOGIN_MAX_FAILURES_PER_IP;
  if (accountBlocked || addressBlocked) {
    await recordLoginAttempt(usernameHash, ip, false);
    await writeAudit(request, {
      adminUserId: null,
      action: "admin.login.throttled",
      targetType: "session",
      result: "denied",
      metadata: {
        windowMinutes: LOGIN_WINDOW_MINUTES,
        scope: accountBlocked ? "account" : "address",
      },
    });
    return c.json(
      {
        error: "Too many failed attempts. Try again later.",
        code: "rate_limited",
      },
      429,
    );
  }

  const { data: candidates } = await db
    .from("admin_accounts")
    .select(
      "id,user_id,username,password_hash,role_key,enabled,must_change_password,failed_attempts,locked_until",
    )
    .ilike("username", normalized)
    .limit(20);
  const account =
    (candidates ?? []).find(
      (row) => normalizeUsername(String(row.username ?? "")) === normalized,
    ) ?? null;

  const reject = async (reason: string) => {
    await recordLoginAttempt(usernameHash, ip, false);
    await writeAudit(request, {
      adminUserId: account?.user_id ?? null,
      action: "admin.login.denied",
      targetType: "account",
      targetId: account?.id ?? null,
      reason,
      result: "denied",
    });
    return c.json(
      {
        error: "The username or password is incorrect.",
        code: "invalid_credentials",
      },
      401,
    );
  };

  if (!account || !account.enabled || !account.password_hash) {
    return await reject("unknown_or_disabled");
  }
  if (account.locked_until && new Date(String(account.locked_until)).getTime() > Date.now()) {
    await recordLoginAttempt(usernameHash, ip, false);
    return c.json(
      {
        error: "Too many failed attempts. Try again later.",
        code: "rate_limited",
      },
      429,
    );
  }

  const passwordMatches = await verifyPassword(password, String(account.password_hash));
  if (!passwordMatches) {
    const previousFailures =
      account.locked_until && new Date(String(account.locked_until)).getTime() <= Date.now()
        ? 0
        : Number(account.failed_attempts ?? 0);
    const failed = previousFailures + 1;
    await db
      .from("admin_accounts")
      .update({
        failed_attempts: failed,
        locked_until:
          failed >= ADMIN_LOCKOUT_THRESHOLD
            ? new Date(Date.now() + ADMIN_LOCKOUT_MINUTES * 60_000).toISOString()
            : null,
      })
      .eq("id", account.id);
    return await reject("password_mismatch");
  }

  const userId = String(account.user_id);
  const { data: profile } = await db
    .from("admin_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile || !profile.is_active) {
    return await reject("not_an_active_administrator");
  }

  const platform = await db
    .from("platform_settings")
    .select("admin_session_timeout_minutes")
    .eq("id", true)
    .maybeSingle();
  const configuredMinutes =
    typeof platform.data?.admin_session_timeout_minutes === "number"
      ? platform.data.admin_session_timeout_minutes
      : Number(profile.session_timeout_minutes ?? 60);
  const timeoutMinutes = Math.min(1440, Math.max(5, configuredMinutes));
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60_000).toISOString();
  const sessionToken = randomAdminToken();
  const expiresSeconds = Math.max(
    1,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );
  const userAgent = request.headers.get("user-agent");
  const { data: session, error: sessionError } = await db
    .from("admin_sessions")
    .insert({
      admin_user_id: userId,
      session_token_hash: await sha256Hex(sessionToken),
      expires_at: expiresAt,
      user_agent: userAgent?.slice(0, 500) ?? null,
      ip_address: ip,
      device_label: deviceLabel(userAgent),
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    await writeAudit(request, {
      adminUserId: userId,
      action: "admin.login.session_failed",
      targetType: "session",
      targetId: userId,
      reason: "session_record_rejected",
      result: "failure",
    });
    return c.json({ error: "The secure administrator session could not be created." }, 500);
  }

  await recordLoginAttempt(usernameHash, ip, true);
  await db
    .from("admin_accounts")
    .update({
      failed_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    })
    .eq("id", account.id);
  await writeAudit(request, {
    adminUserId: userId,
    action: "admin.login.succeeded",
    targetType: "session",
    targetId: session.id,
    metadata: {
      role: profile.role_key ?? profile.role,
      username: account.username,
      mustChangePassword: Boolean(account.must_change_password),
    },
  });

  c.header("Set-Cookie", adminSessionCookie(sessionToken, expiresSeconds));
  return c.json({
    sessionToken,
    sessionId: session.id,
    sessionExpiresAt: expiresAt,
    mustChangePassword: Boolean(account.must_change_password),
    username: account.username,
  });
};
const handleReauthenticate = async (c: Ctx) => {
  const principal = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const password = readSecret(body.value, "password", 200);
  if (!password) {
    return c.json({ error: "Your password is required." }, 400);
  }

  // The password is verified against the dedicated administrator credential, not
  // against Supabase Auth, and never leaves the server.
  const { data: accountRow } = await service()
    .from("admin_accounts")
    .select("id,password_hash,enabled")
    .eq("user_id", principal.user.id)
    .maybeSingle();
  const matches =
    Boolean(accountRow?.enabled) &&
    (await verifyPassword(password, String(accountRow?.password_hash ?? "")));
  if (!matches) {
    await writeAudit(c.req.raw, {
      adminUserId: principal.user.id,
      action: "admin.reauthenticate.failed",
      targetType: "session",
      targetId: principal.session?.id ?? null,
      reason: "password_mismatch",
      result: "failure",
    });
    return c.json({ error: "That password is not correct." }, 401);
  }

  if (principal.session) {
    await service()
      .from("admin_sessions")
      .update({ reauthenticated_at: new Date().toISOString() })
      .eq("id", principal.session.id);
  }
  await writeAudit(c.req.raw, {
    adminUserId: principal.user.id,
    action: "admin.reauthenticate.succeeded",
    targetType: "session",
    targetId: principal.session?.id ?? null,
  });
  return c.json({ reauthenticatedAt: new Date().toISOString() });
};

const handleLogout = async (c: Ctx) => {
  const { user, session } = c.get("admin");
  if (!session) {
    return c.json({ error: "Sign in again.", code: "session_missing" }, 401);
  }
  const now = new Date().toISOString();
  const { data: revoked, error } = await service()
    .from("admin_sessions")
    .update({
      revoked_at: now,
      revoked_by: user.id,
      revoke_reason: "admin_logout",
    })
    .eq("id", session.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.logout.failed",
      targetType: "session",
      targetId: session.id,
      reason: "session_revocation_failed",
      result: "failure",
      errorId,
    });
    return c.json(
      {
        error: "The administrator session could not be revoked.",
        errorId,
      },
      500,
    );
  }
  if (!revoked) {
    const { data: currentSession, error: lookupError } = await service()
      .from("admin_sessions")
      .select("revoked_at")
      .eq("id", session.id)
      .maybeSingle();
    if (lookupError || !currentSession?.revoked_at) {
      const errorId = referenceId();
      await writeAudit(c.req.raw, {
        adminUserId: user.id,
        action: "admin.logout.failed",
        targetType: "session",
        targetId: session.id,
        reason: "session_revocation_unconfirmed",
        result: "failure",
        errorId,
      });
      return c.json(
        {
          error: "The administrator session could not be revoked.",
          errorId,
        },
        500,
      );
    }
  }
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.logout",
    targetType: "session",
    targetId: session.id,
  });
  c.header("Set-Cookie", clearAdminSessionCookie());
  return c.json({ revoked: true });
};

const handleMe = (c: Ctx) => {
  const { user, profile, permissions, roleKey, session, account } = c.get("admin");
  if (!session || !account) {
    return c.json({ error: "Sign in again.", code: "session_missing" }, 401);
  }
  return c.json({
    userId: user.id,
    username: account?.username ?? "",
    displayName: profile.display_name,
    jobTitle: profile.job_title,
    bio: profile.bio,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    roleKey,
    isActive: profile.is_active,
    mustChangePassword: Boolean(account?.must_change_password ?? profile.must_change_password),
    mfaRequired: profile.mfa_required,
    // The authoritative permission set for this session. The interface uses it to
    // decide what to render, but it is never the enforcement point: every route
    // behind requirePermission re-checks server-side.
    permissions: [...permissions],
    sessionId: session.id,
    sessionExpiresAt: session.expires_at,
    reauthenticatedAt: session.reauthenticated_at,
  });
};

const handleProfilePut = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const displayName = readString(body.value, "displayName", 81);
  const jobTitle = readString(body.value, "jobTitle", 101);
  const bio = readString(body.value, "bio", 501);
  if (displayName === null || jobTitle === null || bio === null) {
    return c.json({ error: "Profile fields must be text." }, 400);
  }
  const name = displayName ?? "";
  const title = jobTitle ?? "";
  const biography = bio ?? "";
  if (name.length < 1 || name.length > 80) {
    return c.json(
      {
        error: "Display name must be between 1 and 80 characters.",
      },
      400,
    );
  }
  if (title.length > 100) {
    return c.json({ error: "Job title must be 100 characters or fewer." }, 400);
  }
  if (biography.length > 500) {
    return c.json({ error: "Bio must be 500 characters or fewer." }, 400);
  }

  const { error } = await service()
    .from("admin_profiles")
    .update({
      display_name: name,
      job_title: title,
      bio: biography,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) return c.json({ error: "The profile could not be saved." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.profile.updated",
    targetType: "user",
    targetId: user.id,
  });
  return c.json({ updated: true });
};

const handleCredentialsPut = async (c: Ctx) => {
  const principal = c.get("admin");
  const { user, account, session } = principal;
  if (!session || !account) {
    return c.json({ error: "Sign in again.", code: "session_missing" }, 401);
  }
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const currentPassword = readSecret(body.value, "currentPassword", 200);
  const password = readSecret(body.value, "password", 200);
  const confirmation = readSecret(body.value, "confirmation", 200);
  if (currentPassword === null || password === null || confirmation === null) {
    return c.json({ error: "Password fields must be text." }, 400);
  }
  if (!currentPassword || !password || !confirmation) {
    return c.json(
      {
        error: "Enter your current password and the new password twice.",
      },
      400,
    );
  }
  if (!isValidNewPassword(password)) {
    return c.json(
      {
        error: "Choose a new password between 12 and 200 characters.",
      },
      400,
    );
  }
  if (password !== confirmation) {
    return c.json({ error: "The new passwords do not match." }, 400);
  }

  const { data: credential, error: credentialError } = await service()
    .from("admin_accounts")
    .select("id,password_hash,enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  if (credentialError) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.credentials.failed",
      targetType: "session",
      targetId: session.id,
      reason: "credential_read_failed",
      result: "failure",
      errorId,
    });
    return c.json(
      {
        error: "Administrator credentials could not be verified.",
        errorId,
      },
      500,
    );
  }
  if (
    !credential?.enabled ||
    !(await verifyPassword(currentPassword, String(credential.password_hash ?? "")))
  ) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.credentials.denied",
      targetType: "session",
      targetId: session.id,
      reason: "current_password_mismatch",
      result: "denied",
      errorId,
    });
    return c.json(
      {
        error: "The current password is not correct.",
        code: "current_password_mismatch",
        errorId,
      },
      401,
    );
  }
  if (await verifyPassword(password, String(credential.password_hash))) {
    return c.json({ error: "Choose a password you have not used before." }, 400);
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const { data: sessionsRevoked, error: updateError } = await service().rpc(
    "admin_change_password_and_revoke_sessions",
    {
      p_user_id: user.id,
      p_password_hash: passwordHash,
      p_changed_at: now,
    },
  );
  if (updateError || typeof sessionsRevoked !== "number") {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.credentials.failed",
      targetType: "session",
      targetId: session.id,
      result: "failure",
      errorId,
    });
    return c.json(
      {
        error: "The password could not be changed and sessions could not be revoked.",
        errorId,
      },
      500,
    );
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.password.changed",
    targetType: "account",
    targetId: account.id,
    metadata: { sessionsRevoked },
  });
  c.header("Set-Cookie", clearAdminSessionCookie());
  return c.json({ signedOut: true, sessionsRevoked });
};
const ACCESS_CODE_ROTATION_WINDOW_MINUTES = 60;
const ACCESS_CODE_MAX_ROTATIONS = 5;

const handleAccessCodeGet = async (c: Ctx) => {
  const { user } = c.get("admin");
  const { data, error } = await service().rpc("admin_access_code_status");
  const row = Array.isArray(data) ? data[0] : undefined;

  if (error || !row) {
    // An un-migrated project still has a usable setup path via the
    // environment secret, so this is reported, not treated as fatal.
    return c.json({
      stored: false,
      enabled: Boolean(SETUP_CODE),
      setupSecretConfigured: Boolean(SETUP_CODE),
      rotatedAt: null,
      migrationsApplied: false,
    });
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.access_code.viewed",
    targetType: "site",
  });

  return c.json({
    stored: Boolean(row.configured),
    enabled: Boolean(row.enabled),
    setupSecretConfigured: Boolean(SETUP_CODE),
    rotatedAt: row.rotated_at ?? null,
    migrationsApplied: true,
  });
};

const handleAccessCodePut = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const enabled = body.value.enabled;
  if (typeof enabled !== "boolean") {
    return c.json({ error: "The enabled flag must be true or false." }, 400);
  }
  const newCode = readSecret(body.value, "newCode", ACCESS_CODE_MAX_LENGTH + 1);

  // Throttle rotations per administrator. Checked before the code is validated
  // and hashed, so a stolen admin session cannot burn unbounded PBKDF2 work.
  const since = new Date(
    Date.now() - ACCESS_CODE_ROTATION_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count: rotations } = await service()
    .from("admin_audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("admin_user_id", user.id)
    .in("action", ["admin.access_code.rotated", "admin.access_code.disabled"])
    .gte("created_at", since);

  if ((rotations ?? 0) >= ACCESS_CODE_MAX_ROTATIONS) {
    const errorId = referenceId();
    return c.json(
      {
        error: `Too many access code changes. Try again in ${ACCESS_CODE_ROTATION_WINDOW_MINUTES} minutes.`,
        errorId,
      },
      429,
    );
  }

  // Validating and hashing live in the same block so TypeScript keeps the
  // narrowing from `string | null | undefined` down to `string`.
  let hash: string | null = null;
  if (enabled) {
    if (newCode === undefined) {
      return c.json({ error: "A new access code is required." }, 400);
    }
    if (newCode === null) {
      return c.json({ error: "The access code must be text." }, 400);
    }
    if (newCode.length < ACCESS_CODE_MIN_LENGTH) {
      return c.json(
        {
          error: `Use an access code of at least ${ACCESS_CODE_MIN_LENGTH} characters.`,
        },
        400,
      );
    }
    if (newCode.length > ACCESS_CODE_MAX_LENGTH) {
      return c.json(
        {
          error: `Use an access code of ${ACCESS_CODE_MAX_LENGTH} characters or fewer.`,
        },
        400,
      );
    }
    hash = await hashAccessCode(newCode);
  }

  const { error } = await service().rpc("admin_set_access_code", {
    p_code_hash: hash,
    p_iterations: hash ? ACCESS_CODE_ITERATIONS : null,
    p_user_id: user.id,
    p_enabled: enabled,
  });

  if (error) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.access_code.failed",
      targetType: "site",
      metadata: { enabled },
      errorId,
    });
    return c.json(
      {
        error:
          "The access code could not be changed. Apply supabase/migrations/20261007000000_velori_admin_bootstrap_claim.sql first.",
        errorId,
      },
      500,
    );
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: enabled ? "admin.access_code.rotated" : "admin.access_code.disabled",
    targetType: "site",
    // No code, no hash, no salt -- only the fact that a rotation occurred.
    metadata: { enabled },
  });

  return c.json({
    enabled,
    rotatedAt: new Date().toISOString(),
    message: enabled
      ? "Access code changed. The previous code no longer works."
      : "Access code disabled. First-time administrator setup is closed.",
  });
};

function mapUser(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    email: (row.email as string) ?? undefined,
    createdAt: row.created_at as string,
    lastSignInAt: (row.last_sign_in_at as string) ?? undefined,
    verified: Boolean(row.verified),
    bannedUntil: (row.banned_until as string) ?? null,
    // Present so a super administrator can promote or demote from the user
    // table. Never rendered for non-administrators, because the whole route
    // is already behind requireAdmin.
    adminRole: (row.admin_role as string) ?? null,
    adminActive:
      row.admin_role === null || row.admin_role === undefined ? null : Boolean(row.admin_active),
  };
}

const handleUsersList = async (c: Ctx) => {
  const search = (c.req.query("query") ?? "").slice(0, 254);
  const page = Number.parseInt(c.req.query("page") ?? "1", 10) || 1;
  const perPage = Number.parseInt(c.req.query("perPage") ?? "20", 10) || 20;

  const db = service();
  const [rows, total] = await Promise.all([
    db.rpc("admin_user_list", { search, page, per_page: perPage }),
    db.rpc("admin_user_count", { search }),
  ]);

  return c.json({
    users: ((rows.data ?? []) as Record<string, unknown>[]).map(mapUser),
    total: (total.data as number) ?? 0,
  });
};

/** Administrators are protected in three places: here, by the route guards,
 * and by the admin_profiles_protect_last_super trigger in the database. */
async function guardAdminTarget(targetId: string) {
  const { data: target } = await service()
    .from("admin_profiles")
    .select("user_id,role,is_active")
    .eq("user_id", targetId)
    .maybeSingle();
  if (!target || !target.is_active) return null;

  const { count: activeSupers } = await service()
    .from("admin_profiles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "super_admin")
    .eq("is_active", true);

  if (target.role === "super_admin" && (activeSupers ?? 0) <= 1) {
    return "This is the only active super administrator. Promote another one first.";
  }
  return null;
}

const handleUserPatch = async (c: Ctx) => {
  const principal = c.get("admin");
  const { user, profile } = principal;
  const targetId = c.req.param("id") ?? "";
  if (!isUuid(targetId)) return c.json({ error: "Invalid user ID." }, 400);

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const wantsRole = "role" in body.value;
  const wantsDisable = "disabled" in body.value;
  if (!wantsRole && !wantsDisable) {
    return c.json({ error: "Nothing to update." }, 400);
  }

  const nextRole = body.value.role;
  // `role: null` revokes administrator access entirely by removing the
  // admin_profiles row. This is distinct from `role: "admin"`, which demotes a
  // super administrator to an ordinary administrator.
  if (wantsRole && nextRole !== null && nextRole !== "admin" && nextRole !== "super_admin") {
    return c.json({ error: "Role must be admin, super_admin, or null." }, 400);
  }
  if (wantsDisable && typeof body.value.disabled !== "boolean") {
    return c.json({ error: "disabled must be true or false." }, 400);
  }
  const disabled = wantsDisable ? body.value.disabled === true : false;

  if (targetId === user.id) {
    return c.json({ error: "You cannot change your own administrator access." }, 400);
  }

  const { data: target } = await service()
    .from("admin_profiles")
    .select("user_id,role")
    .eq("user_id", targetId)
    .maybeSingle();

  const requiredPermissions = [
    ...(wantsRole
      ? [nextRole === null ? "admins.delete" : target ? "admins.disable" : "admins.create"]
      : []),
    ...(wantsDisable ? ["users.suspend"] : []),
  ];
  const missingPermission = requiredPermissions.find(
    (permission) => !principal.permissions.has(permission),
  );
  if (missingPermission) {
    return c.json(
      {
        error: `Your role does not include the "${missingPermission}" permission.`,
        code: "forbidden",
      },
      403,
    );
  }

  // Granting, revoking or changing an administrator is a super-admin action.
  // Acting on an existing administrator account is too, so a plain admin
  // cannot disable or reclassify their peers.
  const touchesAdmin = Boolean(target) || wantsRole;
  if (touchesAdmin && profile.role !== "super_admin") {
    return c.json(
      {
        error: "Only a super administrator can act on administrator accounts.",
      },
      403,
    );
  }

  const revoking = wantsRole && nextRole === null;
  const demoting = wantsRole && nextRole !== "super_admin" && target?.role === "super_admin";
  const deactivating = wantsDisable && disabled && Boolean(target);
  if (demoting || deactivating) {
    const guard = await guardAdminTarget(targetId);
    if (guard) return c.json({ error: guard }, 400);
  }

  if (wantsDisable) {
    const { error } = await service().auth.admin.updateUserById(targetId, {
      ban_duration: disabled ? "876000h" : "none",
    });
    if (error) {
      const errorId = referenceId();
      await writeAudit(c.req.raw, {
        adminUserId: user.id,
        action: disabled ? "admin.user.disable.failed" : "admin.user.enable.failed",
        targetType: "user",
        targetId,
        errorId,
      });
      return c.json(
        {
          error: "The account status could not be changed.",
          errorId,
        },
        500,
      );
    }
  }

  if (revoking) {
    // Removing the row is what actually revokes access: requireAdmin refuses
    // anyone without an active admin_profiles row.
    const { error } = await service().from("admin_profiles").delete().eq("user_id", targetId);
    if (error) {
      const errorId = referenceId();
      await writeAudit(c.req.raw, {
        adminUserId: user.id,
        action: "admin.role.revoke.failed",
        targetType: "user",
        targetId,
        errorId,
      });
      const lockedOut = error.code === "42501";
      return c.json(
        {
          error: lockedOut
            ? "That change would remove the final active super administrator."
            : "The administrator record could not be removed.",
          errorId,
        },
        lockedOut ? 400 : 500,
      );
    }
  }

  if ((target || wantsRole) && !revoking) {
    const profileUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (wantsRole) profileUpdate.role = nextRole;
    if (wantsDisable) profileUpdate.is_active = !disabled;

    const { error } = await service()
      .from("admin_profiles")
      .update(profileUpdate)
      .eq("user_id", targetId);

    if (error) {
      const errorId = referenceId();
      await writeAudit(c.req.raw, {
        adminUserId: user.id,
        action: "admin.user.update.failed",
        targetType: "user",
        targetId,
        errorId,
      });
      // 42501 here is the last-super-admin trigger refusing the change.
      const lockedOut = error.code === "42501";
      return c.json(
        {
          error: lockedOut
            ? "That change would remove the final active super administrator."
            : "The administrator record could not be updated.",
          errorId,
        },
        lockedOut ? 400 : 500,
      );
    }
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: revoking
      ? "admin.role.revoked"
      : wantsRole
        ? "admin.role.changed"
        : disabled
          ? "admin.user.disabled"
          : "admin.user.enabled",
    targetType: "user",
    targetId,
    metadata: wantsRole ? { role: nextRole } : {},
  });
  return c.json({
    updated: true,
    disabled,
    role: revoking ? null : (nextRole ?? target?.role ?? null),
  });
};

const handleUserDelete = async (c: Ctx) => {
  const principal = c.get("admin");
  const { user, profile } = principal;
  const targetId = c.req.param("id") ?? "";
  if (!isUuid(targetId)) return c.json({ error: "Invalid user ID." }, 400);
  if (targetId === user.id) {
    return c.json({ error: "You cannot delete your own account." }, 400);
  }

  const { data: target } = await service()
    .from("admin_profiles")
    .select("user_id,role")
    .eq("user_id", targetId)
    .maybeSingle();

  const requiredPermission = target ? "admins.delete" : "users.delete";
  if (!principal.permissions.has(requiredPermission)) {
    return c.json(
      {
        error: `Your role does not include the "${requiredPermission}" permission.`,
        code: "forbidden",
      },
      403,
    );
  }

  if (target && profile.role !== "super_admin") {
    return c.json(
      {
        error: "Only a super administrator can act on administrator accounts.",
      },
      403,
    );
  }

  const guard = await guardAdminTarget(targetId);
  if (guard) return c.json({ error: guard }, 400);

  const { error } = await service().auth.admin.deleteUser(targetId);
  if (error) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.user.delete.failed",
      targetType: "user",
      targetId,
      errorId,
    });
    return c.json({ error: "The account could not be deleted.", errorId }, 500);
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.user.deleted",
    targetType: "user",
    targetId,
  });
  return c.json({ deleted: true });
};

const handlePostPatch = async (c: Ctx) => {
  const principal = c.get("admin");
  const { user } = principal;
  const targetId = c.req.param("id") ?? "";
  if (!isUuid(targetId)) return c.json({ error: "Invalid post ID." }, 400);
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const patch: Record<string, unknown> = {
    moderated_by: user.id,
    moderated_at: new Date().toISOString(),
  };
  const hidden = body.value.hidden;
  if (typeof hidden === "boolean") {
    const permission = hidden ? "posts.hide" : "posts.restore";
    if (!principal.permissions.has(permission)) {
      return c.json(
        {
          error: `Your role does not include the "${permission}" permission.`,
          code: "forbidden",
        },
        403,
      );
    }
  }
  if (typeof hidden === "boolean") patch.is_hidden = hidden;
  if ("reason" in body.value) {
    const reason = readString(body.value, "reason", 2000);
    if (reason === null) return c.json({ error: "Reason must be text." }, 400);
    patch.moderation_reason = reason ?? "";
  }
  if (!Object.keys(patch).length || Object.keys(patch).length === 2) {
    return c.json({ error: "No moderation change was supplied." }, 400);
  }

  const { error } = await service().from("posts").update(patch).eq("id", targetId);
  if (error) return c.json({ error: "The post could not be updated." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: patch.is_hidden === true ? "admin.post.hidden" : "admin.post.restored",
    targetType: "post",
    targetId,
    metadata: { reason: patch.moderation_reason ?? null },
  });
  return c.json({ updated: true });
};

const handlePostDelete = async (c: Ctx) => {
  const principal = c.get("admin");
  const { user } = principal;
  if (!principal.permissions.has("posts.delete")) {
    return c.json(
      {
        error: 'Your role does not include the "posts.delete" permission.',
        code: "forbidden",
      },
      403,
    );
  }
  const targetId = c.req.param("id") ?? "";
  if (!isUuid(targetId)) return c.json({ error: "Invalid post ID." }, 400);

  const { error } = await service().from("posts").delete().eq("id", targetId);
  if (error) return c.json({ error: "The post could not be deleted." }, 500);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.post.deleted",
    targetType: "post",
    targetId,
  });
  return c.json({ deleted: true });
};

const handleCommentDelete = async (c: Ctx) => {
  const principal = c.get("admin");
  const { user } = principal;
  if (!principal.permissions.has("comments.delete")) {
    return c.json(
      {
        error: 'Your role does not include the "comments.delete" permission.',
        code: "forbidden",
      },
      403,
    );
  }
  const targetId = c.req.param("id") ?? "";
  if (!isUuid(targetId)) return c.json({ error: "Invalid comment ID." }, 400);

  const { error } = await service().from("comments").delete().eq("id", targetId);
  if (error) return c.json({ error: "The comment could not be deleted." }, 500);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.comment.deleted",
    targetType: "comment",
    targetId,
  });
  return c.json({ deleted: true });
};

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------

const NULLABLE_FIELDS = new Set([
  "favicon_url",
  "contact_email",
  "contact_phone",
  "website_url",
  "startup_animation_url",
  "error_animation_url",
  "maintenance_animation_url",
  "maintenance_route",
  "maintenance_starts_at",
  "maintenance_ends_at",
]);

const TEXT_LIMITS: Record<string, number> = {
  site_name: 80,
  site_title: 120,
  logo_url: 512,
  startup_animation_url: 512,
  error_animation_url: 512,
  maintenance_animation_url: 512,
  pwa_install_title: 48,
  pwa_install_description: 140,
  pwa_install_cta: 20,
  footer_text: 240,
  announcement_text: 300,
  homepage_kicker: 120,
};

const handleSettingsGet = async (c: Ctx) => {
  const { data, error } = await service()
    .from("site_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) {
    return c.json(
      {
        error:
          "Site settings could not be read. Is supabase/migrations/20261002000000_velori_admin.sql applied?",
      },
      500,
    );
  }
  return c.json({ settings: data });
};

const handleSettingsPut = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const update: Record<string, unknown> = {};

  for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
    if (!(field in body.value)) continue;
    const raw = body.value[field];
    if (raw === null || raw === "") {
      if (field === "logo_url") {
        return c.json({ error: "logo_url cannot be empty." }, 400);
      }
      if (field.startsWith("pwa_install_")) {
        return c.json({ error: `${field} cannot be empty.` }, 400);
      }
      update[field] = "";
      continue;
    }
    // Rejects arrays, objects and numbers instead of stringifying them into
    // "[object Object]" and failing later as a database constraint error.
    if (typeof raw !== "string") {
      return c.json({ error: `${field} must be text.` }, 400);
    }
    const value = raw.trim();
    if (value.length > limit) {
      return c.json({ error: `${field} must be ${limit} characters or fewer.` }, 400);
    }
    if (
      field === "startup_animation_url" ||
      field === "error_animation_url" ||
      field === "maintenance_animation_url"
    ) {
      let parsed: URL;
      let storageOrigin: string;
      try {
        parsed = new URL(value);
        storageOrigin = new URL(SUPABASE_URL).origin;
      } catch {
        return c.json({ error: `${field} must be a valid uploaded media URL.` }, 400);
      }
      if (
        parsed.origin !== storageOrigin ||
        !parsed.pathname.startsWith("/storage/v1/object/public/site-assets/") ||
        parsed.search ||
        parsed.hash
      ) {
        return c.json(
          {
            error: `${field} must reference an uploaded site animation.`,
          },
          400,
        );
      }
    }
    update[field] = value;
  }

  for (const field of NULLABLE_FIELDS) {
    if (!(field in body.value)) continue;
    const raw = body.value[field];
    if (raw === null || raw === "") {
      update[field] = null;
      continue;
    }
    if (typeof raw !== "string") {
      return c.json({ error: `${field} must be text or null.` }, 400);
    }
    const value = raw.trim();
    if (value.length > 512) {
      return c.json({ error: `${field} must be 512 characters or fewer.` }, 400);
    }
    update[field] = value;
  }

  if ("maintenance_mode" in body.value) {
    const raw = body.value.maintenance_mode;
    if (typeof raw !== "boolean") {
      return c.json({ error: "maintenance_mode must be true or false." }, 400);
    }
    update.maintenance_mode = raw;
  }

  if ("pwa_install_enabled" in body.value) {
    const raw = body.value.pwa_install_enabled;
    if (typeof raw !== "boolean") {
      return c.json({ error: "pwa_install_enabled must be true or false." }, 400);
    }
    update.pwa_install_enabled = raw;
  }

  let targetScope = body.value.maintenance_scope;
  if (targetScope === undefined && "maintenance_route" in body.value) {
    const { data: existingTarget, error: scopeReadError } = await service()
      .from("site_settings")
      .select("maintenance_scope")
      .eq("id", true)
      .maybeSingle();
    if (scopeReadError) return c.json({ error: "Maintenance scope could not be validated." }, 500);
    targetScope = existingTarget?.maintenance_scope ?? "site";
  }

  if ("maintenance_scope" in body.value) {
    const raw = body.value.maintenance_scope;
    if (!["site", "page", "route", "group"].includes(String(raw))) {
      return c.json({ error: "maintenance_scope must be site, page, route or group." }, 400);
    }
    update.maintenance_scope = raw;
  }

  if ("maintenance_route" in body.value) {
    const raw = body.value.maintenance_route;
    if (raw !== null && typeof raw !== "string") {
      return c.json({ error: "maintenance_route must be a supported page path or null." }, 400);
    }
    if (
      typeof raw === "string" &&
      targetScope === "page" &&
      ![
        "/home",
        "/explore",
        "/search",
        "/reels",
        "/stories",
        "/notifications",
        "/messages",
        "/saved",
        "/groups",
        "/settings",
        "/about",
        "/privacy",
        "/terms",
        "/help",
        "/contact",
      ].includes(raw)
    ) {
      return c.json({ error: "maintenance_route must be a supported page path." }, 400);
    }
    if (
      typeof raw === "string" &&
      targetScope === "route" &&
      (!raw.startsWith("/") ||
        raw.includes("*") ||
        raw.includes("..") ||
        raw.includes("\\") ||
        raw.includes("?") ||
        raw.includes("#") ||
        raw.startsWith("/admin"))
    ) {
      return c.json({ error: "Choose a valid public route for maintenance." }, 400);
    }
    if (
      typeof raw === "string" &&
      targetScope === "group" &&
      (!raw.startsWith("/") ||
        !raw.endsWith("/*") ||
        raw.slice(0, -2).includes("*") ||
        raw.includes("..") ||
        raw.includes("\\") ||
        raw.includes("?") ||
        raw.includes("#") ||
        raw.startsWith("/admin"))
    ) {
      return c.json(
        { error: "Route groups must use a public path pattern such as /messages/*." },
        400,
      );
    }
    update.maintenance_route = raw;
  }

  for (const field of ["maintenance_starts_at", "maintenance_ends_at"] as const) {
    if (!(field in body.value)) continue;
    const raw = body.value[field];
    if (raw === null || raw === "") {
      update[field] = null;
      continue;
    }
    if (typeof raw !== "string" || !Number.isFinite(Date.parse(raw))) {
      return c.json({ error: `${field} must be a valid date/time or null.` }, 400);
    }
    update[field] = new Date(raw).toISOString();
  }

  if ("maintenance_starts_at" in update || "maintenance_ends_at" in update) {
    const { data: currentSchedule, error: currentScheduleError } = await service()
      .from("site_settings")
      .select("maintenance_starts_at,maintenance_ends_at")
      .eq("id", true)
      .maybeSingle();
    if (currentScheduleError || !currentSchedule) {
      return c.json({ error: "The current maintenance schedule could not be validated." }, 500);
    }
    const startsAt =
      "maintenance_starts_at" in update
        ? update.maintenance_starts_at
        : currentSchedule.maintenance_starts_at;
    const endsAt =
      "maintenance_ends_at" in update
        ? update.maintenance_ends_at
        : currentSchedule.maintenance_ends_at;
    if (startsAt && endsAt && Date.parse(String(endsAt)) <= Date.parse(String(startsAt))) {
      return c.json({ error: "The maintenance end time must be after its start time." }, 400);
    }
  }

  if (
    update.maintenance_scope &&
    update.maintenance_scope !== "site" &&
    update.maintenance_route === undefined
  ) {
    const { data: currentSettings, error: currentSettingsError } = await service()
      .from("site_settings")
      .select("maintenance_route")
      .eq("id", true)
      .maybeSingle();
    const currentTarget = currentSettings?.maintenance_route;
    if (currentSettingsError || typeof currentTarget !== "string" || !currentTarget.trim()) {
      return c.json({ error: "A route target is required for targeted maintenance." }, 400);
    }
    if (update.maintenance_scope === "group" && !currentTarget.endsWith("/*")) {
      return c.json(
        { error: "Route groups must use a public path pattern such as /messages/*." },
        400,
      );
    }
    if (
      update.maintenance_scope === "route" &&
      (!currentTarget.startsWith("/") ||
        currentTarget.includes("*") ||
        currentTarget.includes("..") ||
        currentTarget.includes("\\") ||
        currentTarget.includes("?") ||
        currentTarget.includes("#") ||
        currentTarget.startsWith("/admin"))
    ) {
      return c.json({ error: "Choose a valid public route for maintenance." }, 400);
    }
  }
  if (
    update.maintenance_scope &&
    update.maintenance_scope !== "site" &&
    update.maintenance_route === null
  ) {
    return c.json({ error: "A route target is required for targeted maintenance." }, 400);
  }

  if ("error_404_enabled" in body.value) {
    const raw = body.value.error_404_enabled;
    if (typeof raw !== "boolean") {
      return c.json({ error: "error_404_enabled must be true or false." }, 400);
    }
    update.error_404_enabled = raw;
  }

  if ("theme_accent" in body.value) {
    const raw = body.value.theme_accent;
    if (raw !== "rose" && raw !== "blue" && raw !== "cyan") {
      return c.json({ error: "theme_accent must be rose, blue or cyan." }, 400);
    }
    update.theme_accent = raw;
  }

  if (!Object.keys(update).length) {
    return c.json({ error: "No recognised settings were supplied." }, 400);
  }
  if ("site_name" in update && String(update.site_name).length < 1) {
    return c.json({ error: "site_name cannot be empty." }, 400);
  }

  update.updated_by = user.id;
  update.updated_at = new Date().toISOString();

  const { data, error } = await service()
    .from("site_settings")
    .update(update)
    .eq("id", true)
    .select()
    .single();

  if (error) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.settings.update.failed",
      targetType: "site",
      errorId,
    });
    return c.json({ error: "Site settings could not be saved.", errorId }, 500);
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.settings.updated",
    targetType: "site",
    metadata: {
      fields: Object.keys(update).filter((key) => !key.startsWith("updated_")),
    },
  });
  return c.json({ settings: data });
};

const uploadSiteAsset = async (c: Ctx, forcedKind?: "maintenance_animation_url") => {
  const { user } = c.get("admin");

  const declaredLength = Number.parseInt(c.req.header("content-length") ?? "0", 10);
  // Reject an oversized upload before buffering it into memory.
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ANIMATION_UPLOAD_BYTES + 8192) {
    return c.json({ error: "Uploads must be 10 MB or smaller." }, 413);
  }

  const form = await c.req.raw.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "No file was uploaded." }, 400);
  }

  const rawKind = form?.get("kind");
  const kind =
    forcedKind ??
    (rawKind === "startup_animation_url" ||
    rawKind === "error_animation_url" ||
    rawKind === "maintenance_animation_url"
      ? rawKind
      : rawKind === null || rawKind === "logo_url"
        ? "logo_url"
        : null);
  if (!kind) {
    return c.json({ error: "Choose a supported upload purpose." }, 400);
  }
  const allowedTypes =
    kind === "logo_url"
      ? ["image/png", "image/jpeg", "image/webp"]
      : ["video/mp4", "image/png", "image/jpeg", "image/webp"];
  const extension = allowedTypes.includes(file.type) ? ASSET_TYPES[file.type] : null;
  if (!extension) {
    return c.json(
      {
        error:
          kind === "logo_url"
            ? "Logo files must be PNG, JPEG or WebP."
            : "Animation files must be MP4 video or a PNG/JPEG/WebP image.",
      },
      415,
    );
  }
  if (file.size === 0) {
    return c.json({ error: "The uploaded file is empty." }, 400);
  }
  const maxBytes = kind === "logo_url" ? MAX_UPLOAD_BYTES : MAX_ANIMATION_UPLOAD_BYTES;
  if (file.size > maxBytes) {
    return c.json(
      {
        error:
          kind === "logo_url"
            ? "Logo images must be 2 MB or smaller."
            : "Animation videos must be 10 MB or smaller.",
      },
      413,
    );
  }

  // The declared Content-Type is attacker controlled, so the real bytes decide.
  // The storage key is generated, so no client filename reaches the path and
  // there is no traversal surface.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = (offset: number, pattern: number[]) =>
    bytes.length >= offset + pattern.length &&
    pattern.every((byte, index) => bytes[offset + index] === byte);
  const isPng = signature(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const isJpeg = signature(0, [0xff, 0xd8, 0xff]);
  const isWebp = signature(0, [0x52, 0x49, 0x46, 0x46]) && signature(8, [0x57, 0x45, 0x42, 0x50]);
  const isMp4 = signature(4, [0x66, 0x74, 0x79, 0x70]);
  const detected = isPng
    ? "image/png"
    : isJpeg
      ? "image/jpeg"
      : isWebp
        ? "image/webp"
        : isMp4
          ? "video/mp4"
          : null;

  if (!detected || detected !== file.type || !allowedTypes.includes(detected)) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.asset.rejected",
      targetType: "asset",
      metadata: { declaredType: file.type, detected, bytes: bytes.length },
      errorId,
    });
    return c.json(
      {
        error: "The file contents do not match an allowed image or video format.",
        errorId,
      },
      415,
    );
  }

  const path = `${kind.replace("_url", "")}-${crypto.randomUUID()}.${extension}`;
  const { error } = await service()
    .storage.from("site-assets")
    .upload(path, bytes, { contentType: detected, upsert: false });

  if (error) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.asset.upload.failed",
      targetType: "asset",
      targetId: path,
      errorId,
    });
    return c.json(
      {
        error:
          "The asset could not be uploaded. Confirm the site-assets bucket exists and its migration is applied.",
        errorId,
      },
      500,
    );
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.asset.uploaded",
    targetType: "asset",
    targetId: path,
    metadata: { bytes: bytes.length, contentType: detected, kind },
  });

  return c.json({
    url: `${SUPABASE_URL}/storage/v1/object/public/site-assets/${path}`,
    path,
  });
};

const handleAssetUpload = (c: Ctx) => uploadSiteAsset(c);
const handleMaintenanceAssetUpload = (c: Ctx) => uploadSiteAsset(c, "maintenance_animation_url");

const handleHealth = (c: Ctx) =>
  c.json({
    status: "ok",
    configured: !misconfigured(),
    originsConfigured: CONFIGURED_ORIGINS.length > 0,
    setupCodeEnabled: Boolean(SETUP_CODE),
    mediaCleanupConfigured: (Deno.env.get("VELORI_MEDIA_CLEANUP_TOKEN")?.length ?? 0) >= 32,
  });

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
//
// Three layers, in order:
//   1. Public entrypoints (initialize, login) — no session exists yet.
//   2. `requireAdmin` on /admin/* — fails closed for every current or future
//      route under the prefix, so a new handler cannot be exposed by accident.
//   3. `requirePermission` per route — the specific grant a route needs.
//
// Where one HTTP route covers several actions with different grants (user
// moderation, for example), the handler re-checks the permission for the action
// it was actually asked to perform.

const admin = "/admin";

// This scheduled service-only route receives no browser CORS privileges and
// has its own rotatable token. Storage object paths never enter logs or replies.
app.post("/_internal/storage-cleanup", async (c) => {
  const expected = Deno.env.get("VELORI_MEDIA_CLEANUP_TOKEN") ?? "";
  const supplied = c.req.header("x-velori-media-cleanup-token") ?? "";
  if (!expected || !timingSafeEqualString(expected, supplied)) {
    return c.json({ error: "Unauthorized." }, 401);
  }
  return await handleMediaCleanup(c);
});

app.post(`${admin}/initialize`, handleInitializeAdmin);
app.post(`${admin}/login`, handleLogin);

app.use(`${admin}/*`, requireAdmin);

// -- Session and identity ---------------------------------------------------
app.get(`${admin}/me`, handleMe);
app.post(`${admin}/logout`, handleLogout);
app.put(`${admin}/profile`, handleProfilePut);
app.put(`${admin}/credentials`, handleCredentialsPut);
app.post(`${admin}/reauthenticate`, handleReauthenticate);
app.get(`${admin}/access-code`, requirePermission("security.edit"), handleAccessCodeGet);
app.put(`${admin}/access-code`, requirePermission("security.edit"), handleAccessCodePut);

app.get(`${admin}/sessions`, requirePermission("admins.view"), handleSessionsList);
app.post(
  `${admin}/sessions/revoke-others`,
  requirePermission("admins.view"),
  handleSessionsRevokeOthers,
);
app.delete(`${admin}/sessions/:id`, requirePermission("admins.view"), handleSessionRevoke);

// -- Dashboard, search and diagnostics ---------------------------------------
app.get(`${admin}/overview`, requirePermission("system.view"), handleDashboard);
app.get(`${admin}/search`, requirePermission("users.view"), handleGlobalSearch);
app.get(`${admin}/logs`, requirePermission("audit.view"), handleAuditList);
app.get(`${admin}/system-health`, requirePermission("system.view"), handleHealthProbe);
app.get(`${admin}/system/storage`, requirePermission("system.view"), handleStorageReport);
app.get(`${admin}/system/version`, requirePermission("system.view"), handleVersion);
app.get(`${admin}/system/config-export`, requirePermission("system.export"), handleConfigExport);

// -- Users ------------------------------------------------------------------
app.get(`${admin}/users`, requirePermission("users.view"), handleUsersList);
app.get(`${admin}/users/:id`, requirePermission("users.view"), handleUserDetail);
app.patch(`${admin}/users/:id`, handleUserPatch);
app.delete(`${admin}/users/:id`, handleUserDelete);
app.patch(`${admin}/users/:id/profile`, requirePermission("users.edit"), handleUserProfilePatch);
app.post(`${admin}/users/:id/actions`, handleUserAction);

// -- Content moderation -----------------------------------------------------
app.get(`${admin}/posts`, requirePermission("posts.view"), handlePostsListV2);
app.patch(`${admin}/posts/:id`, handlePostPatch);
app.delete(`${admin}/posts/:id`, handlePostDelete);
app.get(`${admin}/comments`, requirePermission("comments.view"), handleCommentsListV2);
app.patch(`${admin}/comments/:id`, handleCommentPatch);
app.delete(`${admin}/comments/:id`, handleCommentDelete);
app.get(`${admin}/reports`, requirePermission("reports.view"), handleReportsListV2);
app.patch(`${admin}/reports/:id`, handleReportPatchV2);
app.get(
  `${admin}/message-reports`,
  requirePermission("messages.view_reports"),
  handleMessageReportsList,
);
app.get(`${admin}/groups`, requirePermission("groups.view"), handleGroupsList);
app.patch(`${admin}/groups/:id`, requirePermission("groups.lock"), handleGroupModerationPatch);

// Reels and stories are moderated through the service-role boundary, like posts
// and comments. The write permission is checked inside each handler because the
// required permission depends on the requested state (hide vs delete vs
// restore), so a single fixed requirePermission() cannot express it.
app.get(`${admin}/reels`, requirePermission("reels.view"), handleReelsList);
app.patch(`${admin}/reels/:id`, handleReelPatch);
app.get(`${admin}/stories`, requirePermission("stories.view"), handleStoriesList);
app.patch(`${admin}/stories/:id`, handleStoryPatch);

// -- CMS --------------------------------------------------------------------
app.get(`${admin}/cms/pages`, requirePermission("cms.view"), handleCmsPagesListV2);
app.post(`${admin}/cms/pages`, requirePermission("cms.edit"), handleCmsPageCreateV2);
app.get(`${admin}/cms/pages/:id`, requirePermission("cms.view"), handleCmsPageGet);
app.patch(`${admin}/cms/pages/:id`, requirePermission("cms.edit"), handleCmsPagePatch);
app.post(`${admin}/cms/pages/:id/publish`, requirePermission("cms.publish"), handleCmsPagePublish);
app.delete(`${admin}/cms/pages/:id`, requirePermission("cms.delete"), handleCmsPageDelete);
app.post(`${admin}/cms/pages/:id/duplicate`, requirePermission("cms.edit"), handleCmsPageDuplicate);
app.get(`${admin}/cms/pages/:id/versions`, requirePermission("cms.view"), handleCmsVersionsList);
app.post(
  `${admin}/cms/pages/:id/versions/:version/restore`,
  requirePermission("cms.publish"),
  handleCmsVersionRestore,
);

// -- Route registry and navigation ------------------------------------------
app.get(`${admin}/routes`, requirePermission("navigation.view"), handleRoutesList);
app.patch(`${admin}/routes/*`, requirePermission("navigation.edit"), handleRoutePatch);
app.get(`${admin}/navigation`, requirePermission("navigation.view"), handleNavigationListV2);
app.post(`${admin}/navigation`, requirePermission("navigation.edit"), handleNavigationCreate);
app.post(
  `${admin}/navigation/reorder`,
  requirePermission("navigation.edit"),
  handleNavigationReorder,
);
app.patch(`${admin}/navigation/:id`, requirePermission("navigation.edit"), handleNavigationPatchV2);
app.delete(`${admin}/navigation/:id`, requirePermission("navigation.edit"), handleNavigationDelete);

// -- Appearance -------------------------------------------------------------
app.get(`${admin}/branding`, requirePermission("branding.view"), handleBrandingList);
app.post(`${admin}/branding`, requirePermission("branding.edit"), handleBrandingUpload);
app.post(
  `${admin}/branding/:id/restore/:version`,
  requirePermission("branding.edit"),
  handleBrandingRestoreVersion,
);
app.patch(`${admin}/branding/:id`, requirePermission("branding.edit"), handleBrandingPatch);
app.get(`${admin}/animations`, requirePermission("animations.view"), handleAnimationsList);
app.patch(`${admin}/animations/:key`, requirePermission("animations.edit"), handleAnimationPatch);
app.post(`${admin}/motion`, requirePermission("animations.edit"), handleMotionUpload);
app.get(`${admin}/design/motion`, requirePermission("motion.read"), handleMotionCmsGet);
app.get(`${admin}/studio-catalog`, requirePermission("motion.read"), handleStudioCatalogAdminGet);
app.get(
  `${admin}/creator-source/files`,
  requirePermission(SOURCE_PERMISSION_BY_ACTION.browse),
  handleCreatorSourceFilesGet,
);
app.get(
  `${admin}/creator-source/file`,
  requirePermission(SOURCE_PERMISSION_BY_ACTION.browse),
  handleCreatorSourceFileGet,
);
app.post(
  `${admin}/creator-source/pull-request`,
  requirePermission(SOURCE_PERMISSION_BY_ACTION.pullRequest),
  handleCreatorSourcePullRequest,
);
app.post(
  `${admin}/studio-catalog/music`,
  requirePermission("motion.write"),
  handleStudioMusicCreate,
);
app.post(
  `${admin}/studio-catalog/stickers`,
  requirePermission("motion.write"),
  handleStudioStickerCreate,
);
app.post(
  `${admin}/studio-catalog/:type/:id/asset`,
  requirePermission("motion.write"),
  handleStudioCatalogAssetReplace,
);
app.patch(
  `${admin}/studio-catalog/:type/:id`,
  requirePermission("motion.write"),
  handleStudioCatalogPatch,
);
app.delete(
  `${admin}/studio-catalog/:type/:id`,
  requirePermission("motion.write"),
  handleStudioCatalogDelete,
);
app.post(
  `${admin}/studio-catalog/sticker-categories`,
  requirePermission("motion.write"),
  handleStudioStickerCategoryCreate,
);
app.patch(
  `${admin}/studio-catalog/sticker-categories/:id`,
  requirePermission("motion.write"),
  handleStudioStickerCategoryPatch,
);
app.get("/studio-catalog", handleStudioCatalogPublicGet);
app.put(`${admin}/design/motion/draft`, requirePermission("motion.write"), handleMotionCmsDraftPut);
app.post(
  `${admin}/media/error-illustrations/:code`,
  requirePermission("motion.write"),
  handleErrorIllustrationUpload,
);
app.post(
  `${admin}/design/motion/publish`,
  requirePermission("motion.publish"),
  handleMotionCmsPublish,
);
app.post(
  `${admin}/design/motion/restore/:version`,
  requirePermission("motion.publish"),
  handleMotionCmsRestore,
);
app.get(`${admin}/appearance`, requirePermission("theme.view"), handleAppearanceGet);
app.put(`${admin}/appearance`, requirePermission("theme.edit"), handleAppearancePut);

// -- Announcements and notifications ---------------------------------------
app.get(
  `${admin}/announcements`,
  requirePermission("notifications.view"),
  handleAnnouncementsListV2,
);
app.post(
  `${admin}/announcements/media`,
  requirePermission("notifications.edit"),
  handleAnnouncementMediaUpload,
);
app.post(
  `${admin}/announcements/:id/publish`,
  requirePermission("notifications.edit"),
  handleAnnouncementPublish,
);
app.get(
  `${admin}/announcements/:id/versions`,
  requirePermission("notifications.view"),
  handleAnnouncementVersions,
);
app.post(
  `${admin}/announcements/:id/restore`,
  requirePermission("notifications.edit"),
  handleAnnouncementRestore,
);
app.post(
  `${admin}/announcements`,
  requirePermission("notifications.edit"),
  handleAnnouncementCreateV2,
);
app.patch(
  `${admin}/announcements/:id`,
  requirePermission("notifications.edit"),
  handleAnnouncementPatch,
);
app.delete(
  `${admin}/announcements/:id`,
  requirePermission("notifications.edit"),
  handleAnnouncementDelete,
);
app.get(`${admin}/notifications`, requirePermission("notifications.view"), handleNotificationsList);
app.post(
  `${admin}/notifications`,
  requirePermission("notifications.send"),
  handleNotificationCreate,
);
app.delete(
  `${admin}/notifications/:id`,
  requirePermission("notifications.edit"),
  handleNotificationDelete,
);

// -- Advertisements ---------------------------------------------------------
app.get(`${admin}/ads`, requirePermission("ads.view"), handleAdsList);
app.post(`${admin}/ads/media`, requirePermission("ads.edit"), handleAdMediaUpload);
app.post(`${admin}/ads`, requirePermission("ads.edit"), handleAdCreate);
app.patch(`${admin}/ads/:id`, requirePermission("ads.edit"), handleAdPatch);
app.post(`${admin}/ads/:id/publish`, requirePermission("ads.edit"), handleAdPublish);
app.delete(`${admin}/ads/:id`, requirePermission("ads.edit"), handleAdDelete);

// -- Feature flags and platform settings ------------------------------------
app.get(`${admin}/offers`, requirePermission("offers.view"), handleOffersList);
app.post(`${admin}/offers`, requirePermission("offers.edit"), handleOfferCreate);
app.patch(`${admin}/offers/:id`, requirePermission("offers.edit"), handleOfferPatch);
app.get(`${admin}/referrals/program`, requirePermission("referrals.view"), handleReferralProgramGet);
app.patch(`${admin}/referrals/program`, requirePermission("referrals.edit"), handleReferralProgramPatch);
app.get(`${admin}/referrals`, requirePermission("referrals.view"), handleReferralsList);
app.get(`${admin}/referrals/events`, requirePermission("referrals.view"), handleReferralEventsList);
app.get(`${admin}/referrals/rewards`, requirePermission("referrals.view"), handleReferralRewardsList);
app.patch(`${admin}/referrals/codes/:userId`, requirePermission("referrals.edit"), handleReferralCodePatch);
app.post(`${admin}/referrals/rewards/:id/reverse`, requirePermission("referrals.reverse"), handleReferralRewardReverse);
app.get(`${admin}/feature-flags`, requirePermission("flags.view"), handleFeatureFlagsListV2);
app.patch(`${admin}/feature-flags/:key`, requirePermission("flags.edit"), handleFeatureFlagPatchV2);
app.get(`${admin}/settings`, requirePermission("settings.view"), handleSettingsGet);
app.put(`${admin}/settings`, requirePermission("settings.edit"), handleSettingsPut);
app.get(
  `${admin}/platform-settings`,
  requirePermission("settings.view"),
  handlePlatformSettingsGet,
);
app.put(
  `${admin}/platform-settings`,
  requirePermission("settings.edit"),
  handlePlatformSettingsPut,
);
app.post(
  `${admin}/platform-settings/emergency`,
  requirePermission("system.emergency"),
  handleEmergencyMode,
);
app.post(`${admin}/assets`, requirePermission("branding.edit"), handleAssetUpload);
app.post(
  `${admin}/maintenance-assets`,
  requirePermission("settings.edit"),
  handleMaintenanceAssetUpload,
);

// -- Administrators, roles and email templates ------------------------------
app.get(`${admin}/admins`, requirePermission("admins.view"), handleAdminsList);
app.post(`${admin}/admins`, requirePermission("admins.create"), handleAdminsCreate);
app.patch(`${admin}/admins/:id`, requirePermission("admins.disable"), handleAdminsPatch);
app.delete(`${admin}/admins/:id`, requirePermission("admins.delete"), handleAdminsDelete);
app.get(`${admin}/roles`, requirePermission("admins.view"), handleRolesList);
app.patch(`${admin}/roles/:key`, requirePermission("roles.edit"), handleRolePatch);
app.get(`${admin}/provisioning`, requirePermission("admins.view"), handleProvisioningStatus);
app.get(`${admin}/emails`, requirePermission("emails.view"), handleEmailsList);
app.patch(`${admin}/emails/:key`, requirePermission("emails.edit"), handleEmailPatch);
app.post(`${admin}/emails/:key/test`, requirePermission("emails.edit"), handleEmailTestSend);

app.get("/health", handleHealth);

app.all("*", (c: Ctx) => c.json({ error: "Not found." }, 404));

// ---------------------------------------------------------------------------
// Path normalisation
// ---------------------------------------------------------------------------
//
// The Supabase gateway forwards the function slug as the first path segment: a
// request to `/functions/v1/server/health` reaches this process as
// `/server/health`, and `/functions/v1/server/admin/login` as
// `/server/admin/login`. Every route below is registered the way the client
// calls it (`/health`, `/admin/login`), so without this step nothing matches and
// all traffic falls through to the catch-all 404, indistinguishable from an
// undeployed function.
//
// The rewrite has to happen before `app.fetch`, not in middleware: Hono resolves
// the route table once per request from the URL, so mutating `c.req.path` after
// matching changes nothing.
//
// The slug is not stripped when it is absent, so the same build still works
// behind `supabase functions serve`.
const FUNCTION_SLUG = "server";

Deno.serve((request: Request) => {
  const url = new URL(request.url);
  if (url.pathname === `/${FUNCTION_SLUG}`) {
    url.pathname = "/";
  } else if (url.pathname.startsWith(`/${FUNCTION_SLUG}/`)) {
    url.pathname = url.pathname.slice(FUNCTION_SLUG.length + 1);
  } else {
    return app.fetch(request);
  }
  return app.fetch(new Request(url, request));
});
