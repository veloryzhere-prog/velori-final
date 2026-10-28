import type { Ctx } from "./admin-core.ts";
import { isUuid, readJson, readString, service, writeAudit } from "./admin-core.ts";
import {
  type ModerationKind,
  moderationPermissionFor,
  moderationViewPermissionFor,
} from "./admin-social-permissions.ts";

/**
 * Reel and story moderation.
 *
 * These existed as admin screens with no server counterpart, which is why an
 * administrator could not act on another author's reel or story: the browser
 * cannot write those rows under the reader RLS, and widening that policy to let
 * a browser moderate would hand every signed-in user the same power.
 *
 * The correct boundary is the one the rest of the console already uses: the
 * Edge Function holds service-role access and performs the permission check
 * itself, so `reels.hide` in a role's grant is what authorizes the action.
 */

const MODERATION_STATES = new Set(["clean", "hidden", "removed", "restricted"]);

/**
 * Shared list endpoint for the moderation queue. Reading a moderation queue is
 * service-role by design: an administrator legitimately needs to see flagged and
 * already-moderated items, which the public reader policies deliberately hide.
 */
export const handleModerationList = (kind: ModerationKind) => async (c: Ctx) => {
  const principal = c.get("admin");
  const viewPermission = moderationViewPermissionFor(kind);
  if (!principal.permissions.has(viewPermission)) {
    return c.json(
      {
        error: `Your role does not include the "${viewPermission}" permission.`,
      },
      403,
    );
  }

  const state = (c.req.query("state") ?? "").trim();
  const query = (c.req.query("query") ?? "").trim().slice(0, 120);
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 50, 1), 100);
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

  const safeQuery = query.replace(/[%,()]/g, " ");
  let data: unknown[] | null = null;
  let error: { message: string } | null = null;

  if (kind === "reel") {
    let request = service()
      .from("reels")
      .select(
        "id,author_id,title,caption,status,visibility,is_deleted,is_reported,moderation_state,moderation_reason,moderated_at,created_at,profiles!reels_author_id_fkey(id,username,display_name)",
      );
    if (state && MODERATION_STATES.has(state)) {
      request = request.eq("moderation_state", state);
    }
    if (safeQuery) {
      request = request.or(`title.ilike.%${safeQuery}%,caption.ilike.%${safeQuery}%`);
    }
    const result = await request
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    data = result.data;
    error = result.error;
  } else {
    let request = service()
      .from("stories")
      .select(
        "id,author_id,caption,media_type,audience,status,expires_at,moderation_state,moderation_reason,moderated_at,created_at,profiles!stories_author_id_fkey(id,username,display_name)",
      );
    if (state && MODERATION_STATES.has(state)) {
      request = request.eq("moderation_state", state);
    }
    if (safeQuery) request = request.or(`caption.ilike.%${safeQuery}%`);
    const result = await request
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    data = result.data;
    error = result.error;
  }

  if (error) {
    return c.json({ error: `That ${kind} list could not be loaded.` }, 500);
  }
  return c.json({ items: data ?? [], count: data?.length ?? 0 });
};

export const handleModerationPatch = (kind: ModerationKind) => async (c: Ctx) => {
  const principal = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) {
    return c.json({ error: `That ${kind} id is not valid.` }, 400);
  }

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);

  const state = readString(body.value, "state", 32);
  const reason = readString(body.value, "reason", 2001);
  if (state === null || reason === null) {
    return c.json({ error: "Those fields must be the expected type." }, 400);
  }
  if (state === undefined) {
    return c.json({ error: "Specify the moderation state to apply." }, 400);
  }
  if (!MODERATION_STATES.has(state)) {
    return c.json({ error: "That moderation state is not recognised." }, 400);
  }

  const permission = moderationPermissionFor(kind, state)!;
  if (!principal.permissions.has(permission)) {
    return c.json(
      {
        error: `Your role does not include the "${permission}" permission.`,
      },
      403,
    );
  }
  // Removal is destructive, so it always needs an attributable reason.
  if (state !== "clean" && (reason ?? "").trim().length < 4) {
    return c.json(
      {
        error: `A short reason is required to moderate a ${kind}.`,
      },
      400,
    );
  }

  const table = kind === "reel" ? "reels" : "stories";
  const patch: Record<string, unknown> = {
    moderation_state: state,
    moderation_reason: reason ?? "",
    moderated_by: principal.user.id,
    moderated_at: new Date().toISOString(),
  };
  // Keep the existing lifecycle columns consistent with the moderation decision
  // so a reader surface filtering on either field agrees with the other.
  if (kind === "reel") {
    if (state === "removed") patch.is_deleted = true;
    if (state === "clean") patch.is_deleted = false;
  } else if (state === "removed") {
    patch.status = "archived";
  } else if (state === "clean") {
    patch.status = "published";
  }

  const { data, error } = await service()
    .from(table)
    .update(patch)
    .eq("id", id)
    .select("id,moderation_state,moderation_reason,moderated_at")
    .maybeSingle();

  if (error) {
    return c.json({ error: `That ${kind} could not be updated.` }, 500);
  }
  if (!data) return c.json({ error: `That ${kind} was not found.` }, 404);

  await writeAudit(c.req.raw, {
    adminUserId: principal.user.id,
    action: `admin.${kind}.moderated`,
    targetType: kind,
    targetId: id,
    reason: reason ?? "",
    metadata: { state },
  });

  return c.json({
    updated: true,
    state: data.moderation_state,
    moderatedAt: data.moderated_at,
  });
};

export const handleReelsList = handleModerationList("reel");
export const handleStoriesList = handleModerationList("story");
export const handleReelPatch = handleModerationPatch("reel");
export const handleStoryPatch = handleModerationPatch("story");
