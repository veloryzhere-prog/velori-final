export type RewardType = "introductory" | "referral-invitee" | "referral-inviter" | "app-install";

export type RewardStatus = "granted" | "pending" | "rejected" | "expired";

export type RewardLedgerEntry = {
  id: string;
  userId: string;
  campaignId: string;
  type: RewardType;
  amount: number;
  status: RewardStatus;
  createdAt: string;
  eventId: string;
  idempotencyKey: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type RewardCampaign = {
  id: string;
  name: string;
  active: boolean;
  introInitialCredits: number;
  introBonusCap: number;
  referralInviteeCredits: number;
  referralInviterCredits: number;
  appInstallCredits: number;
  startAt: string;
  endAt: string | null;
};

export type RewardProfile = {
  userId: string;
  referralCode: string;
  createdAt: string;
  lastUpdatedAt: string;
  ledger: RewardLedgerEntry[];
};

export const DEFAULT_REWARD_CAMPAIGN: RewardCampaign = {
  id: "forge-referral-v1",
  name: "FORGE Invite & Install Bonus",
  active: true,
  introInitialCredits: 5,
  introBonusCap: 5,
  referralInviteeCredits: 2,
  referralInviterCredits: 2,
  appInstallCredits: 1,
  startAt: "2026-01-01T00:00:00.000Z",
  endAt: null,
};

export function normalizeReferralCode(value: string): string {
  const base = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");

  const suffix = (base.startsWith("FORGE-") ? base.slice(6) : base || "VELORI")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);

  return suffix ? `FORGE-${suffix}` : "FORGE-VELORI";
}

export function generateReferralCode(seed: string): string {
  const normalized = String(seed ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);

  const raw =
    `${normalized || "VELORI"}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 7);

  return `FORGE-${raw}`;
}

export function getReferralUrl(code: string, origin = "https://velori.app") {
  const normalized = normalizeReferralCode(code);
  const safeOrigin = /^https?:\/\//.test(origin) ? origin : "https://velori.app";
  return `${safeOrigin}/signup?ref=${encodeURIComponent(normalized)}`;
}

export function rewardBalance({
  initialCredits,
  ledger,
}: {
  initialCredits: number;
  ledger: RewardLedgerEntry[];
}) {
  const promoBonus = ledger
    .filter((entry) => entry.status === "granted")
    .reduce((total, entry) => total + Math.max(0, Number(entry.amount) || 0), 0);

  return {
    promoBonus,
    remainingBalance: Math.max(0, initialCredits - promoBonus),
    grantedTotal: promoBonus,
  };
}

export function applyCampaignGrant({
  initialCredits,
  campaign,
  ledger,
  eventId,
  amount,
  type,
  userId,
}: {
  initialCredits: number;
  campaign: RewardCampaign;
  ledger: RewardLedgerEntry[];
  eventId: string;
  amount: number;
  type: RewardType;
  userId?: string;
}) {
  if (!campaign.active || !eventId) {
    return { granted: false, amount: 0, reason: "inactive-or-invalid" as const };
  }

  const seen = ledger.some(
    (entry) =>
      (entry.eventId === eventId && entry.campaignId === campaign.id) ||
      `${entry.campaignId}:${entry.eventId}:${entry.userId}` ===
        `${campaign.id}:${eventId}:${userId ?? "anonymous"}`,
  );
  if (seen) {
    return { granted: false, amount: 0, reason: "duplicate-event" as const };
  }

  const { promoBonus } = rewardBalance({ initialCredits, ledger });
  const remaining = Math.max(0, initialCredits - promoBonus);

  if (remaining <= 0) {
    return { granted: false, amount: 0, reason: "cap-reached" as const };
  }

  const available = Math.min(Math.max(0, Number(amount) || 0), remaining);
  if (available <= 0) {
    return { granted: false, amount: 0, reason: "insufficient-capacity" as const };
  }

  return {
    granted: true,
    amount: available,
    reason: "remaining-capacity" as const,
    entry: {
      id: `reward-${Math.random().toString(36).slice(2, 11)}`,
      userId: userId ?? "anonymous",
      campaignId: campaign.id,
      type,
      amount: available,
      status: "granted" as const,
      createdAt: new Date().toISOString(),
      eventId,
      idempotencyKey: `${campaign.id}:${eventId}:${userId ?? "anonymous"}`,
    },
  };
}

export function applyReferralReward({
  inviterId,
  inviteeId,
  campaign,
  ledger,
  eventId,
  inviteeReward,
  inviterReward,
}: {
  inviterId: string;
  inviteeId: string;
  campaign: RewardCampaign;
  ledger: RewardLedgerEntry[];
  eventId: string;
  inviteeReward: number;
  inviterReward: number;
}) {
  if (!campaign.active) {
    return { granted: false, amount: 0, reason: "inactive" as const };
  }
  if (!inviterId || !inviteeId || inviterId === inviteeId) {
    return { granted: false, amount: 0, reason: "self-referral" as const };
  }

  const duplicate = ledger.some(
    (entry) => entry.eventId === eventId && entry.campaignId === campaign.id,
  );
  if (duplicate) {
    return { granted: false, amount: 0, reason: "duplicate-event" as const };
  }

  const amount = Math.min(Math.max(0, Number(inviteeReward) || 0), campaign.referralInviteeCredits);
  const inviterAmount = Math.min(
    Math.max(0, Number(inviterReward) || 0),
    campaign.referralInviterCredits,
  );

  return {
    granted: amount > 0 || inviterAmount > 0,
    amount,
    inviterAmount,
    reason: amount > 0 || inviterAmount > 0 ? "referral-qualified" : "insufficient-capacity",
    entries: [
      {
        id: `reward-referral-invitee-${Math.random().toString(36).slice(2, 11)}`,
        userId: inviteeId,
        campaignId: campaign.id,
        type: "referral-invitee" as const,
        amount,
        status: "granted" as const,
        createdAt: new Date().toISOString(),
        eventId,
        idempotencyKey: `${campaign.id}:invitee:${eventId}`,
      },
      {
        id: `reward-referral-inviter-${Math.random().toString(36).slice(2, 11)}`,
        userId: inviterId,
        campaignId: campaign.id,
        type: "referral-inviter" as const,
        amount: inviterAmount,
        status: "granted" as const,
        createdAt: new Date().toISOString(),
        eventId,
        idempotencyKey: `${campaign.id}:inviter:${eventId}`,
      },
    ],
  };
}

export function readRewardsProfile(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  key: string,
  userId?: string,
): RewardProfile {
  const fallbackUser = userId ?? "anonymous";
  const raw = storage?.getItem?.(key) ?? null;
  const parsed = raw ? JSON.parse(raw) : null;
  const safeEntries = Array.isArray(parsed?.ledger)
    ? parsed.ledger.filter((entry: unknown) => !!entry && typeof entry === "object")
    : [];

  const referralCode = normalizeReferralCode(
    typeof parsed?.referralCode === "string"
      ? parsed.referralCode
      : generateReferralCode(fallbackUser),
  );

  return {
    userId: typeof parsed?.userId === "string" ? parsed.userId : fallbackUser,
    referralCode,
    createdAt: typeof parsed?.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    lastUpdatedAt:
      typeof parsed?.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : new Date().toISOString(),
    ledger: safeEntries.map((entry: any) => ({
      id:
        typeof entry.id === "string"
          ? entry.id
          : `reward-${Math.random().toString(36).slice(2, 11)}`,
      userId: typeof entry.userId === "string" ? entry.userId : fallbackUser,
      campaignId:
        typeof entry.campaignId === "string" ? entry.campaignId : DEFAULT_REWARD_CAMPAIGN.id,
      type: ["introductory", "referral-invitee", "referral-inviter", "app-install"].includes(
        entry.type,
      )
        ? entry.type
        : "introductory",
      amount: Number(entry.amount) || 0,
      status: ["granted", "pending", "rejected", "expired"].includes(entry.status)
        ? entry.status
        : "granted",
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
      eventId:
        typeof entry.eventId === "string"
          ? entry.eventId
          : `event-${Math.random().toString(36).slice(2, 11)}`,
      idempotencyKey:
        typeof entry.idempotencyKey === "string"
          ? entry.idempotencyKey
          : `${DEFAULT_REWARD_CAMPAIGN.id}:${Math.random().toString(36).slice(2, 11)}`,
      meta: entry.meta && typeof entry.meta === "object" ? entry.meta : undefined,
    })),
  };
}

export function writeRewardsProfile(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  key: string,
  profile: RewardProfile,
) {
  const safe = {
    ...profile,
    lastUpdatedAt: new Date().toISOString(),
    ledger: Array.isArray(profile.ledger) ? profile.ledger : [],
  };
  storage?.setItem?.(key, JSON.stringify(safe));
  return safe;
}

export function appendRewardEntry(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  key: string,
  nextEntry: RewardLedgerEntry,
  userId?: string,
) {
  const profile = readRewardsProfile(storage, key, userId);
  const ledger = [...profile.ledger, nextEntry].filter(
    (entry) => entry.userId === (userId ?? profile.userId),
  );
  const nextProfile = { ...profile, ledger, lastUpdatedAt: new Date().toISOString() };
  return writeRewardsProfile(storage, key, nextProfile);
}
