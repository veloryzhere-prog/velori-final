import { resolveValue } from "./env.mjs";

// Public values come from the Vite env files the browser also loads. Privileged
// values come from `.env.secrets.local` or the environment, which Vite never
// opens, so the split public/secret contract stays honest at verification time
// as well as at build time.
const configuredUrl =
  resolveValue("VITE_SUPABASE_URL") || resolveValue("SUPABASE_URL", { secret: true });
const publishableKey =
  resolveValue("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  resolveValue("SUPABASE_PUBLISHABLE_KEY", { secret: true });
const configuredOrigins =
  resolveValue("VELORI_ALLOWED_ORIGINS", { secret: true }) ||
  resolveValue("ALLOWED_ORIGINS", { secret: true });
const serviceRoleKey =
  resolveValue("VELORI_SUPABASE_SECRET_KEY", { secret: true }) ||
  resolveValue("SUPABASE_SECRET_KEY", { secret: true }) ||
  resolveValue("SUPABASE_SERVICE_ROLE_KEY", { secret: true });
let projectUrl;
try {
  projectUrl = new URL(configuredUrl);
} catch {
  throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before verification.");
}

if (
  !publishableKey ||
  projectUrl.protocol !== "https:" ||
  !projectUrl.hostname.endsWith(".supabase.co")
) {
  throw new Error(
    "Supabase verification requires a project HTTPS URL and public anon/publishable key.",
  );
}

const expectedProject = projectUrl.hostname.slice(0, -".supabase.co".length);
const baseUrl = projectUrl.origin;
const failures = [];
const headers = {
  apikey: publishableKey,
  Authorization: `Bearer ${publishableKey}`,
};

function report(name, ok, detail = "") {
  const status = ok ? "PASS" : "FAIL";
  console.log(`${status} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures.push(name);
}

async function check(
  name,
  path,
  { fields, filters, allowStatus = [200], method = "GET", body, requestHeaders = headers } = {},
) {
  const url = new URL(path, baseUrl);
  if (fields) {
    url.searchParams.set("select", fields);
    url.searchParams.set("limit", "0");
  }
  for (const [name, value] of Object.entries(filters ?? {})) {
    url.searchParams.set(name, String(value));
  }
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...requestHeaders,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const accepted = allowStatus.includes(response.status);
    const extra = payload?.code ?? payload?.error ?? payload?.message ?? "";
    report(name, accepted, `HTTP ${response.status}${extra ? ` ${extra}` : ""}`);
    return { response, payload };
  } catch (error) {
    report(name, false, error instanceof Error ? error.name : "request failed");
    return null;
  }
}

const projectClaim = publishableKey.startsWith("sb_publishable_")
  ? null
  : (() => {
      try {
        const payload = publishableKey.split(".")[1];
        return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).ref;
      } catch {
        return null;
      }
    })();
if (projectClaim) {
  report("Frontend key targets configured project", projectClaim === expectedProject);
} else {
  console.log(
    "INFO Publishable key has no decodable project claim; the Auth and database requests below verify that the configured host accepts it.",
  );
}

await check("Auth API", "/auth/v1/health");

const relations = [
  ["profiles", "id,username,display_name,avatar_url,is_private,created_at"],
  [
    "posts",
    "id,author_id,body,visibility,allow_comments,allow_likes,hide_like_count,allow_sharing,is_published,archived_at,deleted_at,delete_expires_at,created_at,updated_at",
  ],
  ["likes", "user_id,post_id,created_at"],
  ["saves", "user_id,post_id,created_at"],
  ["comments", "id,post_id,author_id,parent_id,body,created_at"],
  ["post_tags", "post_id,tag"],
  [
    "site_settings",
    "id,site_name,site_title,logo_url,favicon_url,contact_email,contact_phone,website_url,footer_text,announcement_text,maintenance_mode,homepage_kicker,theme_accent,error_404_enabled,startup_animation_url,error_animation_url,updated_at",
  ],
  [
    "admin_profiles",
    "user_id,role,display_name,job_title,bio,avatar_url,is_active,mfa_required,session_timeout_minutes,created_at,updated_at",
  ],
  ["admin_login_attempts", "id,email_hash,ip_address,succeeded,created_at"],
];

for (const [table, fields] of relations) {
  await check(`Database contract ${table}`, `/rest/v1/${table}`, { fields });
}

// Sensitive profile columns are intentionally denied to direct PostgREST
// selects. Profile discovery and self-editing use privacy-aware RPCs instead.
await check("Direct sensitive profile fields are denied", "/rest/v1/profiles", {
  fields: "bio,website_url,link_title,account_type",
  allowStatus: [401, 403],
});

const postFeedSelection =
  "id,author_id,body,created_at,visibility,allow_comments,allow_likes,hide_like_count,allow_sharing,is_published,archived_at,deleted_at,delete_expires_at,profiles!posts_author_id_fkey(id,username,display_name,avatar_url,is_private),likes(user_id),saves(user_id),post_media(id,object_path,media_type,position,alt_text)";
await check("Public feed query contract", "/rest/v1/posts", {
  fields: postFeedSelection,
  filters: {
    visibility: "in.(public,followers)",
    is_published: "eq.true",
    archived_at: "is.null",
    deleted_at: "is.null",
    order: "created_at.desc,id.desc",
  },
});
await check("Public post detail query contract", "/rest/v1/posts", {
  fields: postFeedSelection,
});
await check("Public post discussion query contract", "/rest/v1/comments", {
  fields:
    "id,body,created_at,profiles!comments_author_id_fkey(id,username,display_name,avatar_url,is_private)",
  filters: { parent_id: "is.null", order: "created_at.asc" },
});

const serviceHeaders = serviceRoleKey
  ? { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
  : null;

// These protected relations are not readable anonymously, so 401/403 confirms
// the relation exists while 404/PGRST205 pinpoints a missing migration.
for (const [table, fields] of [
  ["follows", "follower_id,following_id,status,created_at,responded_at"],
  ["post_drafts", "id,author_id,visibility,updated_at"],
  ["post_media", "id,post_id,author_id,object_path"],
  ["post_draft_media", "id,draft_id,author_id,object_path"],
  ["content_reports", "id,target_type,target_id,reporter_id,status,created_at"],
  ["cms_pages", "id,title,slug,route,status,updated_at"],
  ["cms_page_versions", "id,page_id,version_label,created_at"],
  ["motion_presets", "id,label,category,description,parameters,enabled,created_at,updated_at"],
  [
    "motion_configuration",
    "id,draft_config,published_config,published_version,published_at,updated_by,updated_at",
  ],
  [
    "motion_versions",
    "id,version,snapshot,change_summary,event,created_by,created_at,published_at",
  ],
  ["navigation_items", "id,label,route,position,visible,feature_flag,navigation_scope"],
  ["feature_flags", "key,enabled,rollout,updated_at"],
  ["system_announcements", "id,title,message,active,starts_at,ends_at"],
  ["admin_error_pages", "code,title,description,enabled,updated_at"],
  [
    "reels",
    "id,author_id,title,caption,status,visibility,allow_comments,allow_likes,allow_sharing,moderation_state,created_at,updated_at,published_at,expires_at",
  ],
  [
    "reel_media",
    "id,reel_id,media_type,object_path,mime_type,byte_size,width,height,duration_seconds,processing_state,created_at",
  ],
  ["reel_views", "reel_id,viewer_id,viewed_on,created_at"],
  ["reel_drafts", "id,author_id,title,caption,visibility,updated_at,created_at"],
  ["reel_likes", "reel_id,user_id,created_at"],
  ["reel_saves", "reel_id,user_id,created_at"],
  ["reel_comments", "id,reel_id,author_id,parent_id,body,is_hidden,created_at,updated_at"],
  ["reel_reports", "id,reel_id,reporter_id,category,reason,status,created_at,updated_at"],
  [
    "reel_settings",
    "author_id,audience,allow_comments,allow_likes,allow_sharing,allow_download,allow_remix,updated_at",
  ],
  [
    "stories",
    "id,author_id,caption,media_url,media_type,audience,status,moderation_state,hide_from_self,allow_replies,allow_reactions,created_at,expires_at,updated_at",
  ],
  ["story_media", "id,story_id,media_url,media_type,object_path,mime_type,byte_size,created_at"],
  ["story_views", "story_id,viewer_id,viewed_at"],
  ["story_replies", "id,story_id,author_id,body,created_at"],
  ["story_reports", "id,story_id,reporter_id,category,reason,status,created_at,updated_at"],
  [
    "story_settings",
    "author_id,audience,hide_from_self,allow_replies,allow_reactions,auto_expire_minutes,updated_at",
  ],
  [
    "notifications",
    "id,recipient_id,actor_id,kind,title,body,link,entity_type,entity_id,system_notification_id,expires_at,read_at,created_at,updated_at",
  ],
  [
    "notification_preferences",
    "profile_id,likes,comments,replies,follows,mentions,stories,reels,security,system,updated_at",
  ],
  [
    "admin_audit_logs",
    "id,admin_user_id,action,target_type,target_id,metadata,ip_address,user_agent,error_id,reason,result,created_at",
  ],
  ["admin_roles", "key,label,description,rank,is_system,created_at"],
  [
    "admin_accounts",
    "user_id,username,password_hash,role_key,enabled,must_change_password,failed_attempts,locked_until,last_login_at,password_changed_at",
  ],
  ["admin_permissions", "key,category,label,description,risk,sort_order"],
  ["admin_role_permissions", "role_key,permission_key"],
  ["admin_sessions", "id,admin_user_id,created_at,last_seen_at,expires_at,revoked_at,device_label"],
  ["admin_credential_migrations", "id,legacy_user_id,legacy_email,action,reason,performed_at"],
  [
    "branding_assets",
    "id,slot,label,object_path,public_url,mime_type,byte_size,is_active,version,updated_at",
  ],
  [
    "branding_asset_versions",
    "id,asset_id,version,object_path,public_url,mime_type,byte_size,note,created_at",
  ],
  [
    "animation_configs",
    "id,key,label,category,enabled,animation_type,duration_ms,intensity,delay_ms,easing,updated_at",
  ],
  [
    "theme_settings",
    "id,primary_color,secondary_color,accent_color,background_color,surface_color,text_color,updated_at",
  ],
  [
    "system_notifications",
    "id,title,message,priority,audience,audience_account_types,audience_role_keys,starts_at,ends_at,sent_at,recipient_count,created_at",
  ],
  ["system_notification_receipts", "notification_id,profile_id,delivered_at,read_at"],
  [
    "platform_settings",
    "id,registration_enabled,posting_enabled,comments_enabled,uploads_enabled,updated_at",
  ],
  ["email_template_configs", "key,label,subject,heading,enabled,version,updated_at"],
  ["email_template_versions", "id,template_key,version,subject,heading,created_at"],
  [
    "app_routes",
    "path,label,route_group,description,enabled,requires_auth,is_public_page,updated_at",
  ],
]) {
  await check(`Protected database contract ${table}`, `/rest/v1/${table}`, {
    fields,
    allowStatus: [200, 401, 403],
  });
}

await check("Public active advertisement contract", "/rest/v1/advertisements", {
  fields: "id,title,body,image_url,target_url,placement,status,priority",
});
// These are intentionally public-read surfaces. A stale combined-role RLS
// policy can still fail anonymous reads on private `follows` even when a
// separate public policy exists, so verify the actual anon query succeeds.
await check("Anonymous can read public reels", "/rest/v1/reels", {
  fields: "id",
  filters: {
    status: "eq.published",
    moderation_state: "eq.clean",
    is_deleted: "eq.false",
    visibility: "eq.public",
  },
});
await check("Anonymous can read public stories", "/rest/v1/stories", {
  fields: "id",
  filters: {
    status: "eq.active",
    moderation_state: "eq.clean",
    audience: "eq.public",
    expires_at: `gt.${new Date().toISOString()}`,
  },
});
await check("Anonymous advertisement writes are denied", "/rest/v1/advertisements", {
  method: "POST",
  body: { title: "verification-probe", status: "draft" },
  allowStatus: [401, 403],
});

// `motion_publication_events` is the live-invalidation channel the motion
// provider subscribes to. The Edge Function publishes into it with the service
// role, so the browser needs a read grant and nothing else. A missing table, a
// missing anon grant or a missing policy each surface here as a non-200, and an
// accidental anon INSERT grant surfaces as a 2xx on the write probe below.
await check("Anonymous can read motion publication events", "/rest/v1/motion_publication_events", {
  fields: "id",
});
await check(
  "Anonymous cannot write motion publication events",
  "/rest/v1/motion_publication_events",
  {
    method: "POST",
    // `{ id: false }` can never satisfy the `check (id)` sentinel, so if the anon
    // role ever gains INSERT this probe returns 400/23514 and fails loudly. Accept
    // only the privilege errors: anything else means the write reached the table.
    body: { id: false },
    allowStatus: [401, 403],
  },
);

// `site_settings` is the public configuration row the shell reads on mount and
// that it now also subscribes to through `supabase_realtime`. It must stay
// readable by an anonymous visitor, because the signed-out landing page renders
// from it, and it must stay unwritable, because the row carries the site name,
// logo, contact details and maintenance mode.
//
// The update and delete probes are the point of this block. RLS alone already
// denies them, but it denies them *quietly*: an anonymous PATCH matched zero
// rows and answered 204, which reads like success. These assert the privilege
// itself is absent, so a denial is loud (`42501`) and a future policy that
// accidentally allows a write cannot slip through on a 2xx.
await check("Anonymous can read public site settings", "/rest/v1/site_settings", {
  fields: "site_name,maintenance_mode",
});
await check("Anonymous cannot update public site settings", "/rest/v1/site_settings?id=eq.true", {
  method: "PATCH",
  body: { homepage_kicker: "verification-probe" },
  allowStatus: [401, 403],
});
await check("Anonymous cannot delete public site settings", "/rest/v1/site_settings?id=eq.true", {
  method: "DELETE",
  allowStatus: [401, 403],
});
await check("Anonymous cannot insert public site settings", "/rest/v1/site_settings", {
  method: "POST",
  // `id` is the `check (id)` sentinel, so an INSERT that ever reached the table
  // fails on the constraint rather than creating a second settings row. Accept
  // only the privilege errors.
  body: { id: true, site_name: "verification-probe" },
  allowStatus: [401, 403],
});

// Messaging and groups are real now. Each table must exist with RLS enforced and
// must refuse an anonymous reader; `scripts/verify-messaging-security.mjs` runs
// the fuller matrix, including the RPC and storage cases.
const messagingTables = [
  ["conversations", "id,kind,direct_key,title,last_message_at,group_id"],
  ["conversation_participants", "conversation_id,user_id,role,last_read_at"],
  ["messages", "id,conversation_id,sender_id,kind,body,created_at,client_nonce"],
  ["message_attachments", "id,message_id,object_path,media_type,byte_size"],
  ["groups", "id,slug,name,privacy,owner_id,member_count"],
  ["group_members", "group_id,user_id,role,status"],
  ["group_settings", "group_id,join_policy,slow_mode_seconds"],
];
for (const [table, fields] of messagingTables) {
  await check(`Messaging contract ${table}`, `/rest/v1/${table}`, {
    fields,
    allowStatus: [200, 401, 403],
  });
}

await check("Anonymous cannot read administrator credentials", "/rest/v1/admin_accounts", {
  fields: "user_id,username,password_hash",
  allowStatus: [401, 403],
});

const messagingRpcs = [
  ["open_direct_conversation", { p_other_user_id: "00000000-0000-0000-0000-000000000000" }],
  ["mark_conversation_read", { p_conversation_id: "00000000-0000-0000-0000-000000000000" }],
  ["join_group", { p_group_id: "00000000-0000-0000-0000-000000000000" }],
  ["leave_group", { p_group_id: "00000000-0000-0000-0000-000000000000" }],
  [
    "create_group",
    { p_name: "probe", p_slug: "probe-group", p_description: "", p_privacy: "public" },
  ],
  ["accept_group_invite", { p_group_id: "00000000-0000-0000-0000-000000000000" }],
  [
    "invite_group_member",
    {
      p_group_id: "00000000-0000-0000-0000-000000000000",
      p_user_id: "00000000-0000-0000-0000-000000000000",
    },
  ],
  [
    "review_group_member",
    {
      p_group_id: "00000000-0000-0000-0000-000000000000",
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_approve: true,
    },
  ],
  ["conversation_unread_total", {}],
];
for (const [rpc, params] of messagingRpcs) {
  await check(`Messaging RPC ${rpc} denies anonymous execution`, `/rest/v1/rpc/${rpc}`, {
    method: "POST",
    body: params,
    allowStatus: [401, 403],
  });
}

const protectedRpcs = [
  ["admin_bootstrap_claim", {}],
  ["admin_bootstrap_settle", { p_keep: false, p_user_id: null }],
  [
    "admin_set_access_code",
    {
      p_code_hash: "invalid-probe",
      p_iterations: 100000,
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_enabled: true,
    },
  ],
  ["admin_permissions_for_role", { p_role_key: "support" }],
  ["admin_effective_permissions", { p_user_id: "00000000-0000-0000-0000-000000000000" }],
  [
    "admin_dispatch_system_notification",
    { p_notification_id: "00000000-0000-0000-0000-000000000000" },
  ],
  [
    "viewer_is_close_friend",
    {
      p_owner_id: "00000000-0000-0000-0000-000000000000",
      p_viewer_id: "00000000-0000-0000-0000-000000000000",
    },
  ],
  ["admin_user_totals", {}],
  ["admin_user_list", { search: "", page: 1, per_page: 1 }],
  ["admin_user_count", { search: "" }],
  ["admin_table_health", {}],
  ["admin_prune_login_attempts", { older_than_hours: 24 }],
  ["admin_access_code_status", {}],
  [
    "admin_change_password_and_revoke_sessions",
    {
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_password_hash: "invalid-probe",
      p_changed_at: new Date().toISOString(),
    },
  ],
];

for (const [rpc, body] of protectedRpcs) {
  await check(`Admin RPC ${rpc} exists and denies anonymous execution`, `/rest/v1/rpc/${rpc}`, {
    method: "POST",
    body,
    allowStatus: [401, 403],
  });
}

await check(
  "Profile follow-count RPC is public and read-only",
  "/rest/v1/rpc/profile_follow_counts",
  {
    method: "POST",
    body: { target_profile_id: "00000000-0000-0000-0000-000000000000" },
  },
);

await check(
  "Post engagement-count RPC is available to the public feed",
  "/rest/v1/rpc/get_post_engagement_counts",
  { method: "POST", body: { p_post_ids: [] } },
);
await check(
  "Social comment-count RPC denies anonymous execution",
  "/rest/v1/rpc/get_social_comment_counts",
  {
    method: "POST",
    body: { p_post_comment_ids: [], p_reel_comment_ids: [] },
    allowStatus: [401, 403],
  },
);

const publishedMotion = await check(
  "Published motion config RPC",
  "/rest/v1/rpc/get_published_motion_config",
  { method: "POST", body: {} },
);
report(
  "Published motion config has expected shape",
  publishedMotion?.response.ok === true &&
    typeof publishedMotion.payload?.config === "object" &&
    Number.isInteger(publishedMotion.payload?.version) &&
    typeof publishedMotion.payload?.publishedAt === "string",
);

if (serviceHeaders) {
  await check("Current follow schema includes updated_at", "/rest/v1/follows", {
    fields: "follower_id,updated_at",
    requestHeaders: serviceHeaders,
  });
  await check("Database contract post_media", "/rest/v1/post_media", {
    fields: "id,post_id,author_id,object_path,media_type,position,alt_text,created_at",
    requestHeaders: serviceHeaders,
  });
  await check("Database contract post_draft_media", "/rest/v1/post_draft_media", {
    fields: "id,draft_id,author_id,object_path,media_type,position,alt_text,created_at",
    requestHeaders: serviceHeaders,
  });
  await check("Database contract post_drafts", "/rest/v1/post_drafts", {
    fields:
      "id,author_id,body,visibility,allow_comments,allow_likes,hide_like_count,allow_sharing,updated_at",
    requestHeaders: serviceHeaders,
  });
  await check("Database contract follows", "/rest/v1/follows", {
    fields: "follower_id,following_id,status,created_at,updated_at",
    requestHeaders: serviceHeaders,
  });
  for (const [table, fields] of [
    ["content_reports", "id,target_type,target_id,reporter_id,status,created_at"],
    ["cms_pages", "id,title,slug,route,status,updated_at"],
    ["cms_page_versions", "id,page_id,version_label,created_at"],
    ["motion_presets", "id,label,category,description,parameters,enabled,created_at,updated_at"],
    [
      "motion_configuration",
      "id,draft_config,published_config,published_version,published_at,updated_by,updated_at",
    ],
    [
      "motion_versions",
      "id,version,snapshot,change_summary,event,created_by,created_at,published_at",
    ],
    ["navigation_items", "id,label,route,position,visible,feature_flag,navigation_scope"],
    ["feature_flags", "key,enabled,rollout,updated_at"],
    ["system_announcements", "id,title,message,active,starts_at,ends_at"],
    ["admin_error_pages", "code,title,description,enabled,updated_at"],
    [
      "admin_audit_logs",
      "id,admin_user_id,action,target_type,target_id,metadata,ip_address,user_agent,error_id,reason,result,created_at",
    ],
    ["admin_roles", "key,label,description,rank,is_system,created_at"],
    ["admin_permissions", "key,category,label,description,risk,sort_order"],
    ["admin_role_permissions", "role_key,permission_key"],
    [
      "admin_sessions",
      "id,admin_user_id,created_at,last_seen_at,expires_at,revoked_at,device_label",
    ],
    ["admin_credential_migrations", "id,legacy_user_id,legacy_email,action,reason,performed_at"],
    [
      "branding_assets",
      "id,slot,label,object_path,public_url,mime_type,byte_size,is_active,version,updated_at",
    ],
    [
      "branding_asset_versions",
      "id,asset_id,version,object_path,public_url,mime_type,byte_size,note,created_at",
    ],
    [
      "animation_configs",
      "id,key,label,category,enabled,animation_type,duration_ms,intensity,delay_ms,easing,updated_at",
    ],
    [
      "theme_settings",
      "id,primary_color,secondary_color,accent_color,background_color,surface_color,text_color,updated_at",
    ],
    [
      "advertisements",
      "id,title,body,image_url,target_url,placement,status,priority,starts_at,ends_at,updated_at",
    ],
    [
      "system_notifications",
      "id,title,message,priority,audience,audience_account_types,audience_role_keys,starts_at,ends_at,sent_at,recipient_count,created_at",
    ],
    ["system_notification_receipts", "notification_id,profile_id,delivered_at,read_at"],
    [
      "platform_settings",
      "id,registration_enabled,posting_enabled,comments_enabled,uploads_enabled,updated_at",
    ],
    ["email_template_configs", "key,label,subject,heading,enabled,version,updated_at"],
    ["email_template_versions", "id,template_key,version,subject,heading,created_at"],
    [
      "app_routes",
      "path,label,route_group,description,enabled,requires_auth,is_public_page,updated_at",
    ],
  ]) {
    await check(`Database contract ${table}`, `/rest/v1/${table}`, {
      fields,
      requestHeaders: serviceHeaders,
    });
  }
  await check("Database contract reserved_usernames", "/rest/v1/reserved_usernames", {
    fields: "username,reason",
    requestHeaders: serviceHeaders,
  });
  await check("Database contract admin_bootstrap_claims", "/rest/v1/admin_bootstrap_claims", {
    fields: "id,claimed_at,finalized_user_id",
    requestHeaders: serviceHeaders,
  });
  await check("Database contract admin_access_code", "/rest/v1/admin_access_code", {
    fields: "id,code_hash,iterations,enabled,rotated_at,rotated_by",
    requestHeaders: serviceHeaders,
  });
  await check("Service role can read admin_accounts schema", "/rest/v1/admin_accounts", {
    fields: "user_id,username,password_hash,role_key,enabled,must_change_password",
    requestHeaders: serviceHeaders,
  });
  await check("Message attachments and sender relationship", "/rest/v1/messages", {
    fields:
      "id,conversation_id,sender_id,body,kind,created_at,profiles!messages_sender_id_fkey(username,display_name),message_attachments(id,object_path,media_type,mime_type,byte_size,alt_text)",
    requestHeaders: serviceHeaders,
  });
  await check("Group roster profile relationship", "/rest/v1/group_members", {
    fields:
      "user_id,role,status,joined_at,profiles!group_members_user_id_fkey(username,display_name,avatar_url)",
    requestHeaders: serviceHeaders,
  });

  // The visual animation library writes uploaded media onto these three columns.
  // PostgREST rejects an unknown column with PGRST204, so selecting them is a
  // real existence assertion rather than a restatement of the migration file.
  await check("Animation library media columns exist", "/rest/v1/animation_configs", {
    fields: "id,key,media_url,media_mime_type,media_byte_size",
    requestHeaders: serviceHeaders,
  });

  // `startup_intro` and `error_artwork` are the two library slots the admin
  // console and the page-experience runtime both depend on. A preset silently
  // missing from a wiped or partially replayed catalog is a runtime failure, so
  // assert the rows rather than trusting the seed migration.
  for (const preset of ["startup_intro", "error_artwork"]) {
    const found = await check(
      `Animation library preset ${preset} exists`,
      "/rest/v1/animation_configs",
      {
        filters: { key: `eq.${preset}`, select: "id,key,category", limit: "1" },
        requestHeaders: serviceHeaders,
      },
    );
    // A 200 with an empty array is not the same as the preset being present, so
    // re-report against the row count. The check above already recorded the
    // transport result; this line is the assertion the plan actually asks for.
    const rows = Array.isArray(found?.payload) ? found.payload : [];
    if (found?.response.ok) {
      report(`Animation library preset ${preset} is present`, rows.length === 1);
    }
  }

  // Prove the byte-size ceiling is installed by attempting to breach it. The
  // check constraint rejects the row, so this assertion cannot leave state
  // behind; a 400/23514 is the pass, a 2xx means the ceiling is missing and the
  // oversized object was really written.
  await check(
    "Animation library rejects an oversized media_byte_size",
    "/rest/v1/animation_configs",
    {
      method: "PATCH",
      body: { media_byte_size: 10485761 },
      filters: { key: "eq.error_artwork" },
      allowStatus: [400],
      requestHeaders: serviceHeaders,
    },
  );
} else {
  report(
    "Database contract private admin tables",
    false,
    "service-role verification key unavailable",
  );
}

if (serviceRoleKey) {
  for (const [bucket, publicBucket] of [
    ["site-assets", true],
    ["profile-avatars", true],
    ["post-media", false],
    ["story-media", false],
    ["reel-media", false],
    ["message-media", false],
    ["group-media", false],
  ]) {
    const url = `${baseUrl}/storage/v1/bucket/${bucket}`;
    try {
      const response = await fetch(url, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        signal: AbortSignal.timeout(15000),
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      const ok = response.ok && payload?.id === bucket && payload?.public === publicBucket;
      report(
        `${publicBucket ? "Public" : "Private"} ${bucket} bucket`,
        ok,
        `HTTP ${response.status}`,
      );
    } catch (error) {
      report(
        `${publicBucket ? "Public" : "Private"} ${bucket} bucket`,
        false,
        error instanceof Error ? error.name : "request failed",
      );
    }
  }
} else {
  report(
    "Public storage buckets",
    false,
    "VELORI_SUPABASE_SECRET_KEY unavailable for protected read-only verification",
  );
}

const health = await check("server Edge Function", "/functions/v1/server/health");
if (health?.response.ok) {
  report("Edge Function server configuration", health.payload?.configured === true);
  report("Edge Function origin allowlist", health.payload?.originsConfigured === true);
  report(
    "Expired media cleanup token configuration",
    health.payload?.mediaCleanupConfigured === true,
  );
}
await check(
  "media cleanup rejects callers without its scheduler token",
  "/functions/v1/server/_internal/storage-cleanup",
  { method: "POST", body: {}, allowStatus: [401] },
);

await check(
  "Admin login reaches request validation without credentials",
  "/functions/v1/server/admin/login",
  {
    method: "POST",
    body: {},
    allowStatus: [400],
  },
);
await check(
  "Admin API rejects requests without an admin session",
  "/functions/v1/server/admin/me",
  {
    allowStatus: [401],
  },
);

const configuredOriginList = (configuredOrigins ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigin = configuredOriginList[0];
if (allowedOrigin) {
  const preflightHeaders = {
    Origin: allowedOrigin,
    "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Headers": "authorization, apikey",
  };
  const preflight = await check(
    "CORS preflight for configured origin",
    "/functions/v1/server/admin/me",
    {
      method: "OPTIONS",
      requestHeaders: { ...headers, ...preflightHeaders },
      allowStatus: [200, 204],
    },
  );
  report(
    "CORS echoes exact configured origin",
    preflight?.response.headers.get("access-control-allow-origin") === allowedOrigin,
  );
  // Regression guard for credentialed HttpOnly-cookie requests plus the
  // per-tab bearer fallback used when browsers block cross-origin cookies.
  const consolePreflight = await check(
    "CORS preflight for the administrator session",
    "/functions/v1/server/admin/me",
    {
      method: "OPTIONS",
      requestHeaders: {
        ...headers,
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization, apikey, content-type",
      },
      allowStatus: [200, 204],
    },
  );
  const allowedHeaders = (
    consolePreflight?.response.headers.get("access-control-allow-headers") ?? ""
  ).toLowerCase();
  report(
    "CORS allows the admin bearer fallback",
    allowedHeaders.split(",").some((entry) => entry.trim() === "authorization"),
  );
  report(
    "CORS allows credentialed admin cookies",
    consolePreflight?.response.headers.get("access-control-allow-credentials") === "true",
  );
  const unknownOriginResponse = await fetch(`${baseUrl}/functions/v1/server/admin/me`, {
    method: "OPTIONS",
    headers: {
      ...headers,
      Origin: "https://untrusted.invalid",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "authorization, apikey",
    },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  report(
    "CORS rejects unknown origin",
    Boolean(unknownOriginResponse) &&
      unknownOriginResponse.headers.get("access-control-allow-origin") !== "*" &&
      unknownOriginResponse.headers.get("access-control-allow-origin") !==
        "https://untrusted.invalid",
  );
  for (const localOrigin of ["http://localhost:8443", "http://127.0.0.1:8443"]) {
    const localPreflight = await fetch(`${baseUrl}/functions/v1/server/admin/login`, {
      method: "OPTIONS",
      headers: {
        ...headers,
        Origin: localOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "apikey,content-type",
      },
      signal: AbortSignal.timeout(15000),
    }).catch(() => null);
    report(
      `CORS allows local Vite origin ${localOrigin}`,
      Boolean(localPreflight) &&
        [200, 204].includes(localPreflight.status) &&
        localPreflight.headers.get("access-control-allow-origin") === localOrigin,
    );
  }
} else {
  report("CORS preflight", false, "VELORI_ALLOWED_ORIGINS is unavailable");
}

await check("Auth settings endpoint", "/auth/v1/settings");

if (failures.length) {
  console.error(`Supabase verification failed: ${failures.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Supabase schema and endpoint verification completed.");
}
