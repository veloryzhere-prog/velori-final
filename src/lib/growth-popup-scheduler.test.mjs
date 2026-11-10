import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GROWTH_POPUP_LOCK_MAX_AGE_MS,
  GROWTH_POPUP_MIN_GAP_MS,
  growthPopupCooldownRemaining,
  isCriticalGrowthPopupRoute,
  isGrowthPopupLockedByOtherTab,
} from "./growth-popup-scheduler.mjs";

test("the popup cooldown is five seconds after close", () => {
  assert.equal(GROWTH_POPUP_MIN_GAP_MS, 5_000);
  assert.equal(growthPopupCooldownRemaining(10_000, 10_000), 5_000);
  assert.equal(growthPopupCooldownRemaining(10_000, 12_500), 2_500);
  assert.equal(growthPopupCooldownRemaining(10_000, 15_000), 0);
  assert.equal(growthPopupCooldownRemaining(10_000, 20_000), 0);
});

test("invalid or future close timestamps do not create a blocking cooldown", () => {
  assert.equal(growthPopupCooldownRemaining("not-a-date", 10_000), 0);
  assert.equal(growthPopupCooldownRemaining(12_000, 10_000), 5_000);
  assert.equal(growthPopupCooldownRemaining(null, 10_000), 0);
});

test("another tab holds the popup while its lock is fresh", () => {
  const lock = { owner: "tab-a", openedAt: 20_000 };
  assert.equal(isGrowthPopupLockedByOtherTab(lock, "tab-b", 25_000), true);
  assert.equal(isGrowthPopupLockedByOtherTab(lock, "tab-a", 25_000), false);
  assert.equal(
    isGrowthPopupLockedByOtherTab(lock, "tab-b", 20_000 + GROWTH_POPUP_LOCK_MAX_AGE_MS),
    false,
  );
});

test("malformed locks do not block popups", () => {
  assert.equal(isGrowthPopupLockedByOtherTab(null, "tab-b", 25_000), false);
  assert.equal(
    isGrowthPopupLockedByOtherTab({ owner: "tab-a", openedAt: "20" }, "tab-b", 25_000),
    false,
  );
  assert.equal(
    isGrowthPopupLockedByOtherTab({ owner: "tab-a", openedAt: 30_000 }, "tab-b", 25_000),
    false,
  );
});

test("critical account and admin routes do not open promotional dialogs", () => {
  for (const route of [
    "/admin",
    "/admin/business-growth",
    "/login",
    "/signup",
    "/verify-email",
    "/auth/check-email",
    "/auth/confirm",
    "/forge/pricing",
    "/forge/account/subscription",
  ]) {
    assert.equal(isCriticalGrowthPopupRoute(route), true, route);
  }
  assert.equal(isCriticalGrowthPopupRoute("/home"), false);
  assert.equal(isCriticalGrowthPopupRoute("/forge/rewards"), false);
});
