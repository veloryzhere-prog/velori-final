import type { Ctx } from "./admin-core.ts";
import {
  isUuid,
  readBoolean,
  readJson,
  readString,
  requireRecentReauth,
  service,
  writeAudit,
} from "./admin-core.ts";

/** Group administration exposes metadata only. It never selects group posts,
 * membership rows, conversations, or message bodies. */
export const handleGroupsList = async (c: Ctx) => {
  const query = (c.req.query("query") ?? "").trim().slice(0, 120);
  const locked = c.req.query("locked");
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 25, 1), 100);
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);

  let request = service()
    .from("groups")
    .select(
      "id,slug,name,description,privacy,owner_id,is_locked,member_count,post_count,created_at,updated_at,profiles!groups_owner_id_fkey(id,username,display_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (locked === "true") request = request.eq("is_locked", true);
  else if (locked === "false") request = request.eq("is_locked", false);
  if (query) {
    const safeQuery = query.replace(/[%,()]/g, " ");
    request = request.or(`name.ilike.%${safeQuery}%,slug.ilike.%${safeQuery}%`);
  }

  const { data, error, count } = await request;
  if (error) return c.json({ error: "Groups could not be read." }, 500);
  return c.json({ items: data ?? [], count: count ?? 0, limit, offset });
};

export const handleGroupModerationPatch = async (c: Ctx) => {
  const principal = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That group id is not valid." }, 400);
  const blocked = await requireRecentReauth(c, 10);
  if (blocked) return blocked;

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const locked = readBoolean(body.value, "locked");
  const reason = readString(body.value, "reason", 2000);
  if (locked === null || reason === null) {
    return c.json({ error: "Those fields must be the expected type." }, 400);
  }
  if (locked === undefined || reason === undefined) {
    return c.json({ error: "Specify the lock state and a reason." }, 400);
  }
  if (reason.trim().length < 4) {
    return c.json(
      {
        error: "A reason of at least four characters is required.",
      },
      400,
    );
  }

  const { data: current, error: lookupError } = await service()
    .from("groups")
    .select("id,name,is_locked")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) {
    return c.json({ error: "That group could not be read." }, 500);
  }
  if (!current) return c.json({ error: "That group was not found." }, 404);
  if (current.is_locked === locked) {
    return c.json({ updated: false, locked, group: current.name });
  }

  const { data, error } = await service()
    .from("groups")
    .update({
      is_locked: locked,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id,name,is_locked")
    .maybeSingle();
  if (error) return c.json({ error: "That group could not be updated." }, 500);
  if (!data) return c.json({ error: "That group was not found." }, 404);

  await writeAudit(c.req.raw, {
    adminUserId: principal.user.id,
    action: locked ? "admin.group.locked" : "admin.group.unlocked",
    targetType: "group",
    targetId: id,
    reason: reason.trim(),
    metadata: { locked },
  });

  return c.json({ updated: true, group: data });
};
