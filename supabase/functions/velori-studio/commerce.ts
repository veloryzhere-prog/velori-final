import { StripeClient } from "./payments.ts";

export type CommercialOrder = {
  id: string;
  user_id: string;
  sku: "PRO_MONTHLY" | "TOPUP5000";
  amount: number;
  currency: "inr" | "usd";
  provider: "stripe" | "razorpay";
  provider_order_id: string;
  livemode: boolean;
};
export const commercialAmounts = {
  PRO_MONTHLY: { inr: 99900, usd: 1200 },
  TOPUP5000: { inr: 24900, usd: 300 },
};

/** Server-selected price IDs only. No client amount, arbitrary redirect or payment-method allowlist. */
export async function createCommercialCheckout(
  client: StripeClient,
  order: CommercialOrder,
  price: {
    id: string;
    active: boolean;
    currency: string;
    unit_amount: number;
    type: string;
    recurring?: { interval: string; interval_count: number };
    livemode: boolean;
  },
  appUrl: string,
) {
  if (
    order.provider !== "stripe" ||
    !/^https:\/\/[^/?#]+$/.test(appUrl) ||
    !/^price_[a-zA-Z0-9]+$/.test(price.id) ||
    !price.active ||
    price.unit_amount !== commercialAmounts[order.sku][order.currency] ||
    price.unit_amount !== order.amount ||
    price.currency !== order.currency ||
    price.livemode !== order.livemode ||
    (order.sku === "PRO_MONTHLY"
      ? price.type !== "recurring" ||
        price.recurring?.interval !== "month" ||
        price.recurring.interval_count !== 1
      : price.type !== "one_time")
  )
    throw new Error("The configured commercial price does not match this plan.");
  const body = new URLSearchParams({
    mode: order.sku === "PRO_MONTHLY" ? "subscription" : "payment",
    "line_items[0][price]": price.id,
    "line_items[0][quantity]": "1",
    client_reference_id: order.id,
    "metadata[veloriOrderId]": order.id,
    "metadata[veloriUserId]": order.user_id,
    "metadata[veloriSku]": order.sku,
    success_url: `${appUrl}/forge/pricing?checkout=returned`,
    cancel_url: `${appUrl}/forge/pricing?checkout=cancelled`,
    integration_identifier: `velori-commercial-${Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => String.fromCharCode(97 + (n % 26))).join("")}`,
  });
  if (order.sku === "PRO_MONTHLY") {
    body.set("subscription_data[metadata][veloriOrderId]", order.id);
    body.set("subscription_data[metadata][veloriUserId]", order.user_id);
  }
  return client.request<{ id: string; url: string }>(
    "POST",
    "checkout/sessions",
    body,
    `velori-commercial-${order.id}`,
  );
}

/** Verify the exact raw bytes before parsing; database deduplication is still required. */
export async function verifyRazorpayEvent(
  raw: Uint8Array,
  signature: string | null,
  secret: string,
) {
  if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature) || raw.byteLength > 300000)
    throw new Error("Invalid UPI provider signature.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const digest = Uint8Array.from(signature.match(/../g)!, (v) => parseInt(v, 16));
  if (!(await crypto.subtle.verify("HMAC", key, digest, new Uint8Array(raw))))
    throw new Error("Invalid UPI provider signature.");
  return JSON.parse(new TextDecoder().decode(raw));
}
/** canonicalPayment must be retrieved with the merchant's protected provider API key. */
export function razorpayPaymentMatches(
  p: {
    id: string;
    order_id: string;
    status: string;
    captured: boolean;
    amount: number;
    currency: string;
  },
  o: CommercialOrder,
) {
  return (
    o.provider === "razorpay" &&
    o.sku === "TOPUP5000" &&
    o.currency === "inr" &&
    /^pay_[A-Za-z0-9]+$/.test(p.id) &&
    p.order_id === o.provider_order_id &&
    p.status === "captured" &&
    p.captured === true &&
    p.amount === o.amount &&
    p.amount === commercialAmounts.TOPUP5000.inr &&
    p.currency === "INR"
  );
}

const escape = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
export function commercialReceipt(input: {
  reference: string;
  sku: CommercialOrder["sku"];
  amount: number;
  currency: "inr" | "usd";
  paidAt: string;
  balance: number;
  tax?: number;
  taxLabel?: string;
}) {
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount < 0 ||
    !Number.isSafeInteger(input.balance) ||
    !Number.isFinite(Date.parse(input.paidAt)) ||
    (input.tax !== undefined &&
      (!Number.isSafeInteger(input.tax) || input.tax < 0 || input.tax > input.amount))
  )
    throw new Error("Invalid verified receipt.");
  const money = (amount: number) =>
    new Intl.NumberFormat("en", { style: "currency", currency: input.currency }).format(
      amount / 100,
    );
  const title =
    input.sku === "PRO_MONTHLY" ? "Forge Pro — monthly subscription" : "5,000-request pack";
  const tax =
    input.tax === undefined
      ? "Tax breakdown is available on the provider invoice."
      : `${escape(input.taxLabel || "Tax")}: ${money(input.tax)}`;
  return {
    subject: `VELORI Forge payment receipt · ${input.reference}`,
    html: `<!doctype html><html><body style="margin:0;padding:28px 12px;background:#f8f6ef;color:#24221d;font:15px Arial,sans-serif"><main style="max-width:580px;margin:auto;background:white;border:1px solid #e7e1d4;border-radius:18px;padding:32px"><p style="letter-spacing:2px;color:#8b773a">VELORI FORGE AI · VELORYZ</p><h1>Thank you for creating.</h1><p>Your payment is confirmed.</p><p>Receipt ${escape(input.reference)}<br>${escape(new Date(input.paidAt).toISOString())}</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:18px 0;border-bottom:1px solid #eee">${title}</td><td style="text-align:right;border-bottom:1px solid #eee">${money(input.amount)}</td></tr><tr><th style="text-align:left;padding-top:18px">Total paid</th><th style="text-align:right;padding-top:18px">${money(input.amount)}</th></tr></table><p>${tax}</p><p style="background:#fff8dc;border-radius:12px;padding:16px">Top-up wallet: ${Math.max(0, input.balance).toLocaleString()} requests. Base plan allowance is separate.</p><p style="color:#827b6c">This is a payment receipt. Use the payment provider's invoice for its tax breakdown. For help, open VELORI Support from your account.</p></main></body></html>`,
  };
}
