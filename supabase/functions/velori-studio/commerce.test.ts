import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { StripeClient } from "./payments.ts";
import {
  createCommercialCheckout,
  verifyRazorpayEvent,
  razorpayPaymentMatches,
  commercialReceipt,
  type CommercialOrder,
} from "./commerce.ts";
const order: CommercialOrder = {
  id: "fixture",
  user_id: "owner",
  sku: "PRO_MONTHLY",
  amount: 99900,
  currency: "inr",
  provider: "stripe",
  provider_order_id: "",
  livemode: false,
};
test("monthly checkout uses recurring price and idempotency without forcing card or UPI", async () => {
  let body = "";
  let idempotency = "";
  const client = new StripeClient("private-fixture", async (_url, init) => {
    body = String(init?.body);
    idempotency = new Headers(init?.headers).get("Idempotency-Key") || "";
    return new Response('{"id":"cs_fixture","url":"https://checkout.stripe.com/fixture"}');
  });
  const price = {
    id: "price_Fixture",
    active: true,
    currency: "inr",
    unit_amount: 99900,
    type: "recurring",
    recurring: { interval: "month", interval_count: 1 },
    livemode: false,
  };
  await createCommercialCheckout(client, order, price, "https://velori.example");
  assert.match(body, /mode=subscription/);
  assert.doesNotMatch(body, /payment_method_types/);
  assert.equal(idempotency, "velori-commercial-fixture");
  await assert.rejects(() =>
    createCommercialCheckout(
      client,
      order,
      { ...price, unit_amount: 24900 },
      "https://velori.example",
    ),
  );
});
test("UPI signatures cover raw bytes and captured payment must match server order", async () => {
  const raw = Buffer.from('{"event":"payment.captured"}');
  const sig = createHmac("sha256", "test-secret").update(raw).digest("hex");
  assert.equal((await verifyRazorpayEvent(raw, sig, "test-secret")).event, "payment.captured");
  await assert.rejects(() => verifyRazorpayEvent(Buffer.from("{}"), sig, "test-secret"));
  const o = {
    ...order,
    provider: "razorpay",
    sku: "TOPUP5000",
    amount: 24900,
    provider_order_id: "order_Fixture",
  } as CommercialOrder;
  const p = {
    id: "pay_Fixture",
    order_id: "order_Fixture",
    status: "captured",
    captured: true,
    amount: 24900,
    currency: "INR",
  };
  assert.equal(razorpayPaymentMatches(p, o), true);
  assert.equal(razorpayPaymentMatches({ ...p, amount: 1 }, o), false);
  assert.equal(razorpayPaymentMatches({ ...p, order_id: "order_Other" }, o), false);
});
test("receipts escape references and use verified currency, tax and wallet amounts", () => {
  const r = commercialReceipt({
    reference: "<script>bad()</script>",
    sku: "TOPUP5000",
    amount: 300,
    currency: "usd",
    paidAt: "2026-10-25T00:00:00Z",
    balance: 5000,
  });
  assert.match(r.html, /\$3\.00/);
  assert.match(r.html, /&lt;script&gt;/);
  assert.doesNotMatch(r.html, /<script>|aryan.*gmail/);
  assert.throws(() =>
    commercialReceipt({
      reference: "x",
      sku: "PRO_MONTHLY",
      amount: 1.5,
      currency: "inr",
      paidAt: "invalid",
      balance: 0,
    }),
  );
});
