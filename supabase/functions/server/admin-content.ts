// VELORI administrator console API — the content and configuration surface:
// CMS pages and versions, the route registry, navigation, branding assets, motion,
// theme, error pages, announcements, targeted notifications, advertisements,
// feature flags, platform settings, administrators, roles and email templates.
//
// Authorization notes that apply to this whole file:
//  - No handler trusts a role, permission or boolean supplied by the browser.
//    Route-level guards in index.tsx decide reachability; handlers re-check the
//    specific permission an action needs when one route covers several actions.
//  - Every mutation writes an audit row with a reason, because these records are
//    what an operator relies on to answer "who changed the homepage, and why".

import {
  ADMIN_ROLE_KEYS,
  MAX_ANIMATION_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  SUPABASE_URL,
  deviceLabel,
  isUuid,
  readBoolean,
  readEnum,
  readInteger,
  readJson,
  readSecret,
  readString,
  referenceId,
  requireRecentReauth,
  service,
  writeAudit,
  type AdminRoleKey,
  type Ctx,
} from "./admin-core.ts";
import {
  adminIdentityEmail,
  hashPassword,
  isValidNewPassword,
  isValidUsername,
  normalizeUsername,
} from "./admin-password.mjs";
import { DEFAULT_MOTION_CONFIG, normalizeMotionConfig } from "../_shared/motion-config.mjs";
import {
  NOTIFICATION_AUDIENCES,
  validateCampaignAudience,
  validateCampaignWindow,
} from "./notification-campaign.ts";
import {
  MAX_PAGE_CSS_LENGTH,
  MAX_PAGE_HTML_LENGTH,
  MAX_PAGE_JS_LENGTH,
  htmlEditorEmbedsError,
  sanitizeCustomHtml,
  validateCustomCss,
  validateCustomJs,
} from "./cms-html.ts";
import {
  MAX_SVG_ILLUSTRATION_BYTES,
  decodeSvgText,
  inspectSvgIllustration,
} from "./svg-illustration.mjs";
import { PAGE_CONTENT_MODES, validatePageContentBlocks } from "./cms-blocks.ts";
import {
  apkPromotionMutationError,
  isApkOnlyAnnouncementName,
} from "../../../src/lib/apk-promotion-admin.mjs";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function paginate(c: Ctx) {
  const page = Math.min(Math.max(Number.parseInt(c.req.query("page") ?? "1", 10) || 1, 1), 5000);
  const perPage = Math.min(
    Math.max(Number.parseInt(c.req.query("perPage") ?? "25", 10) || 25, 1),
    100,
  );
  return { page, perPage };
}

/** Public URL for an object in the `site-assets` bucket. Matches the URL shape the
 * existing asset handler in index.tsx already stores, so old and new rows render
 * identically. */
function publicAssetUrl(objectPath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/site-assets/${objectPath}`;
}

// ---------------------------------------------------------------------------
// CMS pages
// ---------------------------------------------------------------------------

const PAGE_STATUSES = ["draft", "published", "scheduled", "disabled"] as const;

export const handleCmsPagesList = async (c: Ctx) => {
  const { page, perPage } = paginate(c);
  const status = readEnum({ status: c.req.query("status") ?? "" }, "status", PAGE_STATUSES);
  const query = (c.req.query("query") ?? "").trim().slice(0, 120);

  let request = service()
    .from("cms_pages")
    .select("*,cms_page_versions(count)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (status) request = request.eq("status", status);
  if (query) {
    const escaped = query.replace(/[%,()]/g, (match) => `%${match}`);
    request = request.or(`title.ilike.%${escaped}%,route.ilike.%${escaped}%`);
  }

  const { data, error, count } = await request;
  if (error) return c.json({ error: "CMS pages could not be read." }, 500);
  return c.json({ pages: data ?? [], total: count ?? 0, page, perPage });
};

export const handleCmsPageGet = async (c: Ctx) => {
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That page id is not valid." }, 400);
  const { data, error } = await service().from("cms_pages").select("*").eq("id", id).maybeSingle();
  if (error || !data) return c.json({ error: "That page was not found." }, 404);
  return c.json({ page: data });
};

function pageFieldsFrom(source: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  const title = readString(source, "title", 121);
  const slug = readString(source, "slug", 121);
  const route = readString(source, "route", 181);
  const content = readString(source, "content", 60_000);
  const seoTitle = readString(source, "seo_title", 201);
  const seoDescription = readString(source, "seo_description", 401);
  const ogTitle = readString(source, "og_title", 201);
  const ogDescription = readString(source, "og_description", 401);
  const ogImage = readString(source, "og_image", 2049);
  const heroImage = readString(source, "hero_image", 2049);
  const customHtml = readString(source, "custom_html", MAX_PAGE_HTML_LENGTH);
  const customCss = readString(source, "custom_css", MAX_PAGE_CSS_LENGTH);
  const customJs = readString(source, "custom_js", MAX_PAGE_JS_LENGTH);
  const contentMode = readEnum(source, "content_mode", PAGE_CONTENT_MODES);
  const contentBlocks = "content_blocks" in source ? source.content_blocks : undefined;
  const footerEnabled = readBoolean(source, "footer_enabled");
  const animationEnabled = readBoolean(source, "animation_enabled");

  if (
    title === null ||
    slug === null ||
    route === null ||
    content === null ||
    seoTitle === null ||
    seoDescription === null ||
    ogTitle === null ||
    ogDescription === null ||
    ogImage === null ||
    heroImage === null ||
    customHtml === null ||
    customCss === null ||
    customJs === null ||
    contentMode === null ||
    footerEnabled === null ||
    animationEnabled === null
  ) {
    return { error: "Page fields must be the expected type." as const };
  }
  if (typeof customHtml === "string" && customHtml.length > MAX_PAGE_HTML_LENGTH) {
    return {
      error:
        `Custom HTML must be ${MAX_PAGE_HTML_LENGTH.toLocaleString()} characters or fewer.` as const,
    };
  }
  if (typeof customHtml === "string") {
    const htmlError = htmlEditorEmbedsError(customHtml);
    if (htmlError) return { error: htmlError };
  }
  if (typeof customCss === "string") {
    const cssError = validateCustomCss(customCss);
    if (cssError) return { error: cssError };
  }
  if (typeof customJs === "string") {
    const jsError = validateCustomJs(customJs);
    if (jsError) return { error: jsError };
  }
  let validatedBlocks: ReturnType<typeof validatePageContentBlocks> | undefined;
  if (contentBlocks !== undefined) {
    validatedBlocks = validatePageContentBlocks(contentBlocks);
    if ("error" in validatedBlocks) return { error: validatedBlocks.error };
  }

  if (title !== undefined) updates.title = title;
  if (slug !== undefined) updates.slug = slugify(slug) || slug;
  if (route !== undefined) updates.route = route.startsWith("/") ? route : `/${route}`;
  if (content !== undefined) updates.content = content;
  if (seoTitle !== undefined) updates.seo_title = seoTitle;
  if (seoDescription !== undefined) updates.seo_description = seoDescription;
  if (ogTitle !== undefined) updates.og_title = ogTitle;
  if (ogDescription !== undefined) updates.og_description = ogDescription;
  if (ogImage !== undefined) updates.og_image = ogImage;
  if (heroImage !== undefined) updates.hero_image = heroImage;
  if (customHtml !== undefined) updates.custom_html = sanitizeCustomHtml(customHtml);
  if (customCss !== undefined) updates.custom_css = customCss;
  if (customJs !== undefined) updates.custom_js = customJs;
  if (contentMode !== undefined) updates.content_mode = contentMode;
  if (validatedBlocks && "blocks" in validatedBlocks)
    updates.content_blocks = validatedBlocks.blocks;
  if (footerEnabled !== undefined) updates.footer_enabled = footerEnabled;
  if (animationEnabled !== undefined) updates.animation_enabled = animationEnabled;

  return { updates };
}

/** Snapshots the current page state so a bad edit can be rolled back. */
async function snapshotPage(pageId: string, label: string, userId: string): Promise<void> {
  const db = service();
  const { data: page } = await db.from("cms_pages").select("*").eq("id", pageId).maybeSingle();
  if (!page) return;
  const { count } = await db
    .from("cms_page_versions")
    .select("id", { count: "exact", head: true })
    .eq("page_id", pageId);
  const version = (count ?? 0) + 1;
  await db.from("cms_page_versions").insert({
    page_id: pageId,
    version_label: `v${version}`,
    title: page.title,
    slug: page.slug,
    route: page.route,
    content: page.content,
    seo_title: page.seo_title,
    seo_description: page.seo_description,
    og_title: page.og_title,
    og_description: page.og_description,
    og_image: page.og_image,
    hero_image: page.hero_image,
    custom_html: page.custom_html ?? "",
    custom_css: page.custom_css ?? "",
    custom_js: page.custom_js ?? "",
    content_blocks: page.content_blocks ?? [],
    content_mode: page.content_mode ?? "visual",
    footer_enabled: page.footer_enabled,
    animation_enabled: page.animation_enabled,
    created_by: userId,
  });
  void label;
}

export const handleCmsPageCreate = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const title = readString(body.value, "title", 121);
  const route = readString(body.value, "route", 181);
  if (title === null || route === null) {
    return c.json({ error: "Those fields must be the expected type." }, 400);
  }
  const finalTitle = (title ?? "").trim();
  const finalRoute = (route ?? "").trim();
  if (finalTitle.length < 1 || finalTitle.length > 120) {
    return c.json({ error: "Title must be between 1 and 120 characters." }, 400);
  }
  if (!finalRoute.startsWith("/") || finalRoute.length > 180) {
    return c.json({ error: "Route must start with / and be 180 characters or fewer." }, 400);
  }

  const fields = pageFieldsFrom(body.value);
  if ("error" in fields) return c.json({ error: fields.error }, 400);

  const slug = (fields.updates.slug as string | undefined) ?? slugify(finalTitle);
  const { data, error } = await service()
    .from("cms_pages")
    .insert({
      ...fields.updates,
      title: finalTitle,
      slug,
      route: finalRoute,
      // Always created as a draft. Publishing is a separate, audited action, so a
      // page can never reach the public site by being saved.
      status: "draft",
      draft_content: fields.updates,
      draft_updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    return c.json(
      {
        error: "The page could not be created. The slug or route is probably already in use.",
      },
      409,
    );
  }
  await snapshotPage(data.id, "created", user.id);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.cms.page_created",
    targetType: "cms_page",
    targetId: data.id,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { title: finalTitle, route: finalRoute },
  });
  return c.json({ created: true, page: data });
};

export const handleCmsPagePatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That page id is not valid." }, 400);

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const status = readEnum(body.value, "status", PAGE_STATUSES);
  if (status === null) {
    return c.json({ error: `Status must be one of: ${PAGE_STATUSES.join(", ")}.` }, 400);
  }
  if (status !== undefined) {
    return c.json(
      { error: "Page status changes use the dedicated publish or disable action." },
      400,
    );
  }
  const fields = pageFieldsFrom(body.value);
  if ("error" in fields) return c.json({ error: fields.error }, 400);

  if (Object.keys(fields.updates).length === 0) {
    return c.json({ error: "No recognised page fields were supplied." }, 400);
  }

  const db = service();
  const { data: current, error: readError } = await db
    .from("cms_pages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) return c.json({ error: "The page could not be read before saving." }, 500);
  if (!current) return c.json({ error: "That page was not found." }, 404);

  // Page edits are staged in draft_content. The canonical columns remain the
  // published snapshot consumed by public routes, including while a live page
  // has pending edits.
  const draft = {
    title: current.title,
    slug: current.slug,
    route: current.route,
    content: current.content,
    seo_title: current.seo_title ?? "",
    seo_description: current.seo_description ?? "",
    og_title: current.og_title ?? "",
    og_description: current.og_description ?? "",
    og_image: current.og_image ?? "",
    hero_image: current.hero_image ?? "",
    custom_html: current.custom_html ?? "",
    custom_css: current.custom_css ?? "",
    custom_js: current.custom_js ?? "",
    content_blocks: current.content_blocks ?? [],
    content_mode: current.content_mode ?? "visual",
    footer_enabled: current.footer_enabled ?? true,
    animation_enabled: current.animation_enabled ?? true,
    ...(current.draft_content && typeof current.draft_content === "object"
      ? current.draft_content
      : {}),
    ...fields.updates,
  };

  const { data, error } = await db
    .from("cms_pages")
    .update({
      draft_content: draft,
      draft_updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    return c.json({ error: "The page could not be saved." }, 500);
  }
  if (!data) return c.json({ error: "That page was not found." }, 404);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.cms.page_draft_saved",
    targetType: "cms_page",
    targetId: id,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { fields: Object.keys(fields.updates), route: draft.route },
  });
  return c.json({ updated: true, page: data });
};

export const handleCmsPagePublish = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That page id is not valid." }, 400);

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const summary = readString(body.value, "summary", 501);
  if (summary === null) return c.json({ error: "Change summary must be text." }, 400);
  const expectedDraftUpdatedAt = body.value.expected_draft_updated_at;
  if (
    expectedDraftUpdatedAt !== undefined &&
    expectedDraftUpdatedAt !== null &&
    typeof expectedDraftUpdatedAt !== "string"
  ) {
    return c.json(
      { error: "The draft version is invalid. Reload the page before publishing." },
      400,
    );
  }

  const db = service();
  const { data: current, error: readError } = await db
    .from("cms_pages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) return c.json({ error: "The page could not be read before publishing." }, 500);
  if (!current) return c.json({ error: "That page was not found." }, 404);
  if (expectedDraftUpdatedAt !== undefined && expectedDraftUpdatedAt !== current.draft_updated_at) {
    return c.json(
      {
        error:
          "This page has been updated since you opened it. Reload the latest draft before publishing.",
        code: "cms_publish_conflict",
      },
      409,
    );
  }

  const source =
    current.draft_content && typeof current.draft_content === "object"
      ? (current.draft_content as Record<string, unknown>)
      : {
          title: current.title,
          slug: current.slug,
          route: current.route,
          content: current.content,
          seo_title: current.seo_title ?? "",
          seo_description: current.seo_description ?? "",
          og_title: current.og_title ?? "",
          og_description: current.og_description ?? "",
          og_image: current.og_image ?? "",
          hero_image: current.hero_image ?? "",
          custom_html: current.custom_html ?? "",
          custom_css: current.custom_css ?? "",
          custom_js: current.custom_js ?? "",
          content_blocks: current.content_blocks ?? [],
          content_mode: current.content_mode ?? "visual",
          footer_enabled: current.footer_enabled ?? true,
          animation_enabled: current.animation_enabled ?? true,
        };
  const fields = pageFieldsFrom(source);
  if ("error" in fields) return c.json({ error: fields.error }, 400);
  const title = String(fields.updates.title ?? "").trim();
  const slug = String(fields.updates.slug ?? "").trim();
  const route = String(fields.updates.route ?? "").trim();
  if (!title || !slug || !route.startsWith("/") || route.length > 180) {
    return c.json({ error: "Add a valid title, slug, and route before publishing." }, 400);
  }
  if (route.includes("?") || route.includes("#") || route.includes("..")) {
    return c.json(
      { error: "The page route cannot contain a query, fragment, or parent path." },
      400,
    );
  }

  const { data, error } = await db.rpc("publish_cms_page", {
    p_page_id: id,
    p_fields: { ...fields.updates, title, slug, route },
    p_publisher_id: user.id,
    p_expected_draft_updated_at: current.draft_updated_at ?? null,
  });
  if (error) {
    if (error.code === "P0002") return c.json({ error: "That page was not found." }, 404);
    if (error.code === "40001") {
      return c.json(
        {
          error:
            "This page has been updated since you opened it. Reload the latest draft before publishing.",
          code: "cms_publish_conflict",
        },
        409,
      );
    }
    if (error.code === "23505") {
      return c.json(
        { error: "The page could not be published because its slug or route is already in use." },
        409,
      );
    }
    console.error("CMS publish transaction failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      pageId: id,
    });
    return c.json({ error: "The page could not be published. Its draft is still saved." }, 500);
  }
  if (!data)
    return c.json({ error: "The page could not be published. Its draft is still saved." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.cms.page_published",
    targetType: "cms_page",
    targetId: id,
    reason: summary ?? "Published page draft",
    metadata: {
      route,
      publishedAt: data.published_at,
      version: data.published_version,
      publisherId: user.id,
    },
  });
  return c.json({ published: true, version: data.published_version, page: data });
};

export const handleCmsPageDelete = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That page id is not valid." }, 400);
  const blocked = await requireRecentReauth(c, 10);
  if (blocked) return blocked;

  const body = await readJson(c.req.raw).catch(() => ({ ok: false as const, error: "" }));
  const reason = body.ok ? (readString(body.value, "reason", 2001) ?? "") : "";
  if (reason.trim().length < 4) {
    return c.json({ error: "A short reason is required to delete a page." }, 400);
  }

  const { data: page } = await service()
    .from("cms_pages")
    .select("id,title,route")
    .eq("id", id)
    .maybeSingle();
  if (!page) return c.json({ error: "That page was not found." }, 404);

  // Soft delete: the row is disabled rather than removed, so the route registry
  // and the audit trail keep referring to something real and Restore can bring it
  // back with its content intact.
  const { error } = await service()
    .from("cms_pages")
    .update({ status: "disabled", updated_by: user.id })
    .eq("id", id);
  if (error) return c.json({ error: "The page could not be deleted." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.cms.page_deleted",
    targetType: "cms_page",
    targetId: id,
    reason,
    metadata: { title: page.title, route: page.route, softDelete: true },
  });
  return c.json({ deleted: true, restoreHint: "Set the page status back to draft to restore it." });
};

export const handleCmsPageDuplicate = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That page id is not valid." }, 400);

  const { data: source } = await service().from("cms_pages").select("*").eq("id", id).maybeSingle();
  if (!source) return c.json({ error: "That page was not found." }, 404);

  const stamp = Date.now().toString(36);
  // Explicit allowlist rather than spreading the row: identity, audit and timestamp
  // columns must come from their defaults, and `id: undefined` only works because
  // PostgREST happens to drop it during JSON encoding.
  const { data, error } = await service()
    .from("cms_pages")
    .insert({
      title: `${String(source.title).slice(0, 100)} (copy)`,
      slug: `${source.slug}-${stamp}`.slice(0, 120),
      route: `${source.route}-${stamp}`.slice(0, 180),
      status: "draft",
      content: source.content ?? "",
      seo_title: source.seo_title ?? "",
      seo_description: source.seo_description ?? "",
      og_title: source.og_title ?? "",
      og_description: source.og_description ?? "",
      og_image: source.og_image ?? "",
      hero_image: source.hero_image ?? "",
      custom_html: source.custom_html ?? "",
      custom_css: source.custom_css ?? "",
      custom_js: source.custom_js ?? "",
      content_blocks: source.content_blocks ?? [],
      content_mode: source.content_mode ?? "visual",
      footer_enabled: source.footer_enabled ?? true,
      animation_enabled: source.animation_enabled ?? true,
      published_at: null,
      updated_by: user.id,
    })
    .select("*")
    .single();
  if (error) return c.json({ error: "The page could not be duplicated." }, 500);

  await snapshotPage(data.id, "duplicated", user.id);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.cms.page_duplicated",
    targetType: "cms_page",
    targetId: data.id,
    metadata: { sourceId: id },
  });
  return c.json({ created: true, page: data });
};

export const handleCmsVersionsList = async (c: Ctx) => {
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That page id is not valid." }, 400);
  const { data, error } = await service()
    .from("cms_page_versions")
    .select("*")
    .eq("page_id", id)
    .order("version_label", { ascending: false });
  if (error) return c.json({ error: "Page versions could not be read." }, 500);
  return c.json({ versions: data ?? [] });
};

export const handleCmsVersionRestore = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  const label = c.req.param("version");
  if (!isUuid(id)) return c.json({ error: "That page id is not valid." }, 400);

  const { data: version } = await service()
    .from("cms_page_versions")
    .select("*")
    .eq("page_id", id)
    .eq("version_label", label)
    .maybeSingle();
  if (!version) return c.json({ error: "That version was not found." }, 404);

  // Snapshot the live page first, so restoring is itself reversible.
  await snapshotPage(id, "before_restore", user.id);

  const { data, error } = await service()
    .from("cms_pages")
    .update({
      draft_content: {
        title: version.title,
        slug: version.slug,
        route: version.route,
        content: version.content,
        seo_title: version.seo_title,
        seo_description: version.seo_description,
        og_title: version.og_title,
        og_description: version.og_description,
        og_image: version.og_image,
        hero_image: version.hero_image,
        custom_html: version.custom_html ?? "",
        custom_css: version.custom_css ?? "",
        custom_js: version.custom_js ?? "",
        content_blocks: version.content_blocks ?? [],
        content_mode: version.content_mode ?? "visual",
        footer_enabled: version.footer_enabled,
        animation_enabled: version.animation_enabled,
      },
      draft_updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return c.json({ error: "That version could not be restored." }, 500);
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.cms.version_restored",
    targetType: "cms_page",
    targetId: id,
    reason: `restored ${label}`,
    metadata: { version: label },
  });
  // Restored content always lands in draft while the current public snapshot stays live.
  return c.json({ restored: true, page: data });
};

// ---------------------------------------------------------------------------
// Route registry
// ---------------------------------------------------------------------------

const ROUTE_GROUPS = [
  "admin",
  "feed",
  "content",
  "profile",
  "settings",
  "auth",
  "legal",
  "pending",
  "utility",
  "other",
] as const;

export const handleRoutesList = async (c: Ctx) => {
  const { page, perPage } = paginate(c);
  const group = c.req.query("group") ?? "";
  const query = (c.req.query("query") ?? "").trim().slice(0, 120);

  let request = service()
    .from("app_routes")
    .select("*", { count: "exact" })
    .order("route_group")
    .order("path")
    .range((page - 1) * perPage, page * perPage - 1);

  if (group && (ROUTE_GROUPS as readonly string[]).includes(group)) {
    request = request.eq("route_group", group);
  }
  if (query) {
    const escaped = query.replace(/[%,()]/g, (match) => `%${match}`);
    request = request.or(`path.ilike.%${escaped}%,label.ilike.%${escaped}%`);
  }

  const { data, error, count } = await request;
  if (error) {
    return c.json(
      {
        error:
          "The route registry could not be read. Apply supabase/migrations/20261014000000_velori_admin_console.sql.",
      },
      500,
    );
  }
  return c.json({ routes: data ?? [], total: count ?? 0, page, perPage });
};

export const handleRoutePatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const path = c.req.param("path") ?? "";
  if (!path) return c.json({ error: "That route was not found." }, 404);

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const label = readString(body.value, "label", 81);
  const description = readString(body.value, "description", 301);
  const metaTitle = readString(body.value, "meta_title", 201);
  const metaDescription = readString(body.value, "meta_description", 401);
  const enabled = readBoolean(body.value, "enabled");
  const maintenanceOverride = readBoolean(body.value, "maintenance_override");

  if (
    label === null ||
    description === null ||
    metaTitle === null ||
    metaDescription === null ||
    enabled === null ||
    maintenanceOverride === null
  ) {
    return c.json({ error: "Route fields must be the expected type." }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (label !== undefined) {
    if (label.length < 1) return c.json({ error: "Label cannot be empty." }, 400);
    updates.label = label;
  }
  if (description !== undefined) updates.description = description;
  if (metaTitle !== undefined) updates.meta_title = metaTitle;
  if (metaDescription !== undefined) updates.meta_description = metaDescription;
  if (maintenanceOverride !== undefined) {
    updates.maintenance_override = maintenanceOverride;
  }
  if (enabled !== undefined) {
    if (!enabled && isProtectedRoute(path)) {
      return c.json(
        {
          error:
            "This route is required for the platform to stay reachable and cannot be disabled.",
        },
        409,
      );
    }
    updates.enabled = enabled;
  }
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No recognised route fields were supplied." }, 400);
  }

  const { data, error } = await service()
    .from("app_routes")
    .update({ ...updates, updated_by: user.id })
    .eq("path", path)
    .select("*")
    .maybeSingle();
  if (error) return c.json({ error: "The route could not be saved." }, 500);
  if (!data) return c.json({ error: "That route was not found." }, 404);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.route.updated",
    targetType: "app_route",
    targetId: path,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { fields: Object.keys(updates) },
  });
  return c.json({ updated: true, route: data });
};

/** Routes that must never be switched off: the sign-in path, the console entry
 * and the two console routes an administrator needs to undo the change. */
const PROTECTED_ROUTES = new Set([
  "/admin",
  "/admin/login",
  "/admin/dashboard",
  "/admin/settings",
  "/admin/security",
  "/login",
  "/signup",
]);

function isProtectedRoute(path: string): boolean {
  return PROTECTED_ROUTES.has(path);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const NAV_REQUIRED_ROLES = [
  "all",
  "admin",
  "super_admin",
  "moderator",
  "content_manager",
  "support",
] as const;

const NAV_SCOPES = ["public", "admin"] as const;

// Migration 20261016000000 split the single navigation table into a public scope
// and an administrator scope, and the public row-level policies only expose
// `navigation_scope = 'public'`. Before that migration the column does not exist,
// so it is probed once and every write below simply omits it when it is absent.
let navigationScopeColumn: Promise<boolean> | null = null;

function hasNavigationScope(): Promise<boolean> {
  if (!navigationScopeColumn) {
    navigationScopeColumn = (async () => {
      const { error } = await service()
        .from("navigation_items")
        .select("navigation_scope")
        .limit(1);
      return error === null;
    })();
  }
  return navigationScopeColumn;
}

export const handleNavigationList = async (c: Ctx) => {
  const scoped = await hasNavigationScope();
  const requested = c.req.query("scope");
  const scope =
    requested === undefined ? "public" : NAV_SCOPES.find((value) => value === requested);
  if (requested && !scope) {
    return c.json({ error: "Choose a valid navigation scope." }, 400);
  }

  let request = service().from("navigation_items").select("*");
  if (scoped && scope) request = request.eq("navigation_scope", scope);
  else if (!scoped && scope === "admin") {
    return c.json({ error: "Administrator navigation scopes are not installed yet." }, 409);
  }
  const { data, error } = await request.order("position");
  if (error) return c.json({ error: "Navigation could not be read." }, 500);
  return c.json({
    items: data ?? [],
    navigation: data ?? [],
    // Tells the screen whether the scope control is meaningful, instead of letting
    // it offer a filter the database cannot honour.
    scopes: scoped ? NAV_SCOPES : [],
  });
};

export const handleNavigationCreate = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const label = readString(body.value, "label", 81);
  const route = readString(body.value, "route", 181);
  const icon = readString(body.value, "icon", 61);
  const requiredRole = readEnum(body.value, "required_role", NAV_REQUIRED_ROLES);
  const featureFlag = readString(body.value, "feature_flag", 41);
  const position = readInteger(body.value, "position", 0, 9999);
  const visible = readBoolean(body.value, "visible");
  const desktopVisible = readBoolean(body.value, "desktop_visible");
  const mobileVisible = readBoolean(body.value, "mobile_visible");
  const scope = readEnum(body.value, "navigation_scope", NAV_SCOPES);

  if (
    label === null ||
    route === null ||
    icon === null ||
    requiredRole === null ||
    featureFlag === null ||
    position === null ||
    visible === null ||
    desktopVisible === null ||
    mobileVisible === null ||
    scope === null
  ) {
    return c.json({ error: "Navigation fields must be the expected type." }, 400);
  }
  if (!label || label.length < 1) {
    return c.json({ error: "Label must be between 1 and 80 characters." }, 400);
  }
  if (!route || !route.startsWith("/")) {
    return c.json({ error: "Route must start with /." }, 400);
  }
  const isAdminRoute = route === "/admin" || route.startsWith("/admin/");
  if (scope !== undefined && (scope === "admin") !== isAdminRoute) {
    return c.json(
      { error: "Public and administrator navigation must use matching route scopes." },
      400,
    );
  }

  const flagError = await validateFeatureFlag(featureFlag ?? "");
  if (flagError) return c.json({ error: flagError }, 400);

  const row: Record<string, unknown> = {
    label,
    route,
    icon: icon ?? "",
    required_role: requiredRole ?? "all",
    feature_flag: featureFlag ?? "",
    position: position ?? 0,
    visible: visible ?? true,
    desktop_visible: desktopVisible ?? true,
    mobile_visible: mobileVisible ?? true,
  };
  if (scope !== undefined) {
    if (!(await hasNavigationScope())) {
      return c.json(
        {
          error:
            "This deployment has a single navigation table. Apply supabase/migrations/20261016000000_velori_navigation_scope_and_social_rls.sql before choosing a scope.",
          code: "migration_missing",
        },
        409,
      );
    }
    row.navigation_scope = scope;
  }

  const { data, error } = await service().from("navigation_items").insert(row).select("*").single();
  if (error) return c.json({ error: "The navigation entry could not be created." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.navigation.created",
    targetType: "navigation",
    targetId: data.id,
    metadata: { label, route, navigation_scope: row.navigation_scope ?? null },
  });
  return c.json({ created: true, item: data });
};

export const handleNavigationPatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That entry id is not valid." }, 400);

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const label = readString(body.value, "label", 81);
  const route = readString(body.value, "route", 181);
  const icon = readString(body.value, "icon", 61);
  const requiredRole = readEnum(body.value, "required_role", NAV_REQUIRED_ROLES);
  const featureFlag = readString(body.value, "feature_flag", 41);
  const position = readInteger(body.value, "position", 0, 9999);
  const visible = readBoolean(body.value, "visible");
  const desktopVisible = readBoolean(body.value, "desktop_visible");
  const mobileVisible = readBoolean(body.value, "mobile_visible");
  const scope = readEnum(body.value, "navigation_scope", NAV_SCOPES);

  if (
    label === null ||
    route === null ||
    icon === null ||
    requiredRole === null ||
    featureFlag === null ||
    position === null ||
    visible === null ||
    desktopVisible === null ||
    mobileVisible === null ||
    scope === null
  ) {
    return c.json({ error: "Navigation fields must be the expected type." }, 400);
  }

  const flagError = await validateFeatureFlag(featureFlag ?? "");
  if (flagError) return c.json({ error: flagError }, 400);

  const updates: Record<string, unknown> = {};
  if (label !== undefined) updates.label = label;
  if (route !== undefined) {
    if (!route.startsWith("/")) {
      return c.json({ error: "Route must start with /." }, 400);
    }
    updates.route = route;
  }
  if (icon !== undefined) updates.icon = icon;
  if (requiredRole !== undefined) updates.required_role = requiredRole;
  if (featureFlag !== undefined) updates.feature_flag = featureFlag;
  if (position !== undefined) updates.position = position;
  if (desktopVisible !== undefined) updates.desktop_visible = desktopVisible;
  if (mobileVisible !== undefined) updates.mobile_visible = mobileVisible;
  if (visible !== undefined) updates.visible = visible;
  if (scope !== undefined) {
    if (!(await hasNavigationScope())) {
      return c.json(
        {
          error:
            "This deployment has a single navigation table. Apply supabase/migrations/20261016000000_velori_navigation_scope_and_social_rls.sql before changing a scope.",
          code: "migration_missing",
        },
        409,
      );
    }
    updates.navigation_scope = scope;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No recognised navigation fields were supplied." }, 400);
  }

  const { data: currentEntry } = await service()
    .from("navigation_items")
    .select("route,navigation_scope")
    .eq("id", id)
    .maybeSingle();
  if (!currentEntry) return c.json({ error: "That navigation entry was not found." }, 404);
  const nextRoute = (updates.route as string | undefined) ?? currentEntry.route;
  const nextScope =
    (updates.navigation_scope as string | undefined) ?? currentEntry.navigation_scope;
  const nextIsAdminRoute = nextRoute === "/admin" || nextRoute.startsWith("/admin/");
  if ((nextScope === "admin") !== nextIsAdminRoute) {
    return c.json(
      { error: "Public and administrator navigation must use matching route scopes." },
      400,
    );
  }

  // Guard: never let the console hide or unlink the only route back into
  // administration, which would lock every administrator out with no recovery.
  if (visible === false || route !== undefined) {
    const blocked = await assertConsoleRemainsReachable(c, id, route ?? null);
    if (blocked) return blocked;
  }

  const { data, error } = await service()
    .from("navigation_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return c.json({ error: "The navigation entry could not be saved." }, 500);
  if (!data) return c.json({ error: "That navigation entry was not found." }, 404);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.navigation.updated",
    targetType: "navigation",
    targetId: id,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { fields: Object.keys(updates) },
  });
  return c.json({ updated: true, item: data });
};

export const handleNavigationDelete = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That entry id is not valid." }, 400);

  // The reason is read before any mutation: the request body is a one-shot stream,
  // and reading it after the delete would make the audit row depend on timing.
  const body = await readJson(c.req.raw);
  const reason = body.ok ? (readString(body.value, "reason", 2001) ?? "") : "";

  const blocked = await assertConsoleRemainsReachable(c, id, null);
  if (blocked) return blocked;

  const { data: item } = await service()
    .from("navigation_items")
    .select("id,label,route")
    .eq("id", id)
    .maybeSingle();
  if (!item) return c.json({ error: "That navigation entry was not found." }, 404);

  const { error } = await service().from("navigation_items").delete().eq("id", id);
  if (error) return c.json({ error: "The navigation entry could not be deleted." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.navigation.deleted",
    targetType: "navigation",
    targetId: id,
    reason,
    metadata: { label: item.label, route: item.route },
  });
  return c.json({ deleted: true });
};

/** Routes that must stay reachable from the console's own navigation. Hiding,
 * unlinking or deleting the last of them would leave an administrator with no way
 * back into the console from the interface, so the change is refused with 409. */
const CONSOLE_ROUTES = ["/admin", "/admin/dashboard", "/admin/settings"] as const;

async function assertConsoleRemainsReachable(
  c: Ctx,
  changingId: string,
  newRoute: string | null,
): Promise<Response | null> {
  const scoped = await hasNavigationScope();
  // Two literal selects rather than a computed one: supabase-js derives the result
  // row type from the string literal, and a variable collapses it to a parse error.
  const result = scoped
    ? await service().from("navigation_items").select("id,route,visible,navigation_scope")
    : await service().from("navigation_items").select("id,route,visible");
  const entries = (result.data ?? []) as Record<string, unknown>[];

  // With migration 20261016000000 applied, an entry only reaches the console
  // navigation when it is in the administrator scope: the public shell's row-level
  // policies expose `navigation_scope = 'public'` rows only. Before that migration
  // there is one table and every visible row counts.
  // Resolve the entry being changed against its prospective new route so the
  // survivor set reflects the state after this edit, not the state before it.
  const survivors = entries.flatMap((entry) => {
    if (scoped && entry.navigation_scope !== undefined && entry.navigation_scope !== "admin") {
      return [];
    }
    const route = entry.id === changingId ? newRoute : (entry.route as string | null);
    return entry.visible !== false && route ? [route] : [];
  });
  if (CONSOLE_ROUTES.some((route) => survivors.includes(route))) return null;
  return c.json(
    {
      error: `This change would remove the last visible link into the administrator console. Keep at least one administrator-scope entry pointing at ${CONSOLE_ROUTES.join(", ")}.`,
      code: "console_unreachable",
    },
    409,
  );
}

export const handleNavigationReorder = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const order = body.value.order;
  if (!Array.isArray(order) || order.length === 0) {
    return c.json({ error: "Provide an ordered list of navigation entry ids." }, 400);
  }
  const ids = order.filter((value): value is string => typeof value === "string");
  if (ids.length !== order.length || ids.some((id) => !isUuid(id))) {
    return c.json({ error: "Every navigation id must be a valid identifier." }, 400);
  }

  const db = service();
  for (const [index, id] of ids.entries()) {
    const { error } = await db
      .from("navigation_items")
      .update({ position: index, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      return c.json({ error: "The new order could not be saved." }, 500);
    }
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.navigation.reordered",
    targetType: "navigation",
    metadata: { count: ids.length },
  });
  return c.json({ reordered: true, count: ids.length });
};

/** Rejects a navigation item that references a feature flag which does not
 * exist. Without this an operator can attach a typo and the entry silently
 * becomes permanently visible. */
async function validateFeatureFlag(flag: string): Promise<string | null> {
  const key = flag.trim();
  if (!key) return null;
  const { data } = await service().from("feature_flags").select("key").eq("key", key).maybeSingle();
  if (!data) {
    return `No feature flag named "${key}" exists, so this entry could never be hidden.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Branding assets
// ---------------------------------------------------------------------------

const BRANDING_SLOTS = [
  "main_logo",
  "velori_logo",
  "light_logo",
  "dark_logo",
  "mobile_logo",
  "favicon",
  "app_icon",
  "loading_logo",
  "login_logo",
  "email_logo",
] as const;

async function syncLiveBranding(
  slot: string,
  publicUrl: string,
  isActive: boolean,
  userId: string,
) {
  const update =
    slot === "main_logo"
      ? { logo_url: isActive ? publicUrl : "/velori-official.svg" }
      : slot === "favicon"
        ? { favicon_url: isActive ? publicUrl : null }
        : null;
  if (!update) return null;
  const { error } = await service()
    .from("site_settings")
    .update({ ...update, updated_by: userId, updated_at: new Date().toISOString() })
    .eq("id", true);
  return error;
}

export const handleBrandingList = async (c: Ctx) => {
  const db = service();
  const { data, error } = await db.from("branding_assets").select("*").order("slot");
  if (error) {
    return c.json(
      {
        error:
          "Branding assets could not be read. Apply supabase/migrations/20261014000000_velori_admin_console.sql.",
      },
      500,
    );
  }

  const ids = (data ?? []).map((row) => row.id as string);
  const { data: history } = ids.length
    ? await db
        .from("branding_asset_versions")
        .select("asset_id,version,public_url,note,created_at")
        .in("asset_id", ids)
        .order("version", { ascending: false })
    : { data: [] as unknown[] };

  const bySlot = (data ?? []).map((row) => ({
    ...row,
    history: ((history ?? []) as { asset_id: string; version: number }[]).filter(
      (version) => version.asset_id === row.id,
    ),
  }));

  return c.json({
    assets: bySlot,
    slots: BRANDING_SLOTS,
    // The live values the public shell reads, so the screen can show what is
    // actually in effect rather than only what the asset table says.
    live: await readLiveBrandReferences(),
  });
};

async function readLiveBrandReferences() {
  const { data } = await service()
    .from("site_settings")
    .select("logo_url,favicon_url,site_name,site_title")
    .eq("id", true)
    .maybeSingle();
  return {
    logoUrl: data?.logo_url ?? null,
    faviconUrl: data?.favicon_url ?? null,
    siteName: data?.site_name ?? null,
    siteTitle: data?.site_title ?? null,
  };
}

/**
 * Validates the upload by magic bytes, stores it under a server-generated key,
 * records the outgoing file as a version, and only then activates the new asset.
 * The previously active object is never deleted, so a rejected or unwanted
 * replacement can always be reverted.
 */
export const handleBrandingUpload = async (c: Ctx) => {
  const { user } = c.get("admin");

  const declaredLength = Number.parseInt(c.req.header("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES + 8192) {
    return c.json({ error: "Branding images must be 2 MB or smaller." }, 413);
  }

  const form = await c.req.raw.formData().catch(() => null);
  const file = form?.get("file");
  const slot = form?.get("slot");
  if (!(file instanceof File)) return c.json({ error: "No file was uploaded." }, 400);
  if (typeof slot !== "string" || !(BRANDING_SLOTS as readonly string[]).includes(slot)) {
    return c.json({ error: "Choose a valid branding slot." }, 400);
  }
  if (file.size === 0) return c.json({ error: "The uploaded file is empty." }, 400);
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: "Branding images must be 2 MB or smaller." }, 413);
  }

  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    return c.json({ error: "Branding images must be PNG, JPEG or WebP." }, 415);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = (offset: number, pattern: number[]) =>
    bytes.length >= offset + pattern.length &&
    pattern.every((byte, index) => bytes[offset + index] === byte);
  const detected = signature(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ? "image/png"
    : signature(0, [0xff, 0xd8, 0xff])
      ? "image/jpeg"
      : signature(0, [0x52, 0x49, 0x46, 0x46]) && signature(8, [0x57, 0x45, 0x42, 0x50])
        ? "image/webp"
        : null;
  if (!detected || detected !== file.type) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.branding.rejected",
      targetType: "branding_asset",
      targetId: slot,
      reason: "content_type_mismatch",
      result: "failure",
      metadata: { declaredType: file.type, detected },
      errorId,
    });
    return c.json(
      {
        error: "The file contents do not match the declared image format.",
        errorId,
      },
      415,
    );
  }

  const extension = detected === "image/png" ? "png" : detected === "image/jpeg" ? "jpg" : "webp";
  const objectPath = `branding/${slot}-${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await service()
    .storage.from("site-assets")
    .upload(objectPath, bytes, { contentType: detected, upsert: false });
  if (uploadError) {
    return c.json({ error: "The image could not be stored." }, 500);
  }
  const publicUrl = publicAssetUrl(objectPath);

  const db = service();
  const { data: existing } = await db
    .from("branding_assets")
    .select("*")
    .eq("slot", slot)
    .maybeSingle();

  let assetId = existing?.id as string | undefined;
  let version = 1;
  if (existing) {
    version = ((existing.version as number) ?? 1) + 1;
    await db.from("branding_asset_versions").insert({
      asset_id: existing.id,
      version: existing.version,
      object_path: existing.object_path,
      public_url: existing.public_url,
      mime_type: existing.mime_type,
      byte_size: existing.byte_size,
      note: "Replaced by a newer asset",
      created_by: user.id,
    });
    await db
      .from("branding_assets")
      .update({
        object_path: objectPath,
        public_url: publicUrl,
        mime_type: detected,
        byte_size: bytes.byteLength,
        version,
        is_active: true,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    const { data: created, error } = await db
      .from("branding_assets")
      .insert({
        slot,
        label: slot.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase()),
        object_path: objectPath,
        public_url: publicUrl,
        mime_type: detected,
        byte_size: bytes.byteLength,
        is_active: true,
        version: 1,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !created) {
      return c.json({ error: "The branding asset could not be recorded." }, 500);
    }
    assetId = created.id;
  }

  const settingsError = await syncLiveBranding(slot, publicUrl, true, user.id);
  if (settingsError) {
    return c.json(
      { error: "The asset was stored, but could not be activated on the public site." },
      500,
    );
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.branding.uploaded",
    targetType: "branding_asset",
    targetId: assetId ?? slot,
    metadata: { slot, mimeType: detected, bytes: bytes.byteLength, version },
  });
  return c.json({
    uploaded: true,
    slot,
    version,
    publicUrl,
    objectPath,
    device: deviceLabel(c.req.header("user-agent") ?? null),
  });
};

export const handleBrandingRestoreVersion = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  const version = Number.parseInt(c.req.param("version") ?? "", 10);
  if (!isUuid(id) || !Number.isFinite(version)) {
    return c.json({ error: "That branding version is not valid." }, 400);
  }

  const { data: history } = await service()
    .from("branding_asset_versions")
    .select("*")
    .eq("asset_id", id)
    .eq("version", version)
    .maybeSingle();
  if (!history) return c.json({ error: "That version was not found." }, 404);

  const { data, error } = await service()
    .from("branding_assets")
    .update({
      object_path: history.object_path,
      public_url: history.public_url,
      mime_type: history.mime_type,
      byte_size: history.byte_size,
      version: ((history.version as number) ?? version) + 1,
      is_active: true,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) return c.json({ error: "That version could not be restored." }, 500);

  const settingsError = await syncLiveBranding(
    String(data.slot),
    String(data.public_url),
    data.is_active === true,
    user.id,
  );
  if (settingsError) {
    return c.json(
      { error: "The version was restored, but could not be activated on the public site." },
      500,
    );
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.branding.version_restored",
    targetType: "branding_asset",
    targetId: id,
    reason: `restored v${version}`,
  });
  return c.json({ restored: true, asset: data });
};

export const handleBrandingPatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That asset id is not valid." }, 400);
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const label = readString(body.value, "label", 81);
  const isActive = readBoolean(body.value, "is_active");
  if (label === null || isActive === null) {
    return c.json({ error: "Branding fields must be the expected type." }, 400);
  }
  const updates: Record<string, unknown> = {};
  if (label !== undefined) updates.label = label;
  if (isActive !== undefined) updates.is_active = isActive;
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No recognised branding fields were supplied." }, 400);
  }

  const { data, error } = await service()
    .from("branding_assets")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) return c.json({ error: "The branding asset could not be saved." }, 500);

  if (isActive !== undefined) {
    const settingsError = await syncLiveBranding(
      String(data.slot),
      String(data.public_url),
      data.is_active === true,
      user.id,
    );
    if (settingsError) {
      return c.json(
        { error: "The branding asset was saved, but could not be updated on the public site." },
        500,
      );
    }
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.branding.updated",
    targetType: "branding_asset",
    targetId: id,
    metadata: { fields: Object.keys(updates) },
  });
  return c.json({ updated: true, asset: data });
};

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

const ANIMATION_TYPES = [
  "none",
  "fade",
  "fade_up",
  "fade_down",
  "slide_left",
  "slide_right",
  "scale",
  "pop",
  "blur",
  "shimmer",
  "pulse",
  "drift",
  "ken_burns",
] as const;
const EASINGS = ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "spring"] as const;

export const handleMotionCmsGet = async (c: Ctx) => {
  const db = service();
  const [configuration, presets, versions, routes, animations] = await Promise.all([
    db
      .from("motion_configuration")
      .select("draft_config,published_config,published_version,published_at,updated_at")
      .eq("id", true)
      .maybeSingle(),
    db
      .from("motion_presets")
      .select("id,label,category,description,parameters,enabled")
      .eq("enabled", true)
      .order("category")
      .order("label"),
    db
      .from("motion_versions")
      .select("version,snapshot,change_summary,event,created_at,published_at")
      .order("version", { ascending: false })
      .limit(30),
    db.from("app_routes").select("path,label,route_group,enabled").order("path"),
    db
      .from("animation_configs")
      .select(
        "key,label,category,enabled,animation_type,duration_ms,media_url,media_mime_type,media_byte_size",
      )
      .order("category")
      .order("label"),
  ]);
  if (
    configuration.error ||
    !configuration.data ||
    presets.error ||
    versions.error ||
    routes.error ||
    animations.error
  ) {
    return c.json(
      { error: "The motion CMS is unavailable. Apply the motion experience migration." },
      503,
    );
  }
  let draft: unknown;
  let published: unknown;
  try {
    draft = normalizeMotionConfig(configuration.data.draft_config);
    published = normalizeMotionConfig(configuration.data.published_config);
  } catch {
    draft = DEFAULT_MOTION_CONFIG;
    published = DEFAULT_MOTION_CONFIG;
  }
  return c.json({
    draft,
    published,
    publishedVersion: configuration.data.published_version,
    publishedAt: configuration.data.published_at,
    updatedAt: configuration.data.updated_at,
    presets: presets.data ?? [],
    versions: versions.data ?? [],
    routes: routes.data ?? [],
    animations: animations.data ?? [],
  });
};

export const handleMotionCmsDraftPut = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  let config;
  try {
    config = normalizeMotionConfig(body.value.config);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Motion configuration is invalid." },
      400,
    );
  }
  const summary = readString(body.value, "summary", 500);
  if (summary === null || (summary?.length ?? 0) > 500)
    return c.json({ error: "Change summary must be at most 500 characters." }, 400);
  const { data: current, error: currentError } = await service()
    .from("motion_configuration")
    .select("draft_config")
    .eq("id", true)
    .maybeSingle();
  if (currentError || !current)
    return c.json({ error: "The current motion draft could not be loaded." }, 500);
  const changedSections = (
    [
      "global",
      "theme",
      "pageRules",
      "pageExperiences",
      "errorRules",
      "errorPages",
      "componentRules",
    ] as const
  ).filter((key) => JSON.stringify(current.draft_config?.[key]) !== JSON.stringify(config[key]));
  const { data, error } = await service()
    .from("motion_configuration")
    .update({ draft_config: config, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select("updated_at")
    .maybeSingle();
  if (error || !data) return c.json({ error: "The motion draft could not be saved." }, 500);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.motion.draft_saved",
    targetType: "motion_configuration",
    targetId: "global",
    reason: summary ?? "",
    metadata: {
      changedSections,
      pageRules: config.pageRules.length,
      pageExperiences: config.pageExperiences.length,
      errorRules: config.errorRules.length,
      componentRules: config.componentRules.length,
    },
  });
  return c.json({ saved: true, draft: config, updatedAt: data.updated_at });
};

export const handleMotionCmsPublish = async (c: Ctx) => {
  const blocked = await requireRecentReauth(c, 10);
  if (blocked) return blocked;
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const summary = readString(body.value, "summary", 500);
  if (summary === null || (summary?.length ?? 0) > 500 || !summary?.trim()) {
    return c.json({ error: "Add a short change summary before publishing." }, 400);
  }
  const { data: stored, error: readError } = await service()
    .from("motion_configuration")
    .select("draft_config,published_version")
    .eq("id", true)
    .maybeSingle();
  if (readError || !stored) return c.json({ error: "The motion draft could not be loaded." }, 500);
  let config;
  try {
    config = normalizeMotionConfig(stored.draft_config);
  } catch {
    return c.json(
      { error: "The saved motion draft is invalid; correct it before publishing." },
      409,
    );
  }
  const { data, error } = await service().rpc("publish_motion_config", {
    p_config: config,
    p_summary: summary.trim(),
    p_user_id: user.id,
    p_event: "publish",
  });
  if (error || !data)
    return c.json({ error: "The motion configuration could not be published." }, 500);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.motion.published",
    targetType: "motion_configuration",
    targetId: String(data.version),
    reason: summary.trim(),
    metadata: { previousVersion: stored.published_version, version: data.version },
  });
  return c.json({ published: true, version: data.version, publishedAt: data.published_at });
};

export const handleMotionCmsRestore = async (c: Ctx) => {
  const blocked = await requireRecentReauth(c, 10);
  if (blocked) return blocked;
  const version = Number.parseInt(c.req.param("version") ?? "", 10);
  if (!Number.isInteger(version) || version < 1)
    return c.json({ error: "Choose a valid version." }, 400);
  const { user } = c.get("admin");
  const { data: previous, error: readError } = await service()
    .from("motion_versions")
    .select("snapshot,version")
    .eq("version", version)
    .maybeSingle();
  if (readError || !previous) return c.json({ error: "That motion version was not found." }, 404);
  let config;
  try {
    config = normalizeMotionConfig(previous.snapshot);
  } catch {
    return c.json({ error: "That saved motion version is invalid and cannot be restored." }, 409);
  }
  const { data, error } = await service().rpc("publish_motion_config", {
    p_config: config,
    p_summary: `Restored version ${version}`,
    p_user_id: user.id,
    p_event: "rollback",
  });
  if (error || !data) return c.json({ error: "The motion version could not be restored." }, 500);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.motion.rolled_back",
    targetType: "motion_configuration",
    targetId: String(version),
    reason: `Restored version ${version}`,
    metadata: { restoredVersion: version, publishedVersion: data.version },
  });
  return c.json({ restored: true, sourceVersion: version, version: data.version });
};

export const handleAnimationsList = async (c: Ctx) => {
  const { data, error } = await service()
    .from("animation_configs")
    .select("*")
    .order("category")
    .order("key");
  if (error) {
    return c.json(
      {
        error:
          "Motion configuration could not be read. Apply supabase/migrations/20261014000000_velori_admin_console.sql.",
      },
      500,
    );
  }

  // Read the live platform switches alongside the per-surface configuration so
  // the screen can show the real effective state, not only the motion table.
  const { data: platform } = await service()
    .from("platform_settings")
    .select("reduce_motion_safe_mode")
    .eq("id", true)
    .maybeSingle();

  return c.json({
    animations: data ?? [],
    reduceMotionSafeMode: platform?.reduce_motion_safe_mode ?? false,
    availableTypes: ANIMATION_TYPES,
    availableEasings: EASINGS,
  });
};

export const handleAnimationPatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const key = c.req.param("key");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const enabled = readBoolean(body.value, "enabled");
  const animationType = readEnum(body.value, "animation_type", ANIMATION_TYPES);
  const easing = readEnum(body.value, "easing", EASINGS);
  const durationMs = readInteger(body.value, "duration_ms", 0, 4000);
  const intensity = readInteger(body.value, "intensity", 0, 100);
  const delayMs = readInteger(body.value, "delay_ms", 0, 2000);
  const respectReducedMotion = readBoolean(body.value, "respect_reduced_motion");

  if (
    enabled === null ||
    animationType === null ||
    easing === null ||
    durationMs === null ||
    intensity === null ||
    delayMs === null ||
    respectReducedMotion === null
  ) {
    return c.json({ error: "Motion fields must be the expected type." }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (enabled !== undefined) updates.enabled = enabled;
  if (animationType !== undefined) updates.animation_type = animationType;
  if (easing !== undefined) updates.easing = easing;
  if (durationMs !== undefined) updates.duration_ms = durationMs;
  if (intensity !== undefined) updates.intensity = intensity;
  if (delayMs !== undefined) updates.delay_ms = delayMs;
  if (respectReducedMotion !== undefined) {
    updates.respect_reduced_motion = respectReducedMotion;
  }
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No recognised motion fields were supplied." }, 400);
  }

  const { data, error } = await service()
    .from("animation_configs")
    .update({ ...updates, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("key", key)
    .select("*")
    .maybeSingle();
  if (error) return c.json({ error: "The motion setting could not be saved." }, 500);
  if (!data) return c.json({ error: "That motion setting was not found." }, 404);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.animation.updated",
    targetType: "animation",
    targetId: key,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { fields: Object.keys(updates) },
  });
  return c.json({ updated: true, animation: data });
};

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const raw = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export const handleAppearanceGet = async (c: Ctx) => {
  const { data, error } = await service()
    .from("theme_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    return c.json(
      {
        error:
          "Theme configuration could not be read. Apply supabase/migrations/20261014000000_velori_admin_console.sql.",
      },
      500,
    );
  }
  return c.json({
    theme: data ?? null,
    live: await readLiveBrandReferences(),
    // Reported so the screen can show the accessibility consequence of the
    // current palette instead of leaving it to be discovered by users.
    contrast: data
      ? {
          textOnSurface: Number(contrastRatio(data.text_color, data.surface_color).toFixed(2)),
          mutedOnSurface: Number(
            contrastRatio(data.muted_text_color, data.surface_color).toFixed(2),
          ),
        }
      : null,
  });
};

export const handleAppearancePut = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const colors: Record<string, string> = {};
  for (const field of [
    "primary_color",
    "secondary_color",
    "accent_color",
    "background_color",
    "surface_color",
    "text_color",
    "muted_text_color",
  ] as const) {
    const value = readString(body.value, field, 7);
    if (value === null) {
      return c.json({ error: `${field} must be a colour string.` }, 400);
    }
    if (value !== undefined) {
      if (!HEX.test(value)) {
        return c.json({ error: `${field} must be a hex colour such as #3ba7ff.` }, 400);
      }
      colors[field] = value;
    }
  }

  const numeric: Record<string, number> = {};
  const borderRadius = readInteger(body.value, "border_radius", 0, 48);
  if (borderRadius !== null && borderRadius !== undefined) {
    numeric.border_radius = borderRadius;
  }
  const shadowLevel = readEnum(body.value, "shadow_level", [
    "none",
    "soft",
    "medium",
    "bold",
  ] as const);
  if (shadowLevel === null) {
    return c.json({ error: "shadow_level is not a valid option." }, 400);
  }
  const buttonStyle = readEnum(body.value, "button_style", [
    "rounded",
    "pill",
    "square",
    "soft",
  ] as const);
  if (buttonStyle === null) {
    return c.json({ error: "button_style is not a valid option." }, 400);
  }
  const cardStyle = readEnum(body.value, "card_style", [
    "flat",
    "outlined",
    "elevated",
    "glass",
  ] as const);
  if (cardStyle === null) {
    return c.json({ error: "card_style is not a valid option." }, 400);
  }
  const navigationStyle = readEnum(body.value, "navigation_style", [
    "sidebar",
    "topbar",
    "minimal",
  ] as const);
  if (navigationStyle === null) {
    return c.json({ error: "navigation_style is not a valid option." }, 400);
  }
  const glassEffects = readBoolean(body.value, "glass_effects");
  if (glassEffects === null) {
    return c.json({ error: "glass_effects must be true or false." }, 400);
  }
  const headingFont = readString(body.value, "heading_font", 81);
  const bodyFont = readString(body.value, "body_font", 81);
  if (headingFont === null || bodyFont === null) {
    return c.json({ error: "Font names must be text." }, 400);
  }

  // Readability gate. Body text must clear WCAG AA (4.5:1) against the surface
  // it sits on, otherwise the change is rejected instead of being published.
  const { data: current } = await service()
    .from("theme_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const surface = colors.surface_color ?? current?.surface_color ?? "#ffffff";
  const text = colors.text_color ?? current?.text_color ?? "#141018";
  const muted = colors.muted_text_color ?? current?.muted_text_color ?? "#6b6472";
  const textRatio = contrastRatio(text, surface);
  const mutedRatio = contrastRatio(muted, surface);
  if (textRatio < 4.5) {
    return c.json(
      {
        error: `Body text would sit at ${textRatio.toFixed(2)}:1 against the surface. WCAG AA requires at least 4.5:1 for normal text.`,
        code: "contrast_too_low",
        contrast: Number(textRatio.toFixed(2)),
      },
      400,
    );
  }
  if (mutedRatio < 3) {
    return c.json(
      {
        error: `Muted text would sit at ${mutedRatio.toFixed(2)}:1 against the surface. Large or secondary text needs at least 3:1.`,
        code: "contrast_too_low",
        contrast: Number(mutedRatio.toFixed(2)),
      },
      400,
    );
  }

  const update: Record<string, unknown> = {
    ...colors,
    ...numeric,
    ...(shadowLevel !== undefined ? { shadow_level: shadowLevel } : {}),
    ...(buttonStyle !== undefined ? { button_style: buttonStyle } : {}),
    ...(cardStyle !== undefined ? { card_style: cardStyle } : {}),
    ...(navigationStyle !== undefined ? { navigation_style: navigationStyle } : {}),
    ...(glassEffects !== undefined ? { glass_effects: glassEffects } : {}),
    ...(headingFont !== undefined ? { heading_font: headingFont } : {}),
    ...(bodyFont !== undefined ? { body_font: bodyFont } : {}),
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };
  if (Object.keys(update).length <= 2) {
    return c.json({ error: "No recognised theme fields were supplied." }, 400);
  }

  const { data, error } = await service()
    .from("theme_settings")
    .update(update)
    .eq("id", true)
    .select("*")
    .single();
  if (error) return c.json({ error: "The theme could not be saved." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.theme.updated",
    targetType: "theme",
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: {
      fields: Object.keys(update).filter((key) => !key.startsWith("updated_")),
      contrast: { text: Number(textRatio.toFixed(2)), muted: Number(mutedRatio.toFixed(2)) },
    },
  });
  return c.json({ updated: true, theme: data });
};

// ---------------------------------------------------------------------------
// Error pages
// ---------------------------------------------------------------------------

const ERROR_CODES = ["404", "403", "429", "500", "maintenance", "network", "generic"] as const;
const ERROR_ILLUSTRATION_CODES = [
  ...ERROR_CODES,
  "NOT_FOUND",
  "FORBIDDEN",
  "RATE_LIMITED",
  "SERVER_ERROR",
  "BAD_GATEWAY",
  "MAINTENANCE",
  "OFFLINE",
  "AUTH_FAILURE",
  "CONTENT_UNAVAILABLE",
  "MEDIA_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "APPLICATION_ERROR",
] as const;

export const handleErrorPagesGet = async (c: Ctx) => {
  const { data, error } = await service().from("admin_error_pages").select("*").order("code");
  if (error) return c.json({ error: "Error page configuration could not be read." }, 500);
  const { data: live } = await service()
    .from("site_settings")
    .select("error_404_enabled")
    .eq("id", true)
    .maybeSingle();
  return c.json({
    pages: data ?? [],
    codes: ERROR_CODES,
    live: { error404AnimationEnabled: live?.error_404_enabled ?? true },
  });
};

export const handleErrorPagePatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const code = c.req.param("code");
  if (
    typeof code !== "string" ||
    (!(ERROR_CODES as readonly string[]).includes(code) &&
      !["SERVICE_UNAVAILABLE", "APPLICATION_ERROR"].includes(code))
  ) {
    return c.json({ error: "That error page does not exist." }, 404);
  }

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const title = readString(body.value, "title", 121);
  const heading = readString(body.value, "heading", 121);
  const description = readString(body.value, "description", 601);
  const imageUrl = readString(body.value, "image_url", 2049);
  const logoUrl = readString(body.value, "logo_url", 2049);
  const buttonLabel = readString(body.value, "button_label", 61);
  const buttonUrl = readString(body.value, "button_url", 2049);
  const background = readString(body.value, "background", 121);
  const animationKey = readString(body.value, "animation_key", 41);
  const enabled = readBoolean(body.value, "enabled");
  const showLogo = readBoolean(body.value, "show_logo");

  if (
    title === null ||
    heading === null ||
    description === null ||
    imageUrl === null ||
    logoUrl === null ||
    buttonLabel === null ||
    buttonUrl === null ||
    background === null ||
    animationKey === null ||
    enabled === null ||
    showLogo === null
  ) {
    return c.json({ error: "Error page fields must be the expected type." }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (heading !== undefined) updates.heading = heading || title || "";
  if (description !== undefined) updates.description = description;
  if (imageUrl !== undefined) updates.image_url = imageUrl;
  if (logoUrl !== undefined) updates.logo_url = logoUrl;
  if (buttonLabel !== undefined) updates.button_label = buttonLabel;
  if (buttonUrl !== undefined) {
    if (buttonUrl && !buttonUrl.startsWith("/") && !/^https?:\/\//.test(buttonUrl)) {
      return c.json({ error: "Button URL must be a site path or an absolute URL." }, 400);
    }
    updates.button_url = buttonUrl;
  }
  if (background !== undefined) updates.background = background;
  if (animationKey !== undefined) {
    if (animationKey) {
      const { data: known } = await service()
        .from("animation_configs")
        .select("key")
        .eq("key", animationKey)
        .maybeSingle();
      if (!known) {
        return c.json({ error: `No motion setting named "${animationKey}" exists.` }, 400);
      }
    }
    updates.animation_key = animationKey;
  }
  if (enabled !== undefined) updates.enabled = enabled;
  if (showLogo !== undefined) updates.show_logo = showLogo;

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No recognised error page fields were supplied." }, 400);
  }

  const { data, error } = await service()
    .from("admin_error_pages")
    .update({ ...updates, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("code", code)
    .select("*")
    .maybeSingle();
  if (error) return c.json({ error: "The error page could not be saved." }, 500);
  if (!data) return c.json({ error: "That error page was not found." }, 404);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: `admin.error_page.updated.${code}`,
    targetType: "error_page",
    targetId: code,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { fields: Object.keys(updates) },
  });
  return c.json({ updated: true, page: data });
};

/** Store a sanitized SVG for an unpublished motion draft. It remains
 * unreferenced by public configuration until the administrator publishes. */
export const handleErrorIllustrationUpload = async (c: Ctx) => {
  const { user } = c.get("admin");
  const code = c.req.param("code");
  if (typeof code !== "string" || !(ERROR_ILLUSTRATION_CODES as readonly string[]).includes(code)) {
    return c.json({ error: "That error page does not exist." }, 404);
  }

  const sizeError = "Error illustrations must be SVG files of 512 KB or smaller.";
  const declaredLength = Number.parseInt(c.req.header("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SVG_ILLUSTRATION_BYTES + 8192) {
    return c.json({ error: sizeError }, 413);
  }

  const form = await c.req.raw.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return c.json({ error: "No file was uploaded." }, 400);
  if (file.type !== "image/svg+xml") {
    return c.json({ error: "Error illustrations must be SVG files." }, 415);
  }
  if (file.size === 0) return c.json({ error: "The uploaded file is empty." }, 400);
  if (file.size > MAX_SVG_ILLUSTRATION_BYTES) return c.json({ error: sizeError }, 413);

  // The declared Content-Type is attacker controlled, so the real bytes decide:
  // strict UTF-8 with an <svg> root and no active content. The storage key is
  // generated, so no client filename reaches the path.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = decodeSvgText(bytes);
  const rejection =
    text === null ? "The file is not valid UTF-8 text." : inspectSvgIllustration(text);
  if (rejection) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.asset.rejected",
      targetType: "error_page",
      targetId: code,
      metadata: { declaredType: file.type, bytes: bytes.byteLength, rejection },
      errorId,
    });
    return c.json({ error: rejection, errorId }, 415);
  }

  const objectPath = `errors/${code}-${crypto.randomUUID()}.svg`;
  const { error: uploadError } = await service()
    .storage.from("site-assets")
    .upload(objectPath, bytes, { contentType: "image/svg+xml", upsert: false });
  if (uploadError) {
    const errorId = referenceId();
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.asset.upload.failed",
      targetType: "error_page",
      targetId: code,
      metadata: { objectPath },
      errorId,
    });
    return c.json(
      {
        error:
          "The illustration could not be stored. Confirm the site-assets bucket exists and migration 20261031004300 is applied.",
        errorId,
      },
      500,
    );
  }

  const url = publicAssetUrl(objectPath);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: `admin.error_page.illustration_asset_uploaded.${code}`,
    targetType: "error_page",
    targetId: code,
    metadata: { bytes: bytes.byteLength, objectPath },
  });
  return c.json({ url, path: objectPath });
};

// ---------------------------------------------------------------------------
// Announcements and targeted notifications
// ---------------------------------------------------------------------------

const PRIORITIES = ["low", "normal", "high", "critical"] as const;
const AUDIENCES = ["all", "selected_users", "account_types", "roles"] as const;
const ANNOUNCEMENT_STATES = [
  "draft",
  "scheduled",
  "live",
  "paused",
  "expired",
  "archived",
] as const;

export const handleAnnouncementMediaUpload = async (c: Ctx) => {
  const { user } = c.get("admin");
  const form = await c.req.raw.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size)
    return c.json({ error: "Choose an image or MP4 video." }, 400);
  if (file.size > 10 * 1024 * 1024)
    return c.json({ error: "Announcement media must be 10 MB or smaller." }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sig = (offset: number, pattern: number[]) =>
    bytes.length >= offset + pattern.length &&
    pattern.every((byte, index) => bytes[offset + index] === byte);
  const type = sig(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ? "image/png"
    : sig(0, [0xff, 0xd8, 0xff])
      ? "image/jpeg"
      : sig(0, [0x52, 0x49, 0x46, 0x46]) && sig(8, [0x57, 0x45, 0x42, 0x50])
        ? "image/webp"
        : bytes.length > 12 && new TextDecoder().decode(bytes.subarray(4, 8)) === "ftyp"
          ? "video/mp4"
          : null;
  if (!type || file.type !== type)
    return c.json({ error: "File contents must match PNG, JPEG, WebP or MP4." }, 415);
  const path = `announcements/${crypto.randomUUID()}.${type === "image/jpeg" ? "jpg" : type.split("/")[1]}`;
  const { error } = await service()
    .storage.from("site-assets")
    .upload(path, bytes, { contentType: type, upsert: false });
  if (error) return c.json({ error: "Announcement media could not be stored." }, 500);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.announcement.media_uploaded",
    targetType: "announcement_media",
    targetId: path,
    metadata: { type, bytes: file.size },
  });
  return c.json({ url: publicAssetUrl(path), path, type });
};

export const handleAnnouncementsList = async (c: Ctx) => {
  const { page, perPage } = paginate(c);
  const state = readEnum({ state: c.req.query("state") ?? "" }, "state", ANNOUNCEMENT_STATES);
  const searchTerm = String(c.req.query("q") ?? "")
    .trim()
    .slice(0, 120);
  let request = service()
    .from("system_announcements")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  const requestNow = new Date().toISOString();
  if (state === "expired") request = request.lte("ends_at", requestNow).neq("state", "archived");
  else if (state === "live")
    request = request
      .eq("state", "live")
      .eq("active", true)
      .lte("starts_at", requestNow)
      .or(`ends_at.is.null,ends_at.gt.${requestNow}`);
  else if (state) request = request.eq("state", state);
  if (searchTerm) {
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(searchTerm)
    )
      request = request.eq("id", searchTerm);
    else {
      const safe = searchTerm.replace(/[(),.%_\\]/g, " ").trim();
      request = request.or(`title.ilike.%${safe}%,internal_name.ilike.%${safe}%`);
    }
  }
  const { data, error, count } = await request;
  if (error) return c.json({ error: "Announcements could not be read." }, 500);
  const countsNow = new Date().toISOString();
  const states = ["draft", "paused", "archived"] as const;
  const counts = await Promise.all([
    service().from("system_announcements").select("id", { count: "exact", head: true }),
    service()
      .from("system_announcements")
      .select("id", { count: "exact", head: true })
      .eq("state", "live")
      .eq("active", true)
      .lte("starts_at", countsNow)
      .or(`ends_at.is.null,ends_at.gt.${countsNow}`),
    service()
      .from("system_announcements")
      .select("id", { count: "exact", head: true })
      .eq("state", "scheduled"),
    ...states.map((value) =>
      service()
        .from("system_announcements")
        .select("id", { count: "exact", head: true })
        .eq("state", value),
    ),
    service()
      .from("system_announcements")
      .select("id", { count: "exact", head: true })
      .lte("ends_at", countsNow)
      .neq("state", "archived"),
  ]);
  if (counts.some((result) => result.error))
    return c.json({ error: "Announcement statistics could not be read." }, 500);
  return c.json({
    announcements: data ?? [],
    total: count ?? 0,
    page,
    perPage,
    counts: {
      total: counts[0].count ?? 0,
      live: counts[1].count ?? 0,
      scheduled: counts[2].count ?? 0,
      draft: counts[3].count ?? 0,
      paused: counts[4].count ?? 0,
      archived: counts[5].count ?? 0,
      expired: counts[6].count ?? 0,
    },
  });
};

function announcementUpdates(source: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  const title = readString(source, "title", 121);
  const message = readString(source, "message", 2001);
  const customHtml = readString(source, "custom_html", MAX_PAGE_HTML_LENGTH);
  const customCss = readString(source, "custom_css", MAX_PAGE_CSS_LENGTH);
  const icon = readString(source, "icon", 61);
  const link = readString(source, "link", 301);
  const priority = readEnum(source, "priority", PRIORITIES);
  const audience = readEnum(source, "audience", AUDIENCES);
  const dismissible = readBoolean(source, "dismissible");
  const active = readBoolean(source, "active");
  const startsAt = readString(source, "starts_at", 41);
  const endsAt = readString(source, "ends_at", 41);
  const internalName = readString(source, "internal_name", 121);
  const state = readEnum(source, "state", ANNOUNCEMENT_STATES);
  const displayMode = readEnum(source, "display_mode", ["banner", "modal"] as const);
  const mediaType = readEnum(source, "media_type", ["none", "image", "video"] as const);
  const mediaUrl = readString(source, "media_url", 2049);
  const mediaAlt = readString(source, "media_alt", 301);
  const posterUrl = readString(source, "poster_url", 2049);
  const ctaLabel = readString(source, "cta_label", 81);
  const actionType = readEnum(source, "action_type", ["none", "internal", "external"] as const);
  const targetRoute = readString(source, "target_route", 301);
  const frequencyMode = readEnum(source, "frequency_mode", [
    "every_refresh",
    "once_per_session",
    "once_per_day",
    "once_total",
  ] as const);
  const maxShowCount = readInteger(source, "max_show_count", 1, 100);
  const delaySeconds = readInteger(source, "delay_seconds", 0, 3600);
  const targetRoutes = source.target_routes;

  if (
    title === null ||
    message === null ||
    customHtml === null ||
    customCss === null ||
    icon === null ||
    link === null ||
    priority === null ||
    audience === null ||
    dismissible === null ||
    active === null ||
    startsAt === null ||
    endsAt === null ||
    internalName === null ||
    state === null ||
    displayMode === null ||
    mediaType === null ||
    mediaUrl === null ||
    mediaAlt === null ||
    posterUrl === null ||
    ctaLabel === null ||
    actionType === null ||
    targetRoute === null ||
    frequencyMode === null ||
    maxShowCount === null ||
    delaySeconds === null ||
    (targetRoutes !== undefined &&
      (!Array.isArray(targetRoutes) ||
        targetRoutes.some((route) => typeof route !== "string" || route.length > 300)))
  ) {
    return { error: "Announcement fields must be the expected type." as const };
  }
  if (title !== undefined) updates.title = title;
  if (message !== undefined) updates.message = message;
  if (customHtml !== undefined) updates.custom_html = sanitizeCustomHtml(customHtml);
  if (customCss !== undefined) {
    const cssError = validateCustomCss(customCss);
    if (cssError) return { error: cssError };
    updates.custom_css = customCss;
  }
  if (icon !== undefined) updates.icon = icon;
  if (link !== undefined) updates.link = link;
  if (priority !== undefined) updates.priority = priority;
  if (audience !== undefined) updates.audience = audience;
  if (audience !== undefined && audience !== "all") {
    return {
      error:
        "Only the all-visitors audience is available until per-user eligibility checks are enabled." as const,
    };
  }
  if (dismissible !== undefined) updates.dismissible = dismissible;
  if (active !== undefined) updates.active = active;
  if (internalName !== undefined) updates.internal_name = internalName.trim();
  if (state !== undefined) {
    updates.state = state;
    if (["draft", "paused", "expired", "archived"].includes(state)) updates.active = false;
    if (state === "live" || state === "scheduled") updates.active = true;
  }
  if (displayMode !== undefined) updates.display_mode = displayMode;
  if (mediaType !== undefined) updates.media_type = mediaType;
  if (mediaUrl !== undefined) updates.media_url = mediaUrl;
  if (mediaAlt !== undefined) updates.media_alt = mediaAlt;
  if (posterUrl !== undefined) updates.poster_url = posterUrl;
  if (ctaLabel !== undefined) updates.cta_label = ctaLabel.trim();
  if (actionType !== undefined) updates.action_type = actionType;
  if (targetRoute !== undefined) updates.target_route = targetRoute;
  if (frequencyMode !== undefined) updates.frequency_mode = frequencyMode;
  if (maxShowCount !== undefined) updates.max_show_count = maxShowCount;
  if (delaySeconds !== undefined) updates.delay_seconds = delaySeconds;
  if (targetRoutes !== undefined) updates.target_routes = targetRoutes;
  if (link && !/^https:\/\//i.test(link) && (!link.startsWith("/") || link.startsWith("//"))) {
    return { error: "Announcement links must use https:// or a site path." as const };
  }
  if (
    mediaUrl &&
    !/^https:\/\//i.test(mediaUrl) &&
    (!mediaUrl.startsWith("/") || mediaUrl.startsWith("//"))
  ) {
    return { error: "Announcement media must use https:// or a site path." as const };
  }
  if (actionType === "external" && link && !/^https:\/\//i.test(link)) {
    return { error: "External announcement actions must use https://." as const };
  }
  if (actionType === "internal" && link && (!link.startsWith("/") || link.startsWith("//"))) {
    return { error: "Internal announcement actions must use a VELORI site path." as const };
  }
  if (
    Array.isArray(targetRoutes) &&
    targetRoutes.some(
      (route) => !route.startsWith("/") || route.startsWith("//") || route.includes(".."),
    )
  ) {
    return { error: "Target routes must be safe VELORI site paths." as const };
  }
  if (startsAt !== undefined) {
    if (startsAt && Number.isNaN(Date.parse(startsAt))) {
      return { error: "Start date is not a valid date." as const };
    }
    updates.starts_at = startsAt ? new Date(startsAt).toISOString() : new Date().toISOString();
  }
  if (endsAt !== undefined) {
    if (endsAt && Number.isNaN(Date.parse(endsAt))) {
      return { error: "End date is not a valid date." as const };
    }
    updates.ends_at = endsAt ? new Date(endsAt).toISOString() : null;
  }
  if (
    updates.ends_at &&
    updates.starts_at &&
    new Date(updates.ends_at as string) <= new Date(updates.starts_at as string)
  ) {
    return { error: "The end date must be after the start date." as const };
  }
  return { updates };
}

export const handleAnnouncementCreate = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const title = readString(body.value, "title", 121);
  const message = readString(body.value, "message", 2001);
  const fields = announcementUpdates(body.value);
  if ("error" in fields) return c.json({ error: fields.error }, 400);
  const hasCustomContent = Boolean(fields.updates.custom_html);
  if (title === null || message === null) {
    return c.json({ error: "Title and message must be text." }, 400);
  }
  if (!title?.trim() || (!message?.trim() && !hasCustomContent)) {
    return c.json(
      { error: "An announcement needs a title and either a message or custom HTML." },
      400,
    );
  }

  const { data, error } = await service()
    .from("system_announcements")
    .insert({
      ...fields.updates,
      title: title.trim(),
      message: message?.trim() || title.trim(),
      // A client cannot publish through create, even if it supplies state=live.
      active: false,
      state: "draft",
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) return c.json({ error: "The announcement could not be created." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.announcement.created",
    targetType: "announcement",
    targetId: data.id,
    metadata: {
      priority: data.priority,
      audience: data.audience,
      scheduled: Boolean(data.starts_at && new Date(data.starts_at) > new Date()),
    },
  });
  return c.json({ created: true, announcement: data });
};

export const handleAnnouncementPatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That announcement id is not valid." }, 400);
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const fields = announcementUpdates(body.value);
  if ("error" in fields) return c.json({ error: fields.error }, 400);
  if (Object.keys(fields.updates).length === 0) {
    return c.json({ error: "No recognised announcement fields were supplied." }, 400);
  }

  const { data: current } = await service()
    .from("system_announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!current) return c.json({ error: "That announcement was not found." }, 404);
  const apkPolicyError = apkPromotionMutationError({
    currentName: current.internal_name,
    nextName: fields.updates.internal_name,
    nextState: fields.updates.state,
    nextActive: fields.updates.active,
  });
  if (apkPolicyError) return c.json({ error: apkPolicyError }, 409);
  const isLiveDraftSave = current.state === "live" && fields.updates.state === "live";
  const isResume =
    current.state === "paused" &&
    fields.updates.state === "live" &&
    Object.keys(fields.updates).every((key) => key === "state" || key === "active");
  if (
    (fields.updates.state === "live" && !isLiveDraftSave && !isResume) ||
    (Object.hasOwn(fields.updates, "active") && !Object.hasOwn(fields.updates, "state")) ||
    (fields.updates.active === true && fields.updates.state !== "live")
  ) {
    return c.json(
      { error: "Publish this announcement through the validated publish action." },
      400,
    );
  }
  if (isLiveDraftSave) {
    const editableFields = [
      "title",
      "message",
      "custom_html",
      "custom_css",
      "internal_name",
      "priority",
      "audience",
      "icon",
      "link",
      "dismissible",
      "starts_at",
      "ends_at",
      "display_mode",
      "media_type",
      "media_url",
      "media_alt",
      "poster_url",
      "cta_label",
      "action_type",
      "target_route",
      "target_routes",
      "frequency_mode",
      "max_show_count",
      "delay_seconds",
    ];
    const pending = { ...(current.draft_payload ?? {}) } as Record<string, unknown>;
    for (const key of editableFields) {
      if (Object.hasOwn(fields.updates, key)) pending[key] = fields.updates[key];
      else if (!Object.hasOwn(pending, key)) pending[key] = current[key];
    }
    const { data, error } = await service()
      .from("system_announcements")
      .update({ draft_payload: pending, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error)
      return c.json({ error: "The pending announcement version could not be saved." }, 500);
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action: "admin.announcement.draft_saved",
      targetType: "announcement",
      targetId: id,
      metadata: { fields: Object.keys(fields.updates) },
    });
    return c.json({ updated: true, announcement: data, pendingVersion: true });
  }

  const { data, error } = await service()
    .from("system_announcements")
    .update({ ...fields.updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return c.json({ error: "The announcement could not be saved." }, 500);
  if (!data) return c.json({ error: "That announcement was not found." }, 404);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.announcement.updated",
    targetType: "announcement",
    targetId: id,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { fields: Object.keys(fields.updates) },
  });
  return c.json({ updated: true, announcement: data });
};

export const handleAnnouncementPublish = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That announcement id is not valid." }, 400);
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const expectedVersion = readInteger(body.value, "expected_version", 1, 2_147_483_647);
  if (expectedVersion === null || expectedVersion === undefined)
    return c.json({ error: "Reload this announcement and try publishing again." }, 400);
  const { data: announcement, error: lookupError } = await service()
    .from("system_announcements")
    .select("internal_name")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) return c.json({ error: "The announcement could not be verified." }, 500);
  if (!announcement) return c.json({ error: "That announcement was not found." }, 404);
  if (isApkOnlyAnnouncementName(announcement.internal_name)) {
    return c.json(
      {
        error:
          "APK-only promotions cannot be published until trusted Android installation verification is deployed.",
      },
      409,
    );
  }
  const { data, error } = await service().rpc("publish_system_announcement", {
    p_announcement_id: id,
    p_admin_id: user.id,
    p_expected_version: expectedVersion,
  });
  if (error)
    return c.json(
      {
        error:
          error.code === "40001"
            ? "This announcement changed. Refresh it before publishing."
            : error.message || "The announcement could not be published.",
      },
      error.code === "40001" ? 409 : 400,
    );
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.announcement.published",
    targetType: "announcement",
    targetId: id,
    metadata: { version: data.version, state: data.state },
  });
  return c.json({ published: true, announcement: data });
};

export const handleAnnouncementVersions = async (c: Ctx) => {
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That announcement id is not valid." }, 400);
  const { data, error } = await service()
    .from("system_announcement_versions")
    .select("id,announcement_id,version,created_by,created_at,snapshot")
    .eq("announcement_id", id)
    .order("version", { ascending: false })
    .limit(50);
  if (error) return c.json({ error: "Announcement history could not be read." }, 500);
  return c.json({ versions: data ?? [] });
};

export const handleAnnouncementRestore = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That announcement id is not valid." }, 400);
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const version = readInteger(body.value, "version", 1, 2_147_483_647);
  if (!version) return c.json({ error: "Choose a valid version to restore." }, 400);
  const db = service();
  const { data: old, error: oldError } = await db
    .from("system_announcement_versions")
    .select("snapshot")
    .eq("announcement_id", id)
    .eq("version", version)
    .maybeSingle();
  if (oldError || !old) return c.json({ error: "That announcement version was not found." }, 404);
  const { data: current } = await db
    .from("system_announcements")
    .select("id,internal_name")
    .eq("id", id)
    .maybeSingle();
  if (!current) return c.json({ error: "That announcement was not found." }, 404);
  const snapshot = old.snapshot as Record<string, unknown>;
  const updates = announcementUpdates({ ...snapshot, state: "draft", active: false });
  if ("error" in updates) return c.json({ error: updates.error }, 400);
  if (
    isApkOnlyAnnouncementName(current.internal_name) &&
    !isApkOnlyAnnouncementName(updates.updates.internal_name)
  ) {
    updates.updates.internal_name = current.internal_name;
  }
  const { data, error } = await db
    .from("system_announcements")
    .update({
      ...updates.updates,
      active: false,
      state: "draft",
      draft_payload: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return c.json({ error: "The version could not be restored as a draft." }, 500);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.announcement.version_restored",
    targetType: "announcement",
    targetId: id,
    metadata: { version },
  });
  return c.json({ restored: true, announcement: data });
};

export const handleAnnouncementDelete = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That announcement id is not valid." }, 400);

  const { data: existing } = await service()
    .from("system_announcements")
    .select("id,title")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return c.json({ error: "That announcement was not found." }, 404);

  const { error } = await service().from("system_announcements").delete().eq("id", id);
  if (error) return c.json({ error: "The announcement could not be deleted." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.announcement.deleted",
    targetType: "announcement",
    targetId: id,
    reason: "removed_by_administrator",
    metadata: { title: existing.title },
  });
  return c.json({ deleted: true });
};

export const handleNotificationsList = async (c: Ctx) => {
  const { page, perPage } = paginate(c);
  const { data, error, count } = await service()
    .from("system_notifications")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (error) {
    return c.json(
      {
        error:
          "System notifications could not be read. Apply supabase/migrations/20261014000000_velori_admin_console.sql.",
      },
      500,
    );
  }
  return c.json({ notifications: data ?? [], total: count ?? 0, page, perPage });
};

/** Creates an administrator campaign and atomically delivers eligible recipients. */
export const handleNotificationCreate = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const title = readString(body.value, "title", 121);
  const message = readString(body.value, "message", 2001);
  const icon = readString(body.value, "icon", 61);
  const link = readString(body.value, "link", 301);
  const priority = readEnum(body.value, "priority", PRIORITIES);
  const audience = readEnum(body.value, "audience", NOTIFICATION_AUDIENCES);
  const startsAt = readString(body.value, "starts_at", 41);
  const endsAt = readString(body.value, "ends_at", 41);
  const audienceIds = body.value.audience_ids;

  if (
    title === null ||
    message === null ||
    icon === null ||
    link === null ||
    priority === null ||
    audience === null ||
    startsAt === null ||
    endsAt === null
  ) {
    return c.json({ error: "Notification fields must be the expected type." }, 400);
  }
  if (!title?.trim() || !message?.trim()) {
    return c.json({ error: "A notification needs both a title and a message." }, 400);
  }

  const finalAudience = audience ?? "all";
  const validatedAudience = validateCampaignAudience({
    audience: finalAudience,
    audienceIds,
    accountTypes: body.value.account_types,
    roleKeys: body.value.role_keys,
  });
  if (!validatedAudience.ok) return c.json({ error: validatedAudience.error }, 400);
  const validatedWindow = validateCampaignWindow(startsAt, endsAt);
  if (!validatedWindow.ok) return c.json({ error: validatedWindow.error }, 400);

  const db = service();
  const { data, error } = await db
    .from("system_notifications")
    .insert({
      title: title.trim(),
      message: message.trim(),
      icon: icon ?? "",
      link: link ?? "",
      priority: priority ?? "normal",
      audience: finalAudience,
      audience_ids: validatedAudience.audienceIds,
      audience_account_types: validatedAudience.accountTypes,
      audience_role_keys: validatedAudience.roleKeys,
      starts_at: validatedWindow.startsAt,
      ends_at: validatedWindow.endsAt,
      sent_at: null,
      recipient_count: 0,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) return c.json({ error: "The notification could not be sent." }, 500);

  const { data: recipientCount, error: deliveryError } = await db.rpc(
    "admin_dispatch_system_notification",
    { p_notification_id: data.id },
  );
  if (deliveryError || typeof recipientCount !== "number") {
    await db.from("system_notifications").delete().eq("id", data.id);
    console.error("Administrator notification delivery failed.");
    return c.json({ error: "The notification could not be delivered." }, 500);
  }

  const { data: deliveredCampaign } = await db
    .from("system_notifications")
    .select("*")
    .eq("id", data.id)
    .maybeSingle();

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.notification.sent",
    targetType: "notification",
    targetId: data.id,
    metadata: { audience: finalAudience, recipients: recipientCount },
  });
  return c.json({
    sent: true,
    recipientCount,
    notification: deliveredCampaign ?? {
      ...data,
      recipient_count: recipientCount,
      sent_at: new Date().toISOString(),
    },
  });
};

export const handleNotificationDelete = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That notification id is not valid." }, 400);
  const { error } = await service().from("system_notifications").delete().eq("id", id);
  if (error) return c.json({ error: "The notification could not be deleted." }, 500);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.notification.deleted",
    targetType: "notification",
    targetId: id,
    reason: "withdrawn_by_administrator",
  });
  return c.json({ deleted: true });
};

// ---------------------------------------------------------------------------
// Advertisements
// ---------------------------------------------------------------------------

const AD_PLACEMENTS = ["feed", "reels", "stories", "profile", "search", "groups"] as const;
const AD_STATUSES = ["draft", "scheduled", "active", "paused", "ended"] as const;

export const handleAdMediaUpload = async (c: Ctx) => {
  const { user } = c.get("admin");
  const form = await c.req.raw.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size)
    return c.json({ error: "Choose an image or MP4 video." }, 400);
  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes)
    return c.json({ error: "Advertisement media must be 10 MB or smaller." }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = (offset: number, pattern: number[]) =>
    bytes.length >= offset + pattern.length &&
    pattern.every((byte, index) => bytes[offset + index] === byte);
  const detected = signature(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ? "image/png"
    : signature(0, [0xff, 0xd8, 0xff])
      ? "image/jpeg"
      : signature(0, [0x52, 0x49, 0x46, 0x46]) && signature(8, [0x57, 0x45, 0x42, 0x50])
        ? "image/webp"
        : bytes.length > 12 && new TextDecoder().decode(bytes.subarray(4, 8)) === "ftyp"
          ? "video/mp4"
          : null;
  if (!detected || detected !== file.type)
    return c.json({ error: "The file contents do not match PNG, JPEG, WebP or MP4 format." }, 415);
  const ext = detected === "image/jpeg" ? "jpg" : detected.split("/")[1];
  const objectPath = `advertisements/${crypto.randomUUID()}.${ext}`;
  const { error } = await service()
    .storage.from("site-assets")
    .upload(objectPath, bytes, { contentType: detected, upsert: false });
  if (error) return c.json({ error: "The advertisement creative could not be stored." }, 500);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.ad.media_uploaded",
    targetType: "advertisement_media",
    targetId: objectPath,
    metadata: { type: detected, bytes: file.size },
  });
  return c.json({ url: publicAssetUrl(objectPath), path: objectPath, type: detected });
};

export const handleAdsList = async (c: Ctx) => {
  const { page, perPage } = paginate(c);
  const requestedStatus = c.req.query("status") ?? "";
  const status = readEnum({ status: requestedStatus }, "status", AD_STATUSES);
  const expiredOnly = requestedStatus === "expired";
  const search = (c.req.query("q") ?? "").trim().slice(0, 120);
  let request = service()
    .from("advertisements")
    .select("*", { count: "exact" })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (status) request = request.eq("status", status);
  if (expiredOnly) {
    request = request
      .not("ends_at", "is", null)
      .lte("ends_at", new Date().toISOString())
      .neq("status", "draft")
      .neq("status", "paused");
  }
  if (search) {
    const safe = search.replace(/[(),.%_\\]/g, " ").trim();
    request = request.or(
      `title.ilike.%${safe}%,campaign_name.ilike.%${safe}%,advertiser_name.ilike.%${safe}%`,
    );
  }
  const { data, error, count } = await request;
  if (error) {
    return c.json(
      {
        error:
          "Advertisements could not be read. Apply supabase/migrations/20261014000000_velori_admin_console.sql.",
      },
      500,
    );
  }
  const countAt = new Date().toISOString();
  const countQueries = await Promise.all([
    service()
      .from("advertisements")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    service()
      .from("advertisements")
      .select("id", { count: "exact", head: true })
      .eq("status", "paused"),
    service()
      .from("advertisements")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .or(`starts_at.is.null,starts_at.lte.${countAt}`)
      .or(`ends_at.is.null,ends_at.gt.${countAt}`),
    service()
      .from("advertisements")
      .select("id", { count: "exact", head: true })
      .or(`status.eq.scheduled,and(status.eq.active,starts_at.gt.${countAt})`),
    service()
      .from("advertisements")
      .select("id", { count: "exact", head: true })
      .not("ends_at", "is", null)
      .lte("ends_at", countAt)
      .neq("status", "draft")
      .neq("status", "paused"),
    service().from("advertisements").select("id", { count: "exact", head: true }),
  ]);
  const countError = countQueries.find((result) => result.error);
  if (countError) return c.json({ error: "Advertisement status totals could not be read." }, 500);
  return c.json({
    advertisements: data ?? [],
    total: count ?? 0,
    page,
    perPage,
    counts: {
      draft: countQueries[0].count ?? 0,
      paused: countQueries[1].count ?? 0,
      active: countQueries[2].count ?? 0,
      scheduled: countQueries[3].count ?? 0,
      expired: countQueries[4].count ?? 0,
      total: countQueries[5].count ?? 0,
    },
  });
};

function adUpdates(source: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  const campaignName = readString(source, "campaign_name", 121);
  const advertiserName = readString(source, "advertiser_name", 121);
  const ctaLabel = readString(source, "cta_label", 33);
  const creativeType = readEnum(source, "creative_type", [
    "image",
    "video",
    "link",
    "html",
  ] as const);
  const customHtml = readString(source, "custom_html", MAX_PAGE_HTML_LENGTH);
  const customCss = readString(source, "custom_css", MAX_PAGE_CSS_LENGTH);
  const title = readString(source, "title", 121);
  const body = readString(source, "body", 601);
  const imageUrl = readString(source, "image_url", 2049);
  const targetUrl = readString(source, "target_url", 2049);
  const placement = readEnum(source, "placement", AD_PLACEMENTS);
  const status = readEnum(source, "status", AD_STATUSES);
  const priority = readInteger(source, "priority", 0, 100);
  const startsAt = readString(source, "starts_at", 41);
  const endsAt = readString(source, "ends_at", 41);

  if (
    title === null ||
    body === null ||
    imageUrl === null ||
    targetUrl === null ||
    placement === null ||
    status === null ||
    priority === null ||
    startsAt === null ||
    endsAt === null ||
    campaignName === null ||
    advertiserName === null ||
    ctaLabel === null ||
    creativeType === null ||
    customHtml === null ||
    customCss === null
  ) {
    return { error: "Advertisement fields must be the expected type." as const };
  }
  if (title !== undefined) updates.title = title;
  if (body !== undefined) updates.body = body;
  if (imageUrl !== undefined) {
    if (imageUrl && !isSafeAdUrl(imageUrl)) {
      return { error: "Creative URL must be a secure web address or a site path." as const };
    }
    updates.image_url = imageUrl;
  }
  if (targetUrl !== undefined) {
    if (targetUrl && !isSafeAdUrl(targetUrl)) {
      return { error: "Destination must be a web address or a local VELORI page." as const };
    }
    updates.target_url = targetUrl;
  }
  if (placement !== undefined) updates.placement = placement;
  if (status !== undefined) updates.status = status;
  if (priority !== undefined) updates.priority = priority;
  if (campaignName !== undefined) updates.campaign_name = campaignName.trim();
  if (advertiserName !== undefined) {
    if (!advertiserName.trim()) return { error: "An advertiser name is required." as const };
    updates.advertiser_name = advertiserName.trim();
  }
  if (ctaLabel !== undefined) {
    if (!ctaLabel.trim()) return { error: "A call to action is required." as const };
    updates.cta_label = ctaLabel.trim();
  }
  if (creativeType !== undefined) updates.creative_type = creativeType;
  if (customHtml !== undefined) updates.custom_html = sanitizeCustomHtml(customHtml);
  if (customCss !== undefined) {
    const cssError = validateCustomCss(customCss);
    if (cssError) return { error: cssError };
    updates.custom_css = customCss;
  }
  if (startsAt !== undefined) {
    if (startsAt && Number.isNaN(Date.parse(startsAt))) {
      return { error: "Start date is not a valid date." as const };
    }
    updates.starts_at = startsAt ? new Date(startsAt).toISOString() : null;
  }
  if (endsAt !== undefined) {
    if (endsAt && Number.isNaN(Date.parse(endsAt))) {
      return { error: "End date is not a valid date." as const };
    }
    updates.ends_at = endsAt ? new Date(endsAt).toISOString() : null;
  }
  if (
    updates.ends_at &&
    updates.starts_at &&
    new Date(updates.ends_at as string) <= new Date(updates.starts_at as string)
  ) {
    return { error: "The end date must be after the start date." as const };
  }
  return { updates };
}

function isSafeAdUrl(value: string) {
  if (value.startsWith("/")) return !value.startsWith("//") && !/[\u0000-\u001f\\]/.test(value);
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export const handleAdCreate = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const title = readString(body.value, "title", 121);
  if (title === null || !title?.trim()) {
    return c.json({ error: "An advertisement needs a title." }, 400);
  }
  const fields = adUpdates(body.value);
  if ("error" in fields) return c.json({ error: fields.error }, 400);

  const { data, error } = await service()
    .from("advertisements")
    .insert({
      ...fields.updates,
      title: title.trim(),
      // Always created inactive. Activating an advertisement is a separate,
      // audited decision.
      status: fields.updates.status ?? "draft",
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) return c.json({ error: "The advertisement could not be created." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.ad.created",
    targetType: "advertisement",
    targetId: data.id,
    metadata: { placement: data.placement, status: data.status },
  });
  return c.json({ created: true, advertisement: data });
};

export const handleAdPatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That advertisement id is not valid." }, 400);
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const fields = adUpdates(body.value);
  if ("error" in fields) return c.json({ error: fields.error }, 400);
  if (Object.keys(fields.updates).length === 0) {
    return c.json({ error: "No recognised advertisement fields were supplied." }, 400);
  }

  const { data, error } = await service()
    .from("advertisements")
    .update({ ...fields.updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return c.json({ error: "The advertisement could not be saved." }, 500);
  if (!data) return c.json({ error: "That advertisement was not found." }, 404);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.ad.updated",
    targetType: "advertisement",
    targetId: id,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { fields: Object.keys(fields.updates) },
  });
  return c.json({ updated: true, advertisement: data });
};

export const handleAdDelete = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That advertisement id is not valid." }, 400);
  const { error } = await service().from("advertisements").delete().eq("id", id);
  if (error) return c.json({ error: "The advertisement could not be deleted." }, 500);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.ad.deleted",
    targetType: "advertisement",
    targetId: id,
    reason: "removed_by_administrator",
  });
  return c.json({ deleted: true });
};

export const handleAdPublish = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That advertisement id is not valid." }, 400);
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const expectedVersion = readInteger(body.value, "expected_version", 1, 2_147_483_647);
  if (expectedVersion === null || expectedVersion === undefined)
    return c.json({ error: "Reload this advertisement and try publishing again." }, 400);
  const { data, error } = await service().rpc("publish_advertisement", {
    p_advertisement_id: id,
    p_admin_id: user.id,
    p_expected_version: expectedVersion,
  });
  if (error)
    return c.json(
      {
        error:
          error.code === "40001"
            ? "This advertisement changed. Refresh it before publishing."
            : error.message || "The advertisement could not be published.",
      },
      error.code === "40001" ? 409 : 400,
    );
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.ad.published",
    targetType: "advertisement",
    targetId: id,
    metadata: { version: data.version, status: data.status },
  });
  return c.json({ published: true, advertisement: data });
};

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export const handleFeatureFlagsList = async (c: Ctx) => {
  const { data, error } = await service().from("feature_flags").select("*").order("key");
  if (error) return c.json({ error: "Feature flags could not be read." }, 500);

  // Tell the console which flags actually gate behaviour, so a toggle that does
  // nothing is not presented as if it did.
  const consumed: Record<string, string> = {
    messaging_enabled: "Hides the Messages navigation entry.",
    notifications_enabled: "Hides the Notifications navigation entry.",
    reels_enabled: "Reels landing state.",
    stories_enabled: "Stories landing state.",
    groups_enabled: "Groups landing state.",
    ads_enabled: "Advertisement surfaces.",
    creator_tools_enabled: "Creator and business tools.",
    profile_qr_enabled: "Profile QR code.",
    new_home_feed: "New home feed experience.",
    experimental_ui: "Experimental interface features.",
  };

  return c.json({
    flags: data ?? [],
    consumed,
    roles: ADMIN_ROLE_KEYS,
  });
};

export const handleFeatureFlagPatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const key = c.req.param("key");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const enabled = readBoolean(body.value, "enabled");
  const rollout = readInteger(body.value, "rollout", 0, 100);
  const description = readString(body.value, "description", 401);
  const roles = body.value.roles;

  if (enabled === null || rollout === null || description === null) {
    return c.json({ error: "Feature flag fields must be the expected type." }, 400);
  }
  if (roles !== undefined && !Array.isArray(roles)) {
    return c.json({ error: "roles must be a list of role keys." }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (enabled !== undefined) updates.enabled = enabled;
  if (rollout !== undefined) updates.rollout = rollout;
  if (description !== undefined) updates.description = description;
  if (roles !== undefined) {
    const valid = roles.filter(
      (value): value is AdminRoleKey =>
        typeof value === "string" && ADMIN_ROLE_KEYS.includes(value as AdminRoleKey),
    );
    if (valid.length !== roles.length) {
      return c.json({ error: "roles contains an unknown role key." }, 400);
    }
    updates.roles = valid;
  }
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No recognised feature flag fields were supplied." }, 400);
  }

  const { data, error } = await service()
    .from("feature_flags")
    .update({ ...updates, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("key", key)
    .select("*")
    .maybeSingle();
  if (error) return c.json({ error: "The feature flag could not be saved." }, 500);
  if (!data) {
    return c.json(
      {
        error: `No feature flag named "${key}" exists. Flags are defined by migration, not created here, so an unknown key can never take effect.`,
        code: "unknown_flag",
      },
      404,
    );
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.feature_flag.updated",
    targetType: "feature_flag",
    targetId: key,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { fields: Object.keys(updates) },
  });
  return c.json({ updated: true, flag: data });
};

// ---------------------------------------------------------------------------
// Platform settings
// ---------------------------------------------------------------------------

const BOOLEAN_PLATFORM_FIELDS = [
  "registration_enabled",
  "email_verification_required",
  "default_private_accounts",
  "posting_enabled",
  "comments_enabled",
  "uploads_enabled",
  "messaging_enabled",
  "content_moderation_enabled",
  "reduce_motion_safe_mode",
  "emergency_mode",
] as const;

const INTEGER_PLATFORM_FIELDS: Record<string, { min: number; max: number; column: string }> = {
  max_upload_mb: { min: 1, max: 100, column: "max_upload_mb" },
  max_post_chars: { min: 1, max: 10000, column: "max_post_chars" },
  max_comment_chars: { min: 1, max: 5000, column: "max_comment_chars" },
  max_reel_seconds: { min: 1, max: 600, column: "max_reel_seconds" },
  max_story_count: { min: 1, max: 50, column: "max_story_count" },
  posts_per_hour: { min: 1, max: 1000, column: "posts_per_hour" },
  comments_per_hour: { min: 1, max: 5000, column: "comments_per_hour" },
  username_min_length: { min: 3, max: 24, column: "username_min_length" },
  username_max_length: { min: 3, max: 30, column: "username_max_length" },
  require_admin_reauth_minutes: { min: 1, max: 120, column: "require_admin_reauth_minutes" },
  admin_session_timeout_minutes: { min: 5, max: 1440, column: "admin_session_timeout_minutes" },
};

export const handlePlatformSettingsGet = async (c: Ctx) => {
  const { data, error } = await service()
    .from("platform_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    return c.json(
      {
        error:
          "Platform settings could not be read. Apply supabase/migrations/20261014000000_velori_admin_console.sql.",
      },
      500,
    );
  }
  const { data: site } = await service()
    .from("site_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  return c.json({
    settings: data ?? null,
    // maintenance_mode and the animation URLs live in site_settings, which the
    // public shell already reads. Surfaced here so one screen shows the whole
    // platform configuration without pretending there are two sources of truth.
    maintenance: {
      maintenanceMode: site?.maintenance_mode ?? false,
      animationUrls: {
        startup: site?.startup_animation_url ?? null,
        error: site?.error_animation_url ?? null,
        maintenance: site?.maintenance_animation_url ?? null,
      },
    },
  });
};

export const handlePlatformSettingsPut = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const update: Record<string, unknown> = {};

  for (const field of BOOLEAN_PLATFORM_FIELDS) {
    const value = readBoolean(body.value, field);
    if (value === null) {
      return c.json({ error: `${field} must be true or false.` }, 400);
    }
    if (value !== undefined) update[field] = value;
  }

  for (const [key, spec] of Object.entries(INTEGER_PLATFORM_FIELDS)) {
    const value = readInteger(body.value, key, spec.min, spec.max);
    if (value === null) {
      return c.json({ error: `${key} must be a number between ${spec.min} and ${spec.max}.` }, 400);
    }
    if (value !== undefined) update[spec.column] = value;
  }

  const defaultLanguage = readString(body.value, "default_language", 10);
  if (defaultLanguage === null) {
    return c.json({ error: "default_language must be text." }, 400);
  }
  if (defaultLanguage !== undefined) update.default_language = defaultLanguage;

  const defaultTheme = readEnum(body.value, "default_theme", ["system", "light", "dark"] as const);
  if (defaultTheme === null) {
    return c.json({ error: "default_theme must be system, light or dark." }, 400);
  }
  if (defaultTheme !== undefined) update.default_theme = defaultTheme;

  const emergencyMessage = readString(body.value, "emergency_message", 401);
  if (emergencyMessage === null) {
    return c.json({ error: "emergency_message must be text." }, 400);
  }
  if (emergencyMessage !== undefined) update.emergency_message = emergencyMessage;

  // maintenance_mode is written to site_settings, not duplicated here.
  const maintenanceMode = readBoolean(body.value, "maintenance_mode");
  if (maintenanceMode === null) {
    return c.json({ error: "maintenance_mode must be true or false." }, 400);
  }

  const usernameMin = update.username_min_length as number | undefined;
  const usernameMax = update.username_max_length as number | undefined;
  if (usernameMin !== undefined && usernameMax !== undefined && usernameMax < usernameMin) {
    return c.json({ error: "username_max_length must be at least username_min_length." }, 400);
  }

  if (Object.keys(update).length === 0 && maintenanceMode === undefined) {
    return c.json({ error: "No recognised platform settings were supplied." }, 400);
  }

  // Emergency mode and maintenance mode both change who can use the platform, so
  // they need a fresh password confirmation and always leave an audit trail.
  const touchingCritical = update.emergency_mode !== undefined || maintenanceMode !== undefined;
  if (touchingCritical) {
    const blocked = await requireRecentReauth(c, 10);
    if (blocked) return blocked;
  }

  const db = service();
  const now = new Date().toISOString();

  if (Object.keys(update).length > 0) {
    update.updated_by = user.id;
    update.updated_at = now;
    const { error } = await db.from("platform_settings").update(update).eq("id", true);
    if (error) {
      return c.json({ error: "Platform settings could not be saved." }, 500);
    }
  }

  if (maintenanceMode !== undefined) {
    const { error } = await db
      .from("site_settings")
      .update({ maintenance_mode: maintenanceMode, updated_by: user.id, updated_at: now })
      .eq("id", true);
    if (error) {
      return c.json({ error: "Maintenance mode could not be changed." }, 500);
    }
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.settings.platform_updated",
    targetType: "platform_settings",
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: {
      fields: [
        ...Object.keys(update).filter((key) => !key.startsWith("updated_")),
        ...(maintenanceMode !== undefined ? ["maintenance_mode"] : []),
      ],
    },
  });

  const { data: fresh } = await db
    .from("platform_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  return c.json({ updated: true, settings: fresh ?? null });
};

/** Emergency lockdown. Super-admin only, re-authenticated, fully audited, and
 * deliberately implemented as its own endpoint rather than a settings field so
 * it cannot be triggered by a bulk settings save. */
export const handleEmergencyMode = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const enabled = readBoolean(body.value, "enabled");
  const message = readString(body.value, "message", 401);
  const reason = readString(body.value, "reason", 2001);
  if (enabled === null || message === null || reason === null) {
    return c.json({ error: "Those fields must be the expected type." }, 400);
  }
  if (enabled === undefined) {
    return c.json({ error: "Specify whether emergency mode should be on or off." }, 400);
  }
  if ((reason ?? "").trim().length < 8) {
    return c.json(
      { error: "Changing maintenance mode requires a reason of at least 8 characters." },
      400,
    );
  }

  const blocked = await requireRecentReauth(c, 5);
  if (blocked) return blocked;

  const db = service();
  const now = new Date().toISOString();

  // Maintenance is stored in site_settings and consumed by the public shell.
  // Do not rewrite unrelated platform switches here: doing so made turning
  // maintenance off silently enable posting, uploads, messaging and signup.
  const { data: site, error: siteError } = await db
    .from("site_settings")
    .update({ maintenance_mode: enabled, updated_by: user.id, updated_at: now })
    .eq("id", true)
    .select("maintenance_mode")
    .maybeSingle();
  if (siteError) {
    return c.json(
      {
        error: enabled
          ? "The maintenance page could not be enabled."
          : "Maintenance mode could not be disabled.",
      },
      500,
    );
  }
  if (!site || site.maintenance_mode !== enabled) {
    return c.json({ error: "Maintenance mode was not saved. Reload settings and try again." }, 500);
  }

  let warning: string | null = null;
  if (enabled) {
    await db.from("system_announcements").insert({
      title: "VELORI is temporarily unavailable",
      message: message ?? "We are carrying out urgent platform work.",
      priority: "critical",
      audience: "all",
      dismissible: false,
      active: true,
      created_by: user.id,
    });
  } else {
    // Clear the fixed announcement created by the emergency action so it does
    // not continue telling visitors that the site is unavailable after recovery.
    const { error: announcementError } = await db
      .from("system_announcements")
      .update({ active: false })
      .eq("title", "VELORI is temporarily unavailable")
      .eq("priority", "critical")
      .eq("active", true);
    if (announcementError) {
      warning = "Maintenance is off, but the recovery announcement could not be cleared.";
    }
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: enabled ? "admin.emergency.enabled" : "admin.emergency.disabled",
    targetType: "site_settings",
    reason: reason ?? "",
    metadata: { message: message ?? "", warning },
  });

  return c.json({ applied: true, settings: site, warning });
};

// ---------------------------------------------------------------------------
// Administrators and roles
// ---------------------------------------------------------------------------

export const handleAdminsList = async (c: Ctx) => {
  const db = service();
  const { data: profiles, error } = await db
    .from("admin_profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return c.json({ error: "Administrators could not be read." }, 500);

  const { data: credentials } = await db
    .from("admin_accounts")
    .select("user_id,username,enabled,must_change_password");
  const accountByUser = new Map((credentials ?? []).map((account) => [account.user_id, account]));
  const rows = (profiles ?? []).map((profile) => {
    const account = accountByUser.get(profile.user_id);
    return {
      ...profile,
      username: account?.username ?? null,
      enabled: Boolean(account?.enabled),
      must_change_password: Boolean(account?.must_change_password ?? profile.must_change_password),
      isCurrent: profile.user_id === c.get("admin").user.id,
    };
  });

  const { data: sessions } = await db
    .from("admin_sessions")
    .select("admin_user_id")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());
  const sessionCounts = new Map<string, number>();
  for (const session of sessions ?? []) {
    const key = session.admin_user_id as string;
    sessionCounts.set(key, (sessionCounts.get(key) ?? 0) + 1);
  }

  return c.json({
    administrators: rows.map((row) => ({
      ...row,
      activeSessions: sessionCounts.get(row.user_id as string) ?? 0,
    })),
    roles: await listRoles(),
    permissions: await listPermissions(),
  });
};
async function listRoles() {
  const { data } = await service()
    .from("admin_roles")
    .select("*")
    .order("rank", { ascending: false });
  return data ?? [];
}

async function listPermissions() {
  const { data } = await service()
    .from("admin_permissions")
    .select("*")
    .order("category")
    .order("sort_order");
  return data ?? [];
}

export const handleAdminsCreate = async (c: Ctx) => {
  const { user } = c.get("admin");
  const blocked = await requireRecentReauth(c, 10);
  if (blocked) return blocked;

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const username = readString(body.value, "username", 65);
  const password = readSecret(body.value, "password", 201);
  const roleKey = readEnum(body.value, "role_key", ADMIN_ROLE_KEYS);
  const displayName = readString(body.value, "display_name", 81);
  const mustChangePassword = readBoolean(body.value, "must_change_password");
  const mfaRequired = readBoolean(body.value, "mfa_required");
  if (
    username === null ||
    password === null ||
    roleKey === null ||
    displayName === null ||
    mustChangePassword === null ||
    mfaRequired === null
  ) {
    return c.json({ error: "Those fields must be the expected type." }, 400);
  }
  if (!username || !isValidUsername(username)) {
    return c.json({ error: "Enter a valid administrator username." }, 400);
  }
  if (!password || !isValidNewPassword(password)) {
    return c.json({ error: "Use a password between 12 and 200 characters." }, 400);
  }
  if (!roleKey) return c.json({ error: "Choose a role for this administrator." }, 400);

  const db = service();
  const { data: existing } = await db
    .from("admin_accounts")
    .select("id,username")
    .ilike("username", username)
    .limit(20);
  if (
    (existing ?? []).some(
      (account) =>
        normalizeUsername(String(account.username ?? "")) === normalizeUsername(username),
    )
  ) {
    return c.json({ error: "That administrator username is already in use." }, 409);
  }

  const identityEmail = adminIdentityEmail(username);
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const internalPassword = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const { data: authResult, error: authError } = await db.auth.admin.createUser({
    email: identityEmail,
    password: internalPassword,
    email_confirm: true,
    user_metadata: { administrator_identity: true },
  });
  if (authError || !authResult.user) {
    return c.json(
      { error: "The administrator account could not be created.", code: "identity_conflict" },
      authError?.code === "email_exists" ? 409 : 500,
    );
  }

  const userId = authResult.user.id;
  const forcePasswordChange = mustChangePassword !== false;
  const now = new Date().toISOString();
  const { data: profile, error: profileError } = await db
    .from("admin_profiles")
    .insert({
      user_id: userId,
      role: roleKey === "super_admin" ? "super_admin" : "admin",
      role_key: roleKey,
      display_name: displayName || username,
      is_active: true,
      mfa_required: mfaRequired === true,
      must_change_password: forcePasswordChange,
      provisioned_by: "administrator",
    })
    .select("*")
    .single();
  if (profileError) {
    await db.auth.admin.deleteUser(userId);
    return c.json({ error: "The administrator profile could not be created." }, 500);
  }

  const passwordHash = await hashPassword(password);
  const { error: credentialError } = await db.from("admin_accounts").insert({
    user_id: userId,
    username,
    password_hash: passwordHash,
    role_key: roleKey,
    enabled: true,
    must_change_password: forcePasswordChange,
    password_changed_at: forcePasswordChange ? null : now,
  });
  if (credentialError) {
    await db.from("admin_profiles").delete().eq("user_id", userId);
    await db.auth.admin.deleteUser(userId);
    return c.json(
      { error: "The administrator credential could not be created.", code: "username_conflict" },
      credentialError.code === "23505" ? 409 : 500,
    );
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.administrator.created",
    targetType: "user",
    targetId: userId,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { roleKey, username },
  });
  return c.json({
    created: true,
    administrator: {
      ...profile,
      username,
      enabled: true,
      must_change_password: forcePasswordChange,
    },
  });
};
export const handleAdminsPatch = async (c: Ctx) => {
  const principal = c.get("admin");
  const { user } = principal;
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That account id is not valid." }, 400);
  if (id === user.id) {
    return c.json({ error: "You cannot change your own administrator access." }, 400);
  }

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const roleKey = readEnum(body.value, "role_key", ADMIN_ROLE_KEYS);
  const isActive = readBoolean(body.value, "is_active");
  const displayName = readString(body.value, "display_name", 81);
  const sessionTimeout = readInteger(body.value, "session_timeout_minutes", 5, 1440);
  if (roleKey === null || isActive === null || displayName === null || sessionTimeout === null) {
    return c.json({ error: "Those fields must be the expected type." }, 400);
  }

  const update: Record<string, unknown> = {};
  if (roleKey !== undefined) {
    update.role_key = roleKey;
    update.role = roleKey === "super_admin" ? "super_admin" : "admin";
  }
  if (isActive !== undefined) update.is_active = isActive;
  if (displayName !== undefined) update.display_name = displayName;
  if (sessionTimeout !== undefined) update.session_timeout_minutes = sessionTimeout;
  if (Object.keys(update).length === 0) {
    return c.json({ error: "No recognised administrator fields were supplied." }, 400);
  }

  const requiredPermission = roleKey !== undefined ? "admins.create" : "admins.disable";
  if (!principal.permissions.has(requiredPermission)) {
    return c.json(
      {
        error: `Your role does not include the "${requiredPermission}" permission.`,
        code: "forbidden",
      },
      403,
    );
  }

  // Removing the final active super administrator is refused by a database
  // trigger as well; checking here produces a clearer message.
  if (isActive === false || (roleKey && roleKey !== "super_admin")) {
    const { data: current } = await service()
      .from("admin_profiles")
      .select("role_key,is_active")
      .eq("user_id", id)
      .maybeSingle();
    if (current?.role_key === "super_admin" && current.is_active) {
      const { count } = await service()
        .from("admin_profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("role_key", "super_admin")
        .eq("is_active", true);
      if ((count ?? 0) <= 1) {
        return c.json(
          {
            error: "This is the only active super administrator. Promote another one first.",
            code: "last_super_admin",
          },
          409,
        );
      }
    }
  }

  const db = service();
  const { data, error } = await db
    .from("admin_profiles")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("user_id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    const message =
      error.code === "42501"
        ? "That change would remove the final active super administrator."
        : "The administrator could not be saved.";
    return c.json({ error: message }, error.code === "42501" ? 409 : 500);
  }
  if (!data) return c.json({ error: "That administrator was not found." }, 404);

  const credentialUpdate: Record<string, unknown> = {};
  if (isActive !== undefined) credentialUpdate.enabled = isActive;
  if (roleKey !== undefined) credentialUpdate.role_key = roleKey;
  if (Object.keys(credentialUpdate).length > 0) {
    await db.from("admin_accounts").update(credentialUpdate).eq("user_id", id);
  }

  if (isActive === false) {
    await db
      .from("admin_sessions")
      .update({
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
        revoke_reason: "administrator_disabled",
      })
      .eq("admin_user_id", id)
      .is("revoked_at", null);
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.administrator.updated",
    targetType: "user",
    targetId: id,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { fields: Object.keys(update) },
  });
  return c.json({ updated: true, administrator: data });
};

export const handleAdminsDelete = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That account id is not valid." }, 400);
  if (id === user.id) {
    return c.json({ error: "You cannot delete your own account." }, 400);
  }
  const blocked = await requireRecentReauth(c, 10);
  if (blocked) return blocked;

  const db = service();
  const { data: target } = await db
    .from("admin_profiles")
    .select("user_id,role_key,is_active")
    .eq("user_id", id)
    .maybeSingle();
  if (!target) return c.json({ error: "That administrator was not found." }, 404);

  if (target.role_key === "super_admin" && target.is_active) {
    const { count } = await db
      .from("admin_profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("role_key", "super_admin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      return c.json(
        {
          error: "This is the only active super administrator. Promote another one first.",
          code: "last_super_admin",
        },
        409,
      );
    }
  }

  // Removing administrator access only. The auth identity and the account itself
  // are left untouched, so this never deletes a user.
  await db
    .from("admin_sessions")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
      revoke_reason: "administrator_removed",
    })
    .eq("admin_user_id", id)
    .is("revoked_at", null);

  await db.from("admin_accounts").update({ enabled: false }).eq("user_id", id);

  const { error } = await db.from("admin_profiles").delete().eq("user_id", id);
  if (error) {
    return c.json({ error: "Administrator access could not be removed." }, 500);
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.administrator.removed",
    targetType: "user",
    targetId: id,
    reason:
      readString(
        await readJson(c.req.raw).catch(() => ({ ok: false as const, error: "" })),
        "reason",
        2001,
      ) ?? "",
  });
  return c.json({ removed: true });
};

export const handleRolesList = async (c: Ctx) => {
  const [roles, permissions, grants] = await Promise.all([
    listRoles(),
    listPermissions(),
    service().from("admin_role_permissions").select("role_key,permission_key"),
  ]);
  return c.json({
    roles,
    permissions,
    grants: grants.data ?? [],
  });
};

export const handleRolePatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const roleKey = c.req.param("key");
  if (typeof roleKey !== "string" || !(ADMIN_ROLE_KEYS as readonly string[]).includes(roleKey)) {
    return c.json({ error: "That role does not exist." }, 404);
  }
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const permissions = body.value.permissions;
  if (!Array.isArray(permissions)) {
    return c.json({ error: "Provide the full list of permission keys for this role." }, 400);
  }
  const { data: known } = await service().from("admin_permissions").select("key");
  const knownKeys = new Set(((known ?? []) as { key: string }[]).map((row) => row.key));
  const requested = permissions.filter((value): value is string => typeof value === "string");
  const unknown = requested.filter((key) => !knownKeys.has(key));
  if (unknown.length > 0) {
    return c.json({ error: `Unknown permission keys: ${unknown.join(", ")}.` }, 400);
  }
  if (roleKey === "super_admin" && requested.length !== knownKeys.size) {
    return c.json({ error: "The super administrator role always holds every permission." }, 409);
  }

  const db = service();
  const { error: deleteError } = await db
    .from("admin_role_permissions")
    .delete()
    .eq("role_key", roleKey);
  if (deleteError) {
    return c.json({ error: "The role's permissions could not be replaced." }, 500);
  }
  if (requested.length > 0) {
    const { error } = await db
      .from("admin_role_permissions")
      .insert(requested.map((key) => ({ role_key: roleKey, permission_key: key })));
    if (error) {
      return c.json({ error: "The role's permissions could not be saved." }, 500);
    }
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.role.permissions_updated",
    targetType: "role",
    targetId: roleKey,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { count: requested.length },
  });
  return c.json({ updated: true, roleKey, permissions: requested });
};

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

export const handleEmailsList = async (c: Ctx) => {
  const db = service();
  const { data, error } = await db.from("email_template_configs").select("*").order("key");
  if (error) {
    return c.json(
      {
        error:
          "Email templates could not be read. Apply supabase/migrations/20261014000000_velori_admin_console.sql.",
      },
      500,
    );
  }
  const keys = (data ?? []).map((row) => row.key as string);
  const { data: history } = keys.length
    ? await db
        .from("email_template_versions")
        .select("template_key,version,subject,created_at,note")
        .in("template_key", keys)
        .order("version", { ascending: false })
    : { data: [] as unknown[] };

  return c.json({
    templates: (data ?? []).map((row) => ({
      ...row,
      history: ((history ?? []) as { template_key: string }[]).filter(
        (version) => version.template_key === row.key,
      ),
    })),
    // Stated up front so nobody expects to configure mail credentials here.
    credentials: {
      stored: "Edge Function secrets",
      visible: false,
      note: "SMTP host, username and password are Edge Function secrets. They are never stored in this table and never returned by any endpoint.",
    },
  });
};

export const handleEmailPatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const key = c.req.param("key");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const subject = readString(body.value, "subject", 201);
  const heading = readString(body.value, "heading", 201);
  const bodyHtml = readString(body.value, "body_html", 40_000);
  const bodyText = readString(body.value, "body_text", 20_000);
  const enabled = readBoolean(body.value, "enabled");
  if (
    subject === null ||
    heading === null ||
    bodyHtml === null ||
    bodyText === null ||
    enabled === null
  ) {
    return c.json({ error: "Email template fields must be the expected type." }, 400);
  }

  const update: Record<string, unknown> = {};
  if (subject !== undefined) update.subject = subject;
  if (heading !== undefined) update.heading = heading;
  if (bodyHtml !== undefined) update.body_html = bodyHtml;
  if (bodyText !== undefined) update.body_text = bodyText;
  if (enabled !== undefined) update.enabled = enabled;
  if (Object.keys(update).length === 0) {
    return c.json({ error: "No recognised email template fields were supplied." }, 400);
  }

  const db = service();
  const { data: current } = await db
    .from("email_template_configs")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (!current) return c.json({ error: "That email template was not found." }, 404);

  // Snapshot the outgoing copy so an edit can be rolled back.
  const version = ((current.version as number) ?? 1) + 1;
  await db.from("email_template_versions").insert({
    template_key: key,
    version: current.version,
    subject: current.subject,
    heading: current.heading,
    body_html: current.body_html,
    body_text: current.body_text,
    note: "Replaced by a newer template",
    created_by: user.id,
  });

  const { data, error } = await db
    .from("email_template_configs")
    .update({ ...update, version, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq("key", key)
    .select("*")
    .single();
  if (error) return c.json({ error: "The email template could not be saved." }, 500);

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.email_template.updated",
    targetType: "email_template",
    targetId: key,
    reason: readString(body.value, "reason", 2001) ?? "",
    metadata: { fields: Object.keys(update), version },
  });
  return c.json({ updated: true, template: data });
};

/**
 * Test send. Deliberately reports "not configured" instead of pretending to send:
 * this deployment has no SMTP relay secret wired into the function, and a control
 * that silently does nothing is worse than one that says so.
 */
export const handleEmailTestSend = async (c: Ctx) => {
  await writeAudit(c.req.raw, {
    adminUserId: c.get("admin").user.id,
    action: "admin.email_template.test_send_unavailable",
    targetType: "email_template",
    targetId: c.req.param("key"),
    reason: "no_smtp_relay_configured",
    result: "failure",
  });
  return c.json(
    {
      error:
        "Test sending is not configured. Supabase sends transactional email through the project's own SMTP provider, which this function cannot reach directly.",
      code: "not_configured",
      howToVerify:
        "Use Supabase Auth email templates to confirm delivery, or configure a relay and add a send endpoint that uses it.",
    },
    501,
  );
};

// ---------------------------------------------------------------------------
// Video / motion uploads
// ---------------------------------------------------------------------------

/** Motion graphic upload. Kept separate from branding so the two have different
 * size limits, and magic-byte checked for the same reason. */
export const handleMotionUpload = async (c: Ctx) => {
  const { user } = c.get("admin");
  const declaredLength = Number.parseInt(c.req.header("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ANIMATION_UPLOAD_BYTES + 8192) {
    return c.json({ error: "Motion files must be 10 MB or smaller." }, 413);
  }

  const form = await c.req.raw.formData().catch(() => null);
  const file = form?.get("file");
  const target = form?.get("target");
  const key = form?.get("key");
  if (!(file instanceof File)) return c.json({ error: "No file was uploaded." }, 400);
  if (target !== "library") {
    return c.json(
      { error: "Motion uploads must be added to the draftable animation library." },
      400,
    );
  }
  if (typeof key !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(key)) {
    return c.json({ error: "Choose an animation from the library first." }, 400);
  }
  if (file.type !== "video/mp4") {
    return c.json({ error: "Motion graphics must be MP4 video." }, 415);
  }
  if (file.size === 0) return c.json({ error: "The uploaded file is empty." }, 400);
  if (file.size > MAX_ANIMATION_UPLOAD_BYTES) {
    return c.json({ error: "Motion files must be 10 MB or smaller." }, 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const isMp4 =
    bytes.length >= 8 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70;
  if (!isMp4) {
    return c.json({ error: "The file contents are not MP4 video." }, 415);
  }

  const objectPath = `motion/library-${key}-${crypto.randomUUID()}.mp4`;
  const { error: uploadError } = await service()
    .storage.from("site-assets")
    .upload(objectPath, bytes, { contentType: "video/mp4", upsert: false });
  if (uploadError) return c.json({ error: "The file could not be stored." }, 500);

  const publicUrl = publicAssetUrl(objectPath);
  const { data: updated, error } = await service()
    .from("animation_configs")
    .update({
      media_url: publicUrl,
      media_mime_type: file.type,
      media_byte_size: bytes.byteLength,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("key", key)
    .select("key")
    .maybeSingle();
  if (error || !updated) {
    await service().storage.from("site-assets").remove([objectPath]);
    return c.json({ error: "The animation could not be added to the library." }, 500);
  }

  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.motion.uploaded",
    targetType: "animation",
    targetId: String(key),
    metadata: { bytes: bytes.byteLength, objectPath, libraryAsset: true },
  });
  return c.json({ uploaded: true, key, url: publicUrl, objectPath });
};
