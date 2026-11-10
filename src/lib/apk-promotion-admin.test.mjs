import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apkOnlyAnnouncementName,
  apkPromotionLabelFromName,
  apkPromotionKindFromName,
  apkPromotionMutationError,
  isApkOnlyAnnouncementName,
} from "./apk-promotion-admin.mjs";

test("APK-only announcement names encode supported promotion kinds", () => {
  const name = apkOnlyAnnouncementName("referral", "Invite a friend");
  assert.equal(name, "APK_ONLY:referral: Invite a friend");
  assert.equal(isApkOnlyAnnouncementName(name), true);
  assert.equal(apkPromotionKindFromName(name), "referral");
  assert.equal(apkPromotionLabelFromName(name), "Invite a friend");
  assert.equal(apkOnlyAnnouncementName("referral", name), "APK_ONLY:referral: Invite a friend");
});

test("APK-only announcement markers are recognized case-insensitively", () => {
  assert.equal(isApkOnlyAnnouncementName("apk_only:REWARD: Welcome"), true);
  assert.equal(apkPromotionKindFromName("apk_only:REWARD: Welcome"), "reward");
});

test("ordinary announcements are not treated as APK-only promotions", () => {
  assert.equal(isApkOnlyAnnouncementName("Spring announcement"), false);
  assert.equal(apkPromotionKindFromName("Spring announcement"), null);
});

test("APK-only announcement names remain within the database length limit", () => {
  const name = apkOnlyAnnouncementName("welcome", "x".repeat(200));
  assert.equal(name.length, 120);
  assert.equal(isApkOnlyAnnouncementName(name), true);
});

test("unsupported promotion kinds are rejected", () => {
  assert.throws(() => apkOnlyAnnouncementName("subscription", "Upgrade"), TypeError);
});

test("APK-only targeting cannot be added or removed through announcement edits", () => {
  assert.match(
    apkPromotionMutationError({
      currentName: "Ordinary announcement",
      nextName: "APK_ONLY:welcome: New user",
    }),
    /only be set when a campaign is created/,
  );
  assert.match(
    apkPromotionMutationError({
      currentName: "APK_ONLY:welcome: New user",
      nextName: "Ordinary announcement",
    }),
    /cannot be removed or changed/,
  );
});

test("APK-only promotion kind cannot change and activation remains blocked", () => {
  assert.match(
    apkPromotionMutationError({
      currentName: "APK_ONLY:welcome: New user",
      nextName: "APK_ONLY:reward: New user",
    }),
    /cannot be removed or changed/,
  );
  assert.match(
    apkPromotionMutationError({
      currentName: "APK_ONLY:reward: Gift",
      nextState: "live",
    }),
    /trusted Android installation verification/,
  );
  assert.match(
    apkPromotionMutationError({
      currentName: "APK_ONLY:reward: Gift",
      nextState: "scheduled",
    }),
    /trusted Android installation verification/,
  );
  assert.match(
    apkPromotionMutationError({
      currentName: "APK_ONLY:reward: Gift",
      nextActive: true,
    }),
    /trusted Android installation verification/,
  );
  assert.equal(
    apkPromotionMutationError({
      currentName: "APK_ONLY:reward: Gift",
      nextState: "draft",
      nextActive: false,
    }),
    null,
  );
});
