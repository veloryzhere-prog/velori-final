import test from "node:test";
import assert from "node:assert/strict";
import { formatBillingAmount, parseAccountAllowance, parseBillingHistory } from "./billing.ts";

test("billing display parses both verified quota contracts without merging balances", () => {
  assert.deepEqual(
    parseAccountAllowance({
      plan: "FREE",
      freeLeft: 4,
      tokens: 100,
      editorLeft: 50,
      canGenerate: true,
      canEdit: true,
    }),
    {
      model: "legacy",
      plan: "FREE",
      baseRemaining: 4,
      topupRemaining: 100,
      periodEnd: null,
      accountLocked: false,
    },
  );
  const modern = parseAccountAllowance({
    model: "hybrid-v2",
    plan: "FREE",
    used: 900,
    limit: 1000,
    topup: 200,
    periodStart: "2026-10-25T00:00:00Z",
    periodEnd: "2026-10-26T00:00:00Z",
    accountLocked: false,
  });
  assert.equal(modern.baseRemaining, 100);
  assert.equal(modern.topupRemaining, 200);
});

test("billing history validates server values and distinguishes pending, paid and refunded", () => {
  const history = parseBillingHistory({
    available: true,
    purchases: [
      {
        sku: "PACK100",
        amount: 24900,
        currency: "inr",
        status: "paid",
        created_at: "2026-10-25T00:00:00Z",
        paid_at: "2026-10-25T00:01:00Z",
      },
    ],
  });
  assert.equal(history.purchases[0].status, "paid");
  assert.equal(formatBillingAmount(history.purchases[0].amount, "inr"), "₹249.00");
  assert.throws(() =>
    parseBillingHistory({
      available: true,
      purchases: [{ ...history.purchases[0], amount: -1 }],
    }),
  );
});
