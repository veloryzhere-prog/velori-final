import {
  type Ctx,
  isUuid,
  readBoolean,
  readEnum,
  readJson,
  readString,
  service,
  writeAudit,
} from "./admin-core.ts";

const OFFER_TYPES = ["percentage", "fixed_amount", "bundle", "free_trial", "manual"] as const;
const OFFER_ELIGIBILITY = [
  "all_users",
  "new_users",
  "pro_users",
  "creator_users",
  "vip_users",
] as const;
const OFFER_STATUSES = ["draft", "active", "paused", "archived"] as const;
const REFERRAL_STATUSES = ["pending", "qualified", "rejected"] as const;

function pagination(c: Ctx) {
  const page = Math.min(Math.max(Number.parseInt(c.req.query("page") ?? "1", 10) || 1, 1), 5000);
  const perPage = Math.min(
    Math.max(Number.parseInt(c.req.query("perPage") ?? "25", 10) || 25, 1),
    100,
  );
  return { page, perPage };
}

function validDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readBoundedInteger(
  body: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number | undefined | null {
  if (!(key in body)) return undefined;
  const value = body[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    return null;
  }
  return value;
}

function offerFields(body: Record<string, unknown>) {
  const title = readString(body, "title", 121);
  const description = readString(body, "description", 2001);
  const offerType = readEnum(body, "offer_type", OFFER_TYPES);
  const eligibility = readEnum(body, "eligibility", OFFER_ELIGIBILITY);
  const startsAt = readString(body, "starts_at", 41);
  const endsAt = readString(body, "ends_at", 41);
  const usageLimit = readBoundedInteger(body, "usage_limit", 1, 10_000_000);
  const status = readEnum(body, "status", OFFER_STATUSES);
  if (
    title === null ||
    description === null ||
    offerType === null ||
    eligibility === null ||
    startsAt === null ||
    endsAt === null ||
    usageLimit === null ||
    status === null
  ) {
    return {
      error: "Offer fields must use the expected types and allowed values." as const,
    };
  }

  const updates: Record<string, unknown> = {};
  if (title !== undefined) {
    if (!title.trim() || title.length > 120) {
      return { error: "Enter an offer title of 1–120 characters." as const };
    }
    updates.title = title;
  }
  if (description !== undefined) {
    if (description.length > 2000) {
      return {
        error: "Offer descriptions must be 2,000 characters or fewer." as const,
      };
    }
    updates.description = description;
  }
  if (offerType !== undefined) updates.offer_type = offerType;
  if (eligibility !== undefined) updates.eligibility = eligibility;
  if (startsAt !== undefined) {
    const parsed = validDate(startsAt);
    if (!parsed) {
      return {
        error: "Enter a valid ISO start date with a timezone." as const,
      };
    }
    updates.starts_at = parsed;
  }
  if (endsAt !== undefined) {
    const parsed = validDate(endsAt);
    if (!parsed) {
      return { error: "Enter a valid ISO end date with a timezone." as const };
    }
    updates.ends_at = parsed;
  }
  if (usageLimit !== undefined) updates.usage_limit = usageLimit;
  if (status !== undefined) updates.status = status;
  return { updates };
}

function dateWindowError(start: string, end: string): string | null {
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return "The offer end date must be later than its start date.";
  }
  return null;
}

function activationError(offer: Record<string, unknown>): string | null {
  const windowError = dateWindowError(String(offer.starts_at), String(offer.ends_at));
  if (windowError) return windowError;
  const now = Date.now();
  if (Date.parse(String(offer.starts_at)) > now) {
    return "A future-dated offer cannot be activated yet.";
  }
  if (Date.parse(String(offer.ends_at)) <= now) {
    return "An expired offer cannot be activated.";
  }
  if (Number(offer.usage_count) >= Number(offer.usage_limit)) {
    return "The offer has reached its usage limit and cannot be activated.";
  }
  return null;
}

export const handleOffersList = async (c: Ctx) => {
  const { page, perPage } = pagination(c);
  const statusValue = c.req.query("status");
  const status = statusValue
    ? readEnum({ status: statusValue }, "status", OFFER_STATUSES)
    : undefined;
  if (statusValue && !status) {
    return c.json({ error: "Choose a valid offer status." }, 400);
  }
  let request = service()
    .from("velori_offers")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (status) request = request.eq("status", status);
  const { data, error, count } = await request;
  if (error) {
    return c.json({ error: "Offers could not be loaded from the database." }, 500);
  }
  return c.json({ offers: data ?? [], total: count ?? 0, page, perPage });
};

export const handleOfferCreate = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const parsed = offerFields(body.value);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const updates = parsed.updates;
  const required = ["title", "offer_type", "eligibility", "starts_at", "ends_at", "usage_limit"];
  if (required.some((key) => !(key in updates))) {
    return c.json(
      {
        error: "Title, type, eligibility, start/end dates and usage limit are required.",
      },
      400,
    );
  }
  const windowError = dateWindowError(String(updates.starts_at), String(updates.ends_at));
  if (windowError) return c.json({ error: windowError }, 400);
  if (updates.status && updates.status !== "draft") {
    return c.json(
      {
        error: "New offers must be created as drafts; activate them after review.",
      },
      400,
    );
  }

  const { data, error } = await service()
    .from("velori_offers")
    .insert({ ...updates, status: "draft", created_by: user.id })
    .select("*")
    .single();
  if (error || !data) {
    return c.json({ error: "The offer could not be saved." }, 500);
  }
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.offer.created",
    targetType: "offer",
    targetId: data.id,
    reason: readString(body.value, "reason", 2000) ?? "",
    metadata: { offerType: data.offer_type, eligibility: data.eligibility },
  });
  return c.json({ offer: data, created: true }, 201);
};

export const handleOfferPatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const id = c.req.param("id");
  if (!isUuid(id)) return c.json({ error: "That offer id is not valid." }, 400);
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const parsed = offerFields(body.value);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const { data: current, error: loadError } = await service()
    .from("velori_offers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (loadError) {
    return c.json({ error: "The offer could not be loaded." }, 500);
  }
  if (!current) return c.json({ error: "That offer was not found." }, 404);
  if (current.status === "archived") {
    return c.json({ error: "Archived offers are read-only." }, 409);
  }

  const updates = parsed.updates;
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No offer changes were supplied." }, 400);
  }
  const next = { ...current, ...updates };
  const windowError = dateWindowError(String(next.starts_at), String(next.ends_at));
  if (windowError) return c.json({ error: windowError }, 400);
  if (next.status === "active") {
    const error = activationError(next);
    if (error) return c.json({ error }, 409);
  }
  if (next.status === "archived") {
    updates.archived_at = new Date().toISOString();
  }
  if (updates.status && updates.status !== "archived") {
    updates.archived_at = null;
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await service()
    .from("velori_offers")
    .update(updates)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return c.json({ error: "The offer could not be updated." }, 500);
  if (!data) return c.json({ error: "That offer was not found." }, 404);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.offer.updated",
    targetType: "offer",
    targetId: id,
    reason: readString(body.value, "reason", 2000) ?? "",
    metadata: { fields: Object.keys(updates), status: data.status },
  });
  return c.json({ offer: data, updated: true });
};

export const handleReferralProgramGet = async (c: Ctx) => {
  const { data, error } = await service()
    .from("velori_referral_program")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    return c.json({ error: "Referral program settings could not be loaded." }, 500);
  }
  if (!data) {
    return c.json({ error: "The referral program has not been initialized." }, 503);
  }
  return c.json({ program: data });
};

export const handleReferralProgramPatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const enabled = readBoolean(body.value, "enabled");
  const requireVerifiedEmail = readBoolean(body.value, "require_verified_email");
  const startsAt = readString(body.value, "starts_at", 41);
  const endsAt = readString(body.value, "ends_at", 41);
  const minGenerations = readBoundedInteger(body.value, "min_successful_generations", 1, 100);
  const inviterTokens = readBoundedInteger(body.value, "inviter_reward_tokens", 0, 1000);
  const inviteeTokens = readBoundedInteger(body.value, "invitee_reward_tokens", 0, 1000);
  const maxInviter = readBoundedInteger(body.value, "max_rewards_per_inviter", 1, 10000);
  const maxTotal = readBoundedInteger(body.value, "max_total_qualified_referrals", 1, 1000000);
  const maxLifetime = readBoundedInteger(
    body.value,
    "max_lifetime_reward_tokens_per_user",
    1,
    1000000,
  );
  if (
    enabled === null ||
    requireVerifiedEmail === null ||
    startsAt === null ||
    endsAt === null ||
    minGenerations === null ||
    inviterTokens === null ||
    inviteeTokens === null ||
    maxInviter === null ||
    maxTotal === null ||
    maxLifetime === null
  ) {
    return c.json(
      {
        error: "Referral settings contain an invalid type or value.",
      },
      400,
    );
  }
  const updates: Record<string, unknown> = {};
  if (enabled !== undefined) updates.enabled = enabled;
  if (requireVerifiedEmail !== undefined) {
    updates.require_verified_email = requireVerifiedEmail;
  }
  if (startsAt !== undefined) {
    const parsed = startsAt ? validDate(startsAt) : null;
    if (startsAt && !parsed) {
      return c.json(
        {
          error: "Enter a valid ISO program start date with a timezone.",
        },
        400,
      );
    }
    updates.starts_at = parsed;
  }
  if (endsAt !== undefined) {
    const parsed = endsAt ? validDate(endsAt) : null;
    if (endsAt && !parsed) {
      return c.json(
        {
          error: "Enter a valid ISO program end date with a timezone.",
        },
        400,
      );
    }
    updates.ends_at = parsed;
  }
  if (minGenerations !== undefined) {
    updates.min_successful_generations = minGenerations;
  }
  if (inviterTokens !== undefined) {
    updates.inviter_reward_tokens = inviterTokens;
  }
  if (inviteeTokens !== undefined) {
    updates.invitee_reward_tokens = inviteeTokens;
  }
  if (maxInviter !== undefined) updates.max_rewards_per_inviter = maxInviter;
  if (maxTotal !== undefined) updates.max_total_qualified_referrals = maxTotal;
  if (maxLifetime !== undefined) {
    updates.max_lifetime_reward_tokens_per_user = maxLifetime;
  }
  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No referral program changes were supplied." }, 400);
  }

  const { data: current, error: loadError } = await service()
    .from("velori_referral_program")
    .select("*")
    .eq("id", true)
    .single();
  if (loadError || !current) {
    return c.json({ error: "Referral program settings could not be loaded." }, 500);
  }
  const nextStart = "starts_at" in updates ? updates.starts_at : current.starts_at;
  const nextEnd = "ends_at" in updates ? updates.ends_at : current.ends_at;
  if (nextStart && nextEnd && Date.parse(String(nextEnd)) <= Date.parse(String(nextStart))) {
    return c.json(
      {
        error: "The program end date must be later than its start date.",
      },
      400,
    );
  }
  const nextEnabled = "enabled" in updates ? updates.enabled : current.enabled;
  const nextInviterReward =
    "inviter_reward_tokens" in updates
      ? Number(updates.inviter_reward_tokens)
      : current.inviter_reward_tokens;
  const nextInviteeReward =
    "invitee_reward_tokens" in updates
      ? Number(updates.invitee_reward_tokens)
      : current.invitee_reward_tokens;
  if (nextEnabled && (nextInviterReward < 1 || nextInviteeReward < 1)) {
    return c.json(
      {
        error:
          "Set a positive reward for both the inviter and invitee before enabling the program.",
      },
      400,
    );
  }
  if (nextEnabled) {
    return c.json(
      {
        error:
          "The referral program cannot be enabled until trusted Android installation verification is implemented and deployed.",
      },
      409,
    );
  }
  const { data, error } = await service()
    .from("velori_referral_program")
    .update({
      ...updates,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .select("*")
    .single();
  if (error || !data) {
    return c.json({ error: "Referral program settings could not be saved." }, 500);
  }
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.referral_program.updated",
    targetType: "referral_program",
    targetId: "global",
    reason: readString(body.value, "reason", 2000) ?? "",
    metadata: {
      changes: Object.fromEntries(
        Object.keys(updates).map((field) => [field, { from: current[field], to: data[field] }]),
      ),
    },
  });
  return c.json({ program: data, updated: true });
};

export const handleReferralsList = async (c: Ctx) => {
  const { page, perPage } = pagination(c);
  const statusValue = c.req.query("status");
  const status = statusValue
    ? readEnum({ status: statusValue }, "status", REFERRAL_STATUSES)
    : undefined;
  if (statusValue && !status) {
    return c.json({ error: "Choose a valid referral status." }, 400);
  }
  let request = service()
    .from("velori_referrals")
    .select("*", { count: "exact" })
    .order("registered_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (status) request = request.eq("status", status);
  const { data, error, count } = await request;
  if (error) {
    return c.json({ error: "Referral records could not be loaded." }, 500);
  }
  return c.json({ referrals: data ?? [], total: count ?? 0, page, perPage });
};

export const handleReferralRewardsList = async (c: Ctx) => {
  const { page, perPage } = pagination(c);
  const statusValue = c.req.query("status");
  if (statusValue && !["granted", "reversed"].includes(statusValue)) {
    return c.json({ error: "Choose a valid reward status." }, 400);
  }
  let request = service()
    .from("velori_reward_transactions")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (statusValue) request = request.eq("status", statusValue);
  const { data, error, count } = await request;
  if (error) {
    return c.json({ error: "Reward transactions could not be loaded." }, 500);
  }
  return c.json({ rewards: data ?? [], total: count ?? 0, page, perPage });
};

export const handleReferralEventsList = async (c: Ctx) => {
  const { page, perPage } = pagination(c);
  const { data, error, count } = await service()
    .from("velori_referral_events")
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);
  if (error) {
    return c.json({ error: "Referral processing history could not be loaded." }, 500);
  }
  return c.json({ events: data ?? [], total: count ?? 0, page, perPage });
};

export const handleReferralCodePatch = async (c: Ctx) => {
  const { user } = c.get("admin");
  const userId = c.req.param("userId");
  if (!isUuid(userId)) {
    return c.json({ error: "That account id is not valid." }, 400);
  }
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const enabled = readBoolean(body.value, "enabled");
  if (enabled === null || enabled === undefined) {
    return c.json(
      {
        error: "Choose whether the referral code should be enabled.",
      },
      400,
    );
  }
  const { data, error } = await service()
    .from("velori_referral_codes")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("user_id,code,enabled,expires_at,updated_at")
    .maybeSingle();
  if (error) {
    return c.json({ error: "The referral code could not be updated." }, 500);
  }
  if (!data) {
    return c.json({ error: "No referral code exists for that account." }, 404);
  }
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: enabled ? "admin.referral_code.enabled" : "admin.referral_code.disabled",
    targetType: "referral_code",
    targetId: data.code,
    reason: readString(body.value, "reason", 2000) ?? "",
    metadata: { userId },
  });
  return c.json({ code: data, updated: true });
};

export const handleReferralRewardReverse = async (c: Ctx) => {
  const { user } = c.get("admin");
  const rewardId = c.req.param("id");
  if (!isUuid(rewardId)) {
    return c.json({ error: "That reward id is not valid." }, 400);
  }
  const body = await readJson(c.req.raw);
  if (!body.ok) return c.json({ error: body.error }, 400);
  const reason = readString(body.value, "reason", 1001);
  if (!reason || reason.length > 1000) {
    return c.json({ error: "Enter a reversal reason of 1–1,000 characters." }, 400);
  }
  const { data, error } = await service().rpc("velori_reverse_referral_reward", {
    p_reward_id: rewardId,
    p_admin_user_id: user.id,
    p_reason: reason,
  });
  if (error) return c.json({ error: "The reward could not be reversed." }, 500);
  if (!data?.reversed) {
    const status = data?.reason === "not_found" ? 404 : 409;
    return c.json(
      {
        error:
          data?.reason === "already_reversed"
            ? "That reward was already reversed."
            : "That reward was not found.",
      },
      status,
    );
  }
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: "admin.referral_reward.reversed",
    targetType: "referral_reward",
    targetId: rewardId,
    reason,
    metadata: { rewardId },
  });
  return c.json({ reversed: true, rewardId });
};
