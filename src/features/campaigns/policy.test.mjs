import { test } from "node:test";
import assert from "node:assert/strict";
import {
  safeCampaignUrl,
  announcementEligible,
  announcementTargetsRoute,
  isForgeAnnouncementEntryRoute,
} from "./policy.mjs";
test("campaign destinations reject script, protocol-relative, credentials and backslash URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "//evil.test",
    "/\\evil.test",
    "https://user:pass@example.com",
    "https://example.com\n",
  ])
    assert.equal(safeCampaignUrl(url), null);
  assert.equal(safeCampaignUrl("/stories?create=1"), "/stories?create=1");
  assert.equal(safeCampaignUrl("https://example.com/path"), "https://example.com/path");
});
test("announcement frequency is not incorrectly capped at one lifetime view", () => {
  const state = { show_count: 12, last: 1000 };
  assert.equal(
    announcementEligible({ frequency_mode: "every_refresh", max_show_count: 1 }, state, true, 2000),
    true,
  );
  assert.equal(
    announcementEligible({ frequency_mode: "once_per_session" }, state, false, 2000),
    true,
  );
  assert.equal(
    announcementEligible({ frequency_mode: "once_per_session" }, state, true, 2000),
    false,
  );
  assert.equal(announcementEligible({ frequency_mode: "once_per_day" }, state, false, 2000), false);
  assert.equal(
    announcementEligible({ frequency_mode: "once_per_day" }, state, false, 86402000),
    true,
  );
});
test("announcement expiry, once-total and configured count limits remain enforced", () => {
  assert.equal(announcementEligible({ ends_at: "2020-01-01" }, {}, false, Date.now()), false);
  assert.equal(announcementEligible({ frequency_mode: "once_total" }, { count: 1 }), false);
  assert.equal(
    announcementEligible({ frequency_mode: "max_count", max_show_count: 3 }, { count: 2 }),
    true,
  );
  assert.equal(
    announcementEligible({ frequency_mode: "max_count", max_show_count: 3 }, { count: 3 }),
    false,
  );
});
test("FORGE-targeted campaigns remain eligible at the project setup checkpoint", () => {
  const item = { target_route: "/forge" };
  assert.equal(announcementTargetsRoute(item, "/forge"), true);
  assert.equal(announcementTargetsRoute(item, "/forge/projects/new"), true);
  assert.equal(announcementTargetsRoute(item, "/forge/pricing"), false);
  assert.equal(isForgeAnnouncementEntryRoute("/forge"), true);
  assert.equal(isForgeAnnouncementEntryRoute("/artifacts"), true);
  assert.equal(isForgeAnnouncementEntryRoute("/forge/projects/new"), true);
  assert.equal(isForgeAnnouncementEntryRoute("/forge/pricing"), false);
  assert.equal(isForgeAnnouncementEntryRoute("/studio/project-id"), false);
  assert.equal(
    announcementTargetsRoute({ target_routes: ["/home"] }, "/forge/projects/new"),
    false,
  );
  assert.equal(announcementTargetsRoute({}, "/forge"), true);
});
test("dismissed and malformed-date campaigns are not eligible", () => {
  assert.equal(
    announcementEligible({ frequency_mode: "every_refresh" }, { dismissed_at: "2026-10-27" }),
    false,
  );
  assert.equal(announcementEligible({ starts_at: "not-a-date" }, {}, false, 1000), false);
  assert.equal(announcementEligible({ ends_at: "not-a-date" }, {}, false, 1000), false);
});
