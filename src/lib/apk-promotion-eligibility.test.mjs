import { test } from "node:test";
import assert from "node:assert/strict";
import { isEligibleForApkPromotions } from "./apk-promotion-eligibility.mjs";

test("APK promotions remain disabled until trusted native verification is implemented", () => {
  assert.equal(isEligibleForApkPromotions(), false);
});
