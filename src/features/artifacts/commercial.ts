/** Commercial v2 contract. Activation requires the separately reviewed database upgrade. */
export type BillingCurrency = "inr" | "usd";
export const commercialPlans = {
  FREE: { label: "Free", limit: 1000, cadence: "day", inr: 0, usd: 0 },
  PRO_MONTHLY: { label: "Pro", limit: 50000, cadence: "billing month", inr: 99900, usd: 1200 },
  TOPUP5000: { label: "Request pack", limit: 5000, cadence: "one-time", inr: 24900, usd: 300 },
} as const;
export type CommercialQuota = {
  model: "hybrid-v2";
  plan: "FREE" | "PRO";
  used: number;
  limit: number;
  topup: number;
  periodStart: string;
  periodEnd: string;
  accountLocked: boolean;
};
export function quotaState(q: CommercialQuota) {
  if (![q.used, q.limit, q.topup].every(Number.isSafeInteger) || q.used < 0 || q.limit <= 0)
    throw new Error("Invalid account allowance.");
  const baseRemaining = Math.max(0, q.limit - q.used);
  const topupRemaining = Math.max(0, q.topup);
  const exhausted = baseRemaining === 0 && topupRemaining === 0;
  return {
    baseRemaining,
    topupRemaining,
    exhausted,
    canRequest: !q.accountLocked && !exhausted,
    warning: q.used >= Math.ceil(q.limit * 0.9),
    progress: Math.min(100, (q.used / q.limit) * 100),
    source: baseRemaining > 0 ? "base" : topupRemaining > 0 ? "topup" : null,
  };
}
export function formatCommercialPrice(
  sku: keyof typeof commercialPlans,
  currency: BillingCurrency,
) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(commercialPlans[sku][currency] / 100);
}
export function parseCommercialQuota(value: unknown): CommercialQuota {
  const q = value as CommercialQuota;
  if (
    !q ||
    q.model !== "hybrid-v2" ||
    !["FREE", "PRO"].includes(q.plan) ||
    typeof q.accountLocked !== "boolean" ||
    !Number.isFinite(Date.parse(q.periodStart)) ||
    !Number.isFinite(Date.parse(q.periodEnd)) ||
    Date.parse(q.periodEnd) <= Date.parse(q.periodStart)
  )
    throw new Error("Invalid account allowance.");
  quotaState(q);
  return q;
}
