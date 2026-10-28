export type ForgePlan = {
  sku: "PACK100" | "PREMIUM";
  label: string;
  description: string;
  currency: "inr" | "usd";
  amount: number;
  priceId: string;
  enabled: boolean;
};
export type ForgeOffer = { code: string; label: string; promotionId: string; enabled: boolean };
export type ForgeConfig = {
  version: 1;
  revision: string;
  aiGuidance: string;
  documentation: string;
  providerDailyCap: number;
  plans: ForgePlan[];
  offers: ForgeOffer[];
  subscriptionDraft: {
    label: string;
    inr: number;
    usd: number;
    monthlyRequests: number;
    priceId: string;
  };
};
export const defaultForgeConfig: ForgeConfig = {
  version: 1,
  revision: "initial",
  aiGuidance:
    "Use a calm, helpful VELORI voice. Build polished presentations, animations and interactive pages. Follow the latest request while preserving working features.",
  documentation:
    "VELORI Forge plans\n\nFree: local creation with VELORI attribution. Connected accounts receive the allowance reported by the server.\n\nCredit packs: one-time generation credits. Payment is confirmed by a verified webhook before credits are granted.\n\nPremium: current installed entitlement; provider capacity and fair-use controls always apply.\n\nRecurring Pro subscriptions are not active until the separate commercial database and settlement upgrade is approved, installed and tested.\n\nOffline source files remain editable. Hosted quotas cannot be enforced after an HTML file leaves VELORI.",
  providerDailyCap: 250,
  plans: [],
  offers: [],
  subscriptionDraft: {
    label: "Pro Monthly",
    inr: 99900,
    usd: 1200,
    monthlyRequests: 50000,
    priceId: "",
  },
};
const text = (v: unknown, max: number) => {
  if (typeof v !== "string" || v.length > max) throw Error("A text field exceeds its limit.");
  return v.trim();
};
const money = (v: unknown) => {
  if (!Number.isSafeInteger(v) || Number(v) < 1 || Number(v) > 100000000)
    throw Error("Use a positive price in minor currency units.");
  return Number(v);
};
export function parseForgeConfig(value: unknown): ForgeConfig {
  const v = value as ForgeConfig;
  if (
    !v ||
    v.version !== 1 ||
    !Array.isArray(v.plans) ||
    v.plans.length > 4 ||
    !Array.isArray(v.offers) ||
    v.offers.length > 10
  )
    throw Error("Invalid Forge configuration.");
  if (!Number.isInteger(v.providerDailyCap) || v.providerDailyCap < 1 || v.providerDailyCap > 10000)
    throw Error("Provider request cap must be 1–10,000.");
  const keys = new Set<string>(),
    codes = new Set<string>();
  const plans = v.plans.map((p) => {
    if (
      !p ||
      !["PACK100", "PREMIUM"].includes(p.sku) ||
      !["inr", "usd"].includes(p.currency) ||
      typeof p.enabled !== "boolean"
    )
      throw Error("Invalid plan.");
    const key = p.sku + ":" + p.currency;
    if (keys.has(key)) throw Error("A plan/currency occurs twice.");
    keys.add(key);
    const priceId = text(p.priceId, 100);
    if (priceId && !/^price_[A-Za-z0-9]+$/.test(priceId)) throw Error("Use a Stripe price ID.");
    if (p.enabled && !priceId) throw Error("Enabled plans require a verified price ID.");
    return {
      sku: p.sku,
      currency: p.currency,
      label: text(p.label, 80),
      description: text(p.description, 220),
      amount: money(p.amount),
      priceId,
      enabled: p.enabled,
    };
  });
  const offers = v.offers.map((o) => {
    const code = text(o.code, 30).toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code) || codes.has(code))
      throw Error("Use unique coupon codes of 3–30 characters.");
    codes.add(code);
    const promotionId = text(o.promotionId, 100);
    if (!/^promo_[A-Za-z0-9]+$/.test(promotionId) || typeof o.enabled !== "boolean")
      throw Error("Coupons require a Stripe promotion code ID.");
    return { code, label: text(o.label, 100), promotionId, enabled: o.enabled };
  });
  const d = v.subscriptionDraft;
  if (
    !d ||
    !Number.isInteger(d.monthlyRequests) ||
    d.monthlyRequests < 1 ||
    d.monthlyRequests > 500000
  )
    throw Error("Invalid subscription request limit.");
  const priceId = text(d.priceId, 100);
  if (priceId && !/^price_[A-Za-z0-9]+$/.test(priceId)) throw Error("Use a subscription price ID.");
  return {
    version: 1,
    revision: text(v.revision, 80),
    aiGuidance: text(v.aiGuidance, 2000),
    documentation: text(v.documentation, 5000),
    providerDailyCap: v.providerDailyCap,
    plans,
    offers,
    subscriptionDraft: {
      label: text(d.label, 80),
      inr: money(d.inr),
      usd: money(d.usd),
      monthlyRequests: d.monthlyRequests,
      priceId,
    },
  };
}
export function readForgeConfig(env: (name: string) => string | undefined) {
  for (const key of ["VELORI_CUSTOM_FORGE_CONFIG", "VELORI_CUSTOM_FORGE_CONFIG_PREVIOUS"]) {
    try {
      const raw = env(key);
      if (raw) return parseForgeConfig(JSON.parse(raw));
    } catch {
      /* A malformed candidate must not replace the previous configuration. */
    }
  }
  return structuredClone(defaultForgeConfig);
}
export function publicForgeConfig(c: ForgeConfig) {
  return {
    revision: c.revision,
    documentation: c.documentation,
    plans: c.plans.map(({ priceId, ...p }) => p),
    offers: c.offers.filter((o) => o.enabled).map(({ code, label }) => ({ code, label })),
    recurringAvailable: false,
  };
}
