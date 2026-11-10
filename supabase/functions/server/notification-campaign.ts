export const NOTIFICATION_AUDIENCES = [
  "all",
  "selected_users",
  "account_types",
  "roles",
  "admins",
] as const;

const ACCOUNT_TYPES = new Set(["personal", "creator", "business"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]{0,59}$/;

export type CampaignAudience = (typeof NOTIFICATION_AUDIENCES)[number];

export type CampaignAudienceInput = {
  audience: CampaignAudience;
  audienceIds: unknown;
  accountTypes: unknown;
  roleKeys: unknown;
};

export type CampaignAudienceResult =
  | {
      ok: true;
      audienceIds: string[];
      accountTypes: string[];
      roleKeys: string[];
    }
  | { ok: false; error: string };

const stringArray = (value: unknown) =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

export function validateCampaignAudience(input: CampaignAudienceInput): CampaignAudienceResult {
  const audienceIds = input.audienceIds ?? [];
  if (!stringArray(audienceIds) || audienceIds.some((id) => !UUID_PATTERN.test(id))) {
    return { ok: false, error: "Every recipient id must be a valid identifier." };
  }

  const accountTypes = input.accountTypes ?? [];
  if (!stringArray(accountTypes) || accountTypes.some((type) => !ACCOUNT_TYPES.has(type))) {
    return { ok: false, error: "Choose one or more valid account types." };
  }

  const roleKeys = input.roleKeys ?? [];
  if (!stringArray(roleKeys) || roleKeys.some((key) => !ROLE_KEY_PATTERN.test(key))) {
    return { ok: false, error: "Choose one or more valid administrator roles." };
  }

  if (input.audience === "selected_users" && audienceIds.length === 0) {
    return { ok: false, error: "Choose at least one recipient for this audience." };
  }
  if (input.audience === "account_types" && accountTypes.length === 0) {
    return { ok: false, error: "Choose one or more valid account types." };
  }
  if (input.audience === "roles" && roleKeys.length === 0) {
    return { ok: false, error: "Choose one or more valid administrator roles." };
  }

  return { ok: true, audienceIds, accountTypes, roleKeys };
}

export type CampaignWindowResult =
  | { ok: true; startsAt: string; endsAt: string | null }
  | { ok: false; error: string };

export function validateCampaignWindow(
  startsAt: string | undefined,
  endsAt: string | undefined,
  now = Date.now(),
): CampaignWindowResult {
  const start = startsAt?.trim() ? new Date(startsAt) : new Date(now);
  if (!Number.isFinite(start.getTime())) {
    return { ok: false, error: "The notification start time is invalid." };
  }
  if (start.getTime() > now) {
    return { ok: false, error: "Scheduled notification delivery is not available yet." };
  }

  const end = endsAt?.trim() ? new Date(endsAt) : null;
  if (end && !Number.isFinite(end.getTime())) {
    return { ok: false, error: "The notification end time is invalid." };
  }
  if (end && end.getTime() <= now) {
    return { ok: false, error: "The notification end time must be in the future." };
  }

  return {
    ok: true,
    startsAt: start.toISOString(),
    endsAt: end?.toISOString() ?? null,
  };
}
