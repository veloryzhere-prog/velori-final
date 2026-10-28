import { boundedText } from "./policy.ts";
export type Session = {
  id: string;
  url?: string;
  payment_status: string;
  status: string;
  mode?: string;
  subscription?: string;
  customer?: string;
  client_reference_id?: string;
  payment_intent: string;
  amount_total: number;
  currency: string;
  livemode: boolean;
  metadata: Record<string, string>;
  line_items?: { data: { price: { id: string }; quantity: number }[] };
};
/** Instance-based REST client; no SDK globals, browser credentials or new package. */
export class StripeClient {
  private key: string;
  private fetcher: typeof fetch;
  constructor(key: string, fetcher: typeof fetch = fetch) {
    this.key = key;
    this.fetcher = fetcher;
  }
  async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: URLSearchParams,
    idempotency?: string,
  ): Promise<T> {
    const response = await this.fetcher(`https://api.stripe.com/v1/${path}`, {
      method,
      body: method === "POST" ? body : undefined,
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Stripe-Version": "2026-08-26.dahlia",
        ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Payment provider unavailable. No access was changed.");
    }
    return JSON.parse(await boundedText(response, 300000)) as T;
  }
  price(id: string) {
    return this.request<{
      id: string;
      active: boolean;
      type: string;
      currency: string;
      unit_amount: number;
      livemode: boolean;
    }>("GET", `prices/${encodeURIComponent(id)}`);
  }
  session(id: string) {
    return this.request<Session>(
      "GET",
      `checkout/sessions/${encodeURIComponent(id)}?expand[]=line_items`,
    );
  }
  create(order: { id: string; userId: string; sku: string; priceId: string }, appUrl: string) {
    const suffix = Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) =>
      String.fromCharCode(97 + (n % 26)),
    ).join("");
    return this.request<Session>(
      "POST",
      "checkout/sessions",
      new URLSearchParams({
        mode: "payment",
        "line_items[0][price]": order.priceId,
        "line_items[0][quantity]": "1",
        client_reference_id: order.id,
        "metadata[veloriOrderId]": order.id,
        "metadata[veloriUserId]": order.userId,
        "metadata[veloriSku]": order.sku,
        success_url: `${appUrl}/forge/pricing?checkout=returned`,
        cancel_url: `${appUrl}/forge/pricing?checkout=cancelled`,
        integration_identifier: `velori-forge-${suffix}`,
      }),
      `velori-studio-order-${order.id}`,
    );
  }
}
export async function verifyEvent(
  raw: string,
  signature: string | null,
  secret: string,
  now = Date.now(),
) {
  if (!signature || !secret || signature.length > 4096)
    throw new Error("Invalid payment signature.");
  const parts = signature.split(",").map((p) => p.split("=", 2));
  const timestamps = parts.filter(([k]) => k === "t");
  const timestamp = timestamps.length === 1 ? Number(timestamps[0][1]) : NaN;
  const signatures = parts
    .filter(([k, v]) => k === "v1" && /^[a-f0-9]{64}$/i.test(v))
    .map(([, v]) => v);
  if (
    !Number.isInteger(timestamp) ||
    Math.abs(now / 1000 - timestamp) > 300 ||
    !signatures.length ||
    signatures.length > 10
  )
    throw new Error("Invalid payment signature.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const message = new TextEncoder().encode(`${timestamp}.${raw}`);
  let valid = false;
  for (const s of signatures)
    valid =
      (await crypto.subtle.verify(
        "HMAC",
        key,
        Uint8Array.from(s.match(/../g)!, (h) => parseInt(h, 16)),
        message,
      )) || valid;
  if (!valid) throw new Error("Invalid payment signature.");
  const event = JSON.parse(raw);
  if (
    !event ||
    !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
    typeof event.type !== "string" ||
    typeof event.livemode !== "boolean"
  )
    throw new Error("Invalid payment event.");
  return event as {
    id: string;
    type: string;
    livemode: boolean;
    data: { object: { id?: string; payment_intent?: string } };
  };
}
export function paymentMatches(
  s: Session,
  o: {
    id: string;
    user_id: string;
    sku: string;
    price_id: string;
    amount: number;
    currency: string;
    livemode: boolean;
    checkout_id: string | null;
  },
) {
  return (
    s.payment_status === "paid" &&
    s.status === "complete" &&
    /^pi_[A-Za-z0-9]+$/.test(s.payment_intent ?? "") &&
    s.metadata?.veloriOrderId === o.id &&
    s.metadata?.veloriUserId === o.user_id &&
    s.metadata?.veloriSku === o.sku &&
    s.amount_total === o.amount &&
    s.currency === o.currency &&
    s.livemode === o.livemode &&
    (!o.checkout_id || s.id === o.checkout_id) &&
    s.line_items?.data.length === 1 &&
    s.line_items.data[0].quantity === 1 &&
    s.line_items.data[0].price.id === o.price_id
  );
}
