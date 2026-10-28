import { parseCommercialQuota, type CommercialQuota } from "./commercial.ts";

export type AccountAllowance =
  | {
      model: "hybrid-v2";
      quota: CommercialQuota;
      plan: "FREE" | "PRO";
      baseRemaining: number;
      topupRemaining: number;
      periodEnd: string;
      accountLocked: boolean;
    }
  | {
      model: "legacy";
      plan: "FREE" | "PREMIUM";
      baseRemaining: number;
      topupRemaining: number;
      periodEnd: null;
      accountLocked: false;
    };

export type BillingPurchase = {
  sku: "PACK100" | "PREMIUM";
  amount: number;
  currency: "inr" | "usd";
  status: "pending" | "paid" | "refunded";
  createdAt: string;
  paidAt: string | null;
};

export type BillingHistory = {
  available: boolean;
  purchases: BillingPurchase[];
};

export function parseAccountAllowance(value: unknown): AccountAllowance {
  if (!value || typeof value !== "object") throw new Error("Account allowance is unavailable.");
  if ("model" in value && value.model === "hybrid-v2") {
    const quota = parseCommercialQuota(value);
    return {
      model: quota.model,
      quota,
      plan: quota.plan,
      baseRemaining: Math.max(0, quota.limit - quota.used),
      topupRemaining: Math.max(0, quota.topup),
      periodEnd: quota.periodEnd,
      accountLocked: quota.accountLocked,
    };
  }

  const legacy = value as Record<string, unknown>;
  if (
    !["FREE", "PREMIUM"].includes(String(legacy.plan)) ||
    !Number.isSafeInteger(legacy.freeLeft) ||
    !Number.isSafeInteger(legacy.tokens) ||
    (legacy.freeLeft as number) < 0 ||
    (legacy.tokens as number) < 0 ||
    typeof legacy.canGenerate !== "boolean" ||
    typeof legacy.canEdit !== "boolean"
  )
    throw new Error("Account allowance is unavailable.");
  return {
    model: "legacy",
    plan: legacy.plan as "FREE" | "PREMIUM",
    baseRemaining: legacy.freeLeft as number,
    topupRemaining: legacy.tokens as number,
    periodEnd: null,
    accountLocked: false,
  };
}

export function parseBillingHistory(value: unknown): BillingHistory {
  if (!value || typeof value !== "object" || !("available" in value))
    throw new Error("Payment history is unavailable.");
  const history = value as { available: unknown; purchases?: unknown };
  if (history.available === false) return { available: false, purchases: [] };
  if (history.available !== true || !Array.isArray(history.purchases))
    throw new Error("Payment history is unavailable.");
  const purchases = history.purchases.map((row): BillingPurchase => {
    if (!row || typeof row !== "object")
      throw new Error("Payment history contains an invalid entry.");
    const purchase = row as Record<string, unknown>;
    if (
      !["PACK100", "PREMIUM"].includes(String(purchase.sku)) ||
      !Number.isSafeInteger(purchase.amount) ||
      (purchase.amount as number) < 0 ||
      !["inr", "usd"].includes(String(purchase.currency)) ||
      !["pending", "paid", "refunded"].includes(String(purchase.status)) ||
      typeof purchase.created_at !== "string" ||
      !Number.isFinite(Date.parse(purchase.created_at)) ||
      (purchase.paid_at !== null &&
        (typeof purchase.paid_at !== "string" || !Number.isFinite(Date.parse(purchase.paid_at))))
    )
      throw new Error("Payment history contains an invalid entry.");
    return {
      sku: purchase.sku as BillingPurchase["sku"],
      amount: purchase.amount as number,
      currency: purchase.currency as BillingPurchase["currency"],
      status: purchase.status as BillingPurchase["status"],
      createdAt: purchase.created_at,
      paidAt: purchase.paid_at as string | null,
    };
  });
  return { available: true, purchases };
}

export function formatBillingAmount(amount: number, currency: BillingPurchase["currency"]) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}
