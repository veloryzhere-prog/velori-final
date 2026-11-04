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
import {
  INITIAL_REVIEW_DELAY_MS,
  remainingReviewTime,
  reviewPromptDelayForDismissals,
  reviewPromptStateForUser,
  reviewSubmissionErrorMessage,
  shouldOpenReviewPrompt,
} from "./review-prompt-scheduler.mjs";

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

test("review prompt timing escalates across three user dismissals", () => {
  assert.equal(INITIAL_REVIEW_DELAY_MS, 120_000);
  assert.deepEqual(reviewPromptStateForUser(null), {
    remainingMs: 120_000,
    reviewed: false,
    dismissed: false,
    dismissedCount: 0,
  });
  assert.deepEqual(
    reviewPromptStateForUser({
      loginKey: "login-a",
      remainingMs: 45_000,
      dismissed: false,
      dismissedCount: 1,
    }),
    {
      remainingMs: 45_000,
      reviewed: false,
      dismissed: false,
      dismissedCount: 1,
    },
  );
  assert.equal(reviewPromptDelayForDismissals(0), 120_000);
  assert.equal(reviewPromptDelayForDismissals(1), 180_000);
  assert.equal(reviewPromptDelayForDismissals(2), 360_000);
  assert.equal(reviewPromptDelayForDismissals(3), 0);
  assert.deepEqual(
    reviewPromptStateForUser({
      remainingMs: 60_000,
      reviewed: false,
      dismissed: true,
      dismissedCount: 3,
    }),
    { remainingMs: 0, reviewed: false, dismissed: true, dismissedCount: 3 },
  );
  assert.deepEqual(
    reviewPromptStateForUser({ remainingMs: 45_000, reviewed: false, dismissed: true }),
    {
      remainingMs: 120_000,
      reviewed: false,
      dismissed: false,
      dismissedCount: 0,
    },
  );
  assert.deepEqual(reviewPromptStateForUser({ reviewed: true, dismissed: true }), {
    remainingMs: 0,
    reviewed: true,
    dismissed: true,
    dismissedCount: 0,
  });
  assert.equal(remainingReviewTime(120_000, 10_000, 85_000), 45_000);
  assert.equal(remainingReviewTime(120_000, 10_000, 130_000), 0);
  const promptVisibility = {
    active: true,
    visible: true,
    reviewed: false,
    dismissed: false,
    eligibility: "unknown",
  };
  assert.equal(shouldOpenReviewPrompt(promptVisibility), true);
  assert.equal(shouldOpenReviewPrompt({ ...promptVisibility, dismissed: true }), false);
  assert.equal(shouldOpenReviewPrompt({ ...promptVisibility, reviewed: true }), false);
  assert.equal(shouldOpenReviewPrompt({ ...promptVisibility, visible: false }), false);
  assert.equal(shouldOpenReviewPrompt({ ...promptVisibility, eligibility: "ineligible" }), false);
  assert.equal(
    reviewSubmissionErrorMessage({ code: "PGRST202", message: "Internal schema detail" }),
    "Reviews are temporarily unavailable. Please try again later.",
  );
  assert.equal(
    reviewSubmissionErrorMessage({ message: "review_rate_limited" }),
    "You’ve already shared a review recently.",
  );
});

test("automatic review eligibility supports legacy status responses and preserves lifetime guards", () => {
  const statusMigration = readFileSync(
    new URL(
      "../../../supabase/migrations/20261109000000_review_lifetime_status.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const component = readFileSync(new URL("./AppReviews.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("../../app/shell.tsx", import.meta.url), "utf8");
  const productFrame = readFileSync(
    new URL("../../product/ProductFrame.tsx", import.meta.url),
    "utf8",
  );
  assert.match(statusMigration, /'has_submitted',\s*v_last_review is not null/i);
  assert.match(component, /hasSubmissionStatus && typeof status\?\.has_submitted !== "boolean"/);
  assert.match(component, /if \(status\.has_submitted === true \|\| !status\.can_submit\)/);
  assert.match(component, /document\.visibilityState !== "visible"/);
  assert.match(component, /retryDelayMs = Math\.min\(retryDelayMs \* 2, 5 \* 60_000\)/);
  assert.match(component, /schedule\(\);\s*void evaluate\(\);/);
  assert.doesNotMatch(component, /pauseTimer\(\);\s*setOpen\(false\);\s*scheduleRetry\(\)/);
  assert.match(shell, /<ReviewAutoPrompt \/>/);
  assert.match(productFrame, /<ReviewAutoPrompt \/>/);
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
  assert.match(automaticPrompt, /dismissedRef\.current = true/);
  assert.match(automaticPrompt, /shouldOpenReviewPrompt\(\{/);
  assert.match(automaticPrompt, /let promptShown = false/);
  assert.match(automaticPrompt, /if \(promptShown \|\| !promptVisible\(\)\) return/);
  assert.match(automaticPrompt, /promptShown = true;\s*setOpen\(true\)/);
  assert.match(component, /reviewPromptStateForUser\(parsed\)/);
  assert.match(component, /velori-review-prompt-v3/);
  assert.match(component, /Don’t show again/);
  assert.match(component, /setScheduleVersion\(\(version\) => version \+ 1\)/);
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
