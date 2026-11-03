import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  APP_REVIEW_STATES,
  isAppReviewState,
  isValidIsoDate,
  isValidReviewDateRange,
  sanitizeReviewSearch,
} from "../../../supabase/functions/server/reviews-policy.mjs";

test("review moderation accepts only the supported lifecycle states", () => {
  assert.deepEqual(APP_REVIEW_STATES, ["pending", "approved", "rejected", "hidden"]);
  for (const status of APP_REVIEW_STATES) assert.equal(isAppReviewState(status), true);
  for (const status of ["deleted", "", null, 2]) assert.equal(isAppReviewState(status), false);
});

test("review search is bounded and removes PostgREST filter operators", () => {
  assert.equal(sanitizeReviewSearch("  nice%_,(text)\\  "), "nice    text  ");
  assert.equal(sanitizeReviewSearch("a".repeat(150)).length, 120);
});

test("review date filters validate actual calendar dates and chronological ranges", () => {
  assert.equal(isValidIsoDate("2028-02-29"), true);
  assert.equal(isValidIsoDate("2027-02-29"), false);
  assert.equal(isValidReviewDateRange("2026-01-02", "2026-01-01"), false);
  assert.equal(isValidReviewDateRange("2026-01-01", "2026-01-02"), true);
  assert.equal(isValidReviewDateRange("", "2026-01-02"), true);
});

test("review migration keeps raw rows private and public RPCs approved-only", () => {
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20261108000000_velori_app_reviews.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /alter table public\.app_reviews enable row level security/i);
  assert.match(migration, /revoke all on public\.app_reviews from public, anon, authenticated/i);
  assert.doesNotMatch(migration, /create policy [^;]*app_reviews/i);
  assert.match(migration, /where r\.status = 'approved'/i);
  assert.match(migration, /when p\.is_private then 'VELORI member'/i);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(v_profile_id::text, 0\)\)/i);
  assert.match(migration, /interval '30 days'/i);
});

test("automatic review eligibility requires verified lifetime submission status", () => {
  const statusMigration = readFileSync(
    new URL(
      "../../../supabase/migrations/20261109000000_review_lifetime_status.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const component = readFileSync(new URL("./AppReviews.tsx", import.meta.url), "utf8");
  assert.match(statusMigration, /'has_submitted',\s*v_last_review is not null/i);
  assert.match(component, /typeof status\.has_submitted !== "boolean"/);
  assert.match(component, /if \(status\.has_submitted \|\| !status\.can_submit\)/);
  assert.match(component, /document\.visibilityState !== "visible"/);
});

test("review submission is guarded against same-tick duplicate requests", () => {
  const component = readFileSync(new URL("./AppReviews.tsx", import.meta.url), "utf8");
  const automaticPrompt = component.slice(
    component.indexOf("export function ReviewAutoPrompt"),
    component.indexOf("export function ReviewInvitation"),
  );
  assert.match(automaticPrompt, /const submittingRef = useRef\(false\)/);
  assert.match(automaticPrompt, /submittingRef\.current\) return/);
  assert.match(automaticPrompt, /submittingRef\.current = false/);
  assert.match(automaticPrompt, /window\.addEventListener\("online", refresh\)/);
  assert.match(automaticPrompt, /randomReviewDelayMinutes\(\), false, true/);
  assert.match(component, /INITIAL_REVIEW_DELAY_MS = 2 \* 60 \* 1000/);
  assert.match(component, /disabled=\{Boolean\(user\) && available === null\}/);
});

test("notification opt-in is offered per signed-in device session when push is off", () => {
  const experience = readFileSync(
    new URL("../../lib/native-notification-experience.tsx", import.meta.url),
    "utf8",
  );
  assert.match(experience, /window\.sessionStorage\.getItem\(DISMISSED_KEY\)/);
  assert.match(experience, /window\.sessionStorage\.removeItem\(DISMISSED_KEY\)/);
  assert.match(experience, /state !== null && \(!state\.permissionGranted \|\| !state\.optedIn\)/);
  assert.match(
    experience,
    /webPushAvailable &&\s*\(webPushSupport === "permission-denied" \|\| webPushEnabled === false\)/,
  );
  assert.match(experience, /enableOneSignalWebPush\(user\.id\)/);
});

test("mobile conversation selection expands the active thread over the workspace", () => {
  const styles = readFileSync(new URL("../../styles/inbox-finish.css", import.meta.url), "utf8");
  const browserTest = readFileSync(
    new URL("../../../e2e/qa-matrix.spec.ts", import.meta.url),
    "utf8",
  );
  assert.match(styles, /\.messages-thread-visible-mobile\s*\{\s*position:\s*absolute !important/);
  assert.match(browserTest, /senderMirrorPage\.setViewportSize\(\{ width: 390, height: 844 \}\)/);
  assert.match(browserTest, /selected conversation did not open on mobile/);
});
