/* Copyright © 2026 VELORYZ. Strictly verified Stripe recurring subscription contracts. */
export type RecurringPrice = {
  id: string; active: boolean; currency: string; unit_amount: number;
  type: string; livemode: boolean;
  recurring?: { interval: string; interval_count: number } | null;
};
export type CanonicalSubscription = {
  id: string; customer: string; status: string; livemode: boolean;
  cancel_at_period_end?: boolean; current_period_end?: number;
  items?: {data?: Array<{current_period_end?: number; price?: {id?: string}}>} ;
};
const PRICE_ID = /^price_[A-Za-z0-9]+$/;
export function validMonthlyPrice(price: RecurringPrice, id: string, currency: string, live: boolean) {
  return PRICE_ID.test(id) && price.id === id && price.active && price.type === "recurring" &&
    price.recurring?.interval === "month" && price.recurring.interval_count === 1 &&
    price.currency === currency && price.livemode === live &&
    Number.isSafeInteger(price.unit_amount) && price.unit_amount > 0;
}
export function periodEnd(subscription: CanonicalSubscription): number {
  const item = subscription.items?.data?.[0];
  return item?.current_period_end ?? subscription.current_period_end ?? 0;
}
export function verifiedSubscription(sub: CanonicalSubscription, priceId: string, live: boolean) {
  const item = sub.items?.data?.[0];
  const end = periodEnd(sub);
  return /^sub_[A-Za-z0-9]+$/.test(sub.id) &&
    /^cus_[A-Za-z0-9]+$/.test(sub.customer) && sub.livemode === live &&
    item?.price?.id === priceId && Number.isSafeInteger(end) && end > 0 &&
    ["active", "trialing", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "paused"].includes(sub.status);
}
export function subscriptionEligible(status: string, end: number, now = Date.now()) {
  return (status === "active" || status === "trialing") && Number.isSafeInteger(end) && end * 1000 > now;
}
export function monthlyCheckoutParams(order: {userId:string;priceId:string}, appUrl: string) {
  if (!PRICE_ID.test(order.priceId) || !/^[0-9a-f-]{36}$/i.test(order.userId) || !/^https:\/\/[^/?#]+$/.test(appUrl))
    throw new Error("Invalid monthly checkout configuration.");
  return new URLSearchParams({
    mode:"subscription", "line_items[0][price]":order.priceId, "line_items[0][quantity]":"1",
    client_reference_id:order.userId, "metadata[veloriUserId]":order.userId,
    "metadata[veloriPlan]":"PRO_MONTHLY", "subscription_data[metadata][veloriUserId]":order.userId,
    success_url:`${appUrl}/forge/pricing?checkout=returned`,
    cancel_url:`${appUrl}/forge/pricing?checkout=cancelled`,
  });
}
