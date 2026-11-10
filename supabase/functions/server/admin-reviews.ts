import type { Ctx } from "./admin-core.ts";
import {
  isUuid,
  readJson,
  readString,
  requireRecentReauth,
  service,
  writeAudit,
} from "./admin-core.ts";
import {
  isAppReviewState,
  isValidReviewDateRange,
  sanitizeReviewSearch,
} from "./reviews-policy.mjs";

function pagination(c: Ctx) {
  const page = Math.min(Math.max(Number(c.req.query("page")) || 1, 1), 10000);
  const perPage = Math.min(Math.max(Number(c.req.query("perPage")) || 25, 1), 100);
  return { page, perPage, from: (page - 1) * perPage };
}

export const handleAppReviewsList = async (c: Ctx) => {
  const { page, perPage, from } = pagination(c);
  const rawStatus = c.req.query("status") ?? "";
  const rating = c.req.query("rating") ?? "";
  const sort = c.req.query("sort") === "oldest" ? "oldest" : "newest";
  const query = sanitizeReviewSearch(c.req.query("q") ?? "");
  const startDate = c.req.query("startDate") ?? "";
  const endDate = c.req.query("endDate") ?? "";

  if (rawStatus && !isAppReviewState(rawStatus)) {
    return c.json({ error: "Choose a valid review status." }, 400);
  }
  if (rating && !/^[1-5]$/.test(rating)) {
    return c.json({ error: "Choose a rating from 1 to 5." }, 400);
  }
  if (!isValidReviewDateRange(startDate, endDate)) {
    return c.json(
      {
        error: "Choose valid dates and ensure the start date is on or before the end date.",
      },
      400,
    );
  }

  let request = service()
    .from("app_reviews")
    .select(
      "id,profile_id,rating,review_text,is_anonymous,status,admin_response,created_at,updated_at,moderated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: sort === "oldest" })
    .order("id", { ascending: sort === "oldest" })
    .range(from, from + perPage - 1);
  if (rawStatus) request = request.eq("status", rawStatus);
  if (rating) request = request.eq("rating", Number(rating));
  if (startDate) {
    request = request.gte("created_at", `${startDate}T00:00:00.000Z`);
  }
  if (endDate) {
    const exclusiveEnd = new Date(`${endDate}T00:00:00.000Z`);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    request = request.lt("created_at", exclusiveEnd.toISOString());
  }
  if (query) {
    request = request.ilike("review_text", `%${query}%`);
  }

  const { data, error, count } = await request;
  if (error) return c.json({ error: "Reviews could not be read." }, 500);
  const rows = data ?? [];
  const profileIds = [
    ...new Set(rows.flatMap((review) => (review.profile_id ? [review.profile_id] : []))),
  ];
  const profilesById = new Map<
    string,
    {
      display_name: string | null;
      username: string | null;
      is_private: boolean;
    }
  >();
  if (profileIds.length) {
    const { data: profiles, error: profileError } = await service()
      .from("profiles")
      .select("id,display_name,username,is_private")
      .in("id", profileIds);
    if (profileError) {
      return c.json({ error: "Review authors could not be read." }, 500);
    }
    for (const profile of profiles ?? []) profilesById.set(profile.id, profile);
  }

  const items = rows.map(({ profile_id, is_anonymous, ...review }) => {
    const profile = profile_id ? profilesById.get(profile_id) : null;
    const reviewer_display_name = is_anonymous
      ? "Anonymous"
      : profile?.is_private
        ? "Private member"
        : profile?.display_name?.trim() || profile?.username || "VELORI member";
    return { ...review, is_anonymous, reviewer_display_name };
  });

  const { data: summary, error: summaryError } = await service().rpc("admin_app_review_summary");
  if (summaryError) {
    return c.json({ error: "Review statistics could not be read." }, 500);
  }
  return c.json({ items, total: count ?? 0, page, perPage, summary });
};

export const handleAppReviewPatch = async (c: Ctx) => {
  const principal = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) {
    return c.json({ error: "That review id is not valid." }, 400);
  }
  const blocked = await requireRecentReauth(c, 10);
  if (blocked) return blocked;

  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const statusValue = readString(body.value, "status", 20);
  if (statusValue === null || (statusValue !== undefined && !isAppReviewState(statusValue))) {
    return c.json({ error: "Choose a valid review status." }, 400);
  }
  const hasResponse = Object.hasOwn(body.value, "admin_response");
  const responseValue = body.value.admin_response;
  if (hasResponse && (typeof responseValue !== "string" || responseValue.trim().length > 1200)) {
    return c.json(
      {
        error: "The team response must be 1,200 characters or fewer.",
      },
      400,
    );
  }
  if (statusValue === undefined && !hasResponse) {
    return c.json(
      {
        error: "Choose a moderation status or provide a team response.",
      },
      400,
    );
  }

  const { data: current, error: lookupError } = await service()
    .from("app_reviews")
    .select("id,status,admin_response")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) {
    return c.json({ error: "That review could not be read." }, 500);
  }
  if (!current) return c.json({ error: "That review was not found." }, 404);

  const nextStatus = statusValue ?? current.status;
  const adminResponse = hasResponse
    ? (responseValue as string).trim() || null
    : current.admin_response;
  if (nextStatus === current.status && adminResponse === current.admin_response) {
    return c.json({ updated: false, status: current.status });
  }

  const now = new Date().toISOString();
  const { data, error } = await service()
    .from("app_reviews")
    .update({
      status: nextStatus,
      admin_response: adminResponse,
      moderated_by: nextStatus === "pending" ? null : principal.user.id,
      moderated_at: nextStatus === "pending" ? null : now,
    })
    .eq("id", id)
    .select("id,status,admin_response,moderated_at")
    .maybeSingle();
  if (error) return c.json({ error: "That review could not be updated." }, 500);
  if (!data) return c.json({ error: "That review was not found." }, 404);

  await writeAudit(c.req.raw, {
    adminUserId: principal.user.id,
    action: "admin.review.moderated",
    targetType: "app_review",
    targetId: id,
    reason: adminResponse ? "review_moderation_or_response" : "review_moderation",
    metadata: {
      previousStatus: current.status,
      status: data.status,
      responseChanged: adminResponse !== current.admin_response,
    },
  });
  return c.json({ updated: true, review: data });
};

export const handleAppReviewDelete = async (c: Ctx) => {
  const principal = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) {
    return c.json({ error: "That review id is not valid." }, 400);
  }
  const blocked = await requireRecentReauth(c, 10);
  if (blocked) return blocked;

  const { data: current, error: lookupError } = await service()
    .from("app_reviews")
    .select("id,rating,status")
    .eq("id", id)
    .maybeSingle();
  if (lookupError) {
    return c.json({ error: "That review could not be read." }, 500);
  }
  if (!current) return c.json({ error: "That review was not found." }, 404);

  const { error } = await service().from("app_reviews").delete().eq("id", id);
  if (error) return c.json({ error: "That review could not be deleted." }, 500);
  await writeAudit(c.req.raw, {
    adminUserId: principal.user.id,
    action: "admin.review.deleted",
    targetType: "app_review",
    targetId: id,
    reason: "review_removed_by_admin",
    metadata: { rating: current.rating, status: current.status },
  });
  return c.json({ deleted: true });
};
