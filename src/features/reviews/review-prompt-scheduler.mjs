export const INITIAL_REVIEW_DELAY_MS = 2 * 60 * 1000;
export const REVIEW_PROMPT_FOLLOW_UP_DELAYS_MS = [3 * 60 * 1000, 6 * 60 * 1000];

export function reviewPromptDelayForDismissals(dismissedCount) {
  if (!Number.isInteger(dismissedCount) || dismissedCount < 0 || dismissedCount > 2) return 0;
  return dismissedCount === 0
    ? INITIAL_REVIEW_DELAY_MS
    : REVIEW_PROMPT_FOLLOW_UP_DELAYS_MS[dismissedCount - 1];
}

export function shouldOpenReviewPrompt({ active, visible, reviewed, dismissed, eligibility }) {
  return active && visible && !reviewed && !dismissed && eligibility !== "ineligible";
}

export function reviewPromptStateForUser(stored) {
  if (stored?.reviewed === true) {
    return { remainingMs: 0, reviewed: true, dismissed: true, dismissedCount: 0 };
  }
  const hasDismissalCount = Number.isInteger(stored?.dismissedCount) && stored.dismissedCount >= 0;
  if (!hasDismissalCount) {
    return {
      remainingMs: INITIAL_REVIEW_DELAY_MS,
      reviewed: false,
      dismissed: false,
      dismissedCount: 0,
    };
  }
  const dismissedCount = Math.min(3, stored.dismissedCount);
  const dismissed = stored.dismissed === true || dismissedCount >= 3;
  if (dismissed) {
    return { remainingMs: 0, reviewed: false, dismissed: true, dismissedCount };
  }
  const maxRemainingMs = reviewPromptDelayForDismissals(dismissedCount);
  const remainingMs =
    typeof stored.remainingMs === "number" && Number.isFinite(stored.remainingMs)
      ? Math.min(maxRemainingMs, Math.max(0, stored.remainingMs))
      : maxRemainingMs;
  return {
    remainingMs,
    reviewed: false,
    dismissed: false,
    dismissedCount,
  };
}

export function remainingReviewTime(remainingMs, startedAt, now = Date.now()) {
  if (![remainingMs, startedAt, now].every(Number.isFinite)) return 0;
  return Math.max(0, remainingMs - Math.max(0, now - startedAt));
}

export function reviewSubmissionErrorMessage(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  if (message.includes("review_rate_limited")) return "You’ve already shared a review recently.";
  if (message.includes("invalid_review_text"))
    return "Write a review between 3 and 1,200 characters.";
  if (error?.code === "PGRST202" || error?.code === "42883")
    return "Reviews are temporarily unavailable. Please try again later.";
  return "Your review could not be saved right now. Please try again later.";
}
