import test from "node:test";
import assert from "node:assert/strict";
import {
  commercialPlans,
  quotaState,
  parseCommercialQuota,
  formatCommercialPrice,
  type CommercialQuota,
} from "./commercial.ts";
const q: CommercialQuota = {
  model: "hybrid-v2",
  plan: "FREE",
  used: 899,
  limit: 1000,
  topup: 5000,
  periodStart: "2026-10-25T00:00:00Z",
  periodEnd: "2026-10-26T00:00:00Z",
  accountLocked: false,
};
test("commercial prices use integer minor units and explicit daily/monthly units", () => {
  assert.equal(commercialPlans.FREE.cadence, "day");
  assert.equal(commercialPlans.PRO_MONTHLY.inr, 99900);
  assert.equal(commercialPlans.TOPUP5000.limit, 5000);
  assert.match(formatCommercialPrice("PRO_MONTHLY", "usd"), /12/);
});
test("base balance is used first and topups survive base exhaustion", () => {
  assert.equal(quotaState(q).source, "base");
  assert.equal(quotaState({ ...q, used: 1000 }).source, "topup");
  assert.equal(quotaState({ ...q, used: 1000, topup: 0 }).canRequest, false);
  assert.equal(quotaState({ ...q, used: 1000, topup: -3 }).topupRemaining, 0);
});
test("90 percent warning and administrative locks are independent of purchases", () => {
  assert.equal(quotaState(q).warning, false);
  assert.equal(quotaState({ ...q, used: 900 }).warning, true);
  assert.equal(quotaState({ ...q, accountLocked: true }).canRequest, false);
});
test("quota contract rejects invalid windows, fractional amounts and malformed server data", () => {
  assert.equal(parseCommercialQuota(q), q);
  assert.throws(() => parseCommercialQuota({ ...q, periodEnd: q.periodStart }));
  assert.throws(() => parseCommercialQuota({ ...q, used: 0.5 }));
  assert.throws(() => parseCommercialQuota(null));
});
