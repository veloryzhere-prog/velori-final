import { validateCampaignAudience, validateCampaignWindow } from "./notification-campaign.ts";

const accountId = "123e4567-e89b-42d3-a456-426614174000";

Deno.test("all-account campaign accepts an empty recipient filter", () => {
  const result = validateCampaignAudience({
    audience: "all",
    audienceIds: undefined,
    accountTypes: undefined,
    roleKeys: undefined,
  });
  if (!result.ok || result.audienceIds.length !== 0) {
    throw new Error("An all-account campaign should need no recipient list.");
  }
});

Deno.test("account-type campaign accepts only supported profile types", () => {
  const valid = validateCampaignAudience({
    audience: "account_types",
    audienceIds: [],
    accountTypes: ["creator", "business"],
    roleKeys: [],
  });
  if (!valid.ok || valid.accountTypes.length !== 2) {
    throw new Error("Supported account types should be retained.");
  }

  const invalid = validateCampaignAudience({
    audience: "account_types",
    audienceIds: [],
    accountTypes: ["verified"],
    roleKeys: [],
  });
  if (invalid.ok) throw new Error("Unknown account types must be rejected.");
});

Deno.test("selected-user audience requires valid profile ids", () => {
  const valid = validateCampaignAudience({
    audience: "selected_users",
    audienceIds: [accountId],
    accountTypes: [],
    roleKeys: [],
  });
  if (!valid.ok || valid.audienceIds[0] !== accountId) {
    throw new Error("A valid selected profile should be retained.");
  }

  const invalid = validateCampaignAudience({
    audience: "selected_users",
    audienceIds: ["not-a-uuid"],
    accountTypes: [],
    roleKeys: [],
  });
  if (invalid.ok) throw new Error("Malformed recipient ids must be rejected.");
});

Deno.test("role audience requires safe role keys", () => {
  const valid = validateCampaignAudience({
    audience: "roles",
    audienceIds: [],
    accountTypes: [],
    roleKeys: ["support", "content_manager"],
  });
  if (!valid.ok || valid.roleKeys.length !== 2) {
    throw new Error("Valid role keys should be retained.");
  }

  const invalid = validateCampaignAudience({
    audience: "roles",
    audienceIds: [],
    accountTypes: [],
    roleKeys: ["support; delete all"],
  });
  if (invalid.ok) throw new Error("Malformed role keys must be rejected.");
});

Deno.test("campaign window permits immediate delivery and future expiry", () => {
  const now = Date.parse("2026-10-05T12:00:00.000Z");
  const result = validateCampaignWindow(undefined, "2026-10-06T12:00:00.000Z", now);
  if (!result.ok || result.endsAt !== "2026-10-06T12:00:00.000Z") {
    throw new Error("Immediate delivery with future expiry should be accepted.");
  }
});

Deno.test("campaign window rejects scheduling and already-expired sends", () => {
  const now = Date.parse("2026-10-05T12:00:00.000Z");
  const future = validateCampaignWindow("2026-10-06T12:00:00.000Z", undefined, now);
  if (future.ok) throw new Error("Future scheduled campaigns must be rejected.");

  const expired = validateCampaignWindow(undefined, "2026-10-05T11:59:00.000Z", now);
  if (expired.ok) throw new Error("Already expired campaigns must be rejected.");
});
