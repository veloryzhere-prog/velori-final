export const INITIAL_REVIEW_DELAY_MS = 2 * 60 * 1000;

export function shouldOpenReviewPrompt({ active, visible, reviewed, dismissed, eligibility }) {
  return active && visible && !reviewed && !dismissed && eligibility !== "ineligible";
}

export function reviewPromptStateForLogin(stored, loginKey) {
  if (stored?.reviewed === true) {
    return { remainingMs: 0, reviewed: true, dismissed: true, loginKey };
  }
  if (!stored || stored.loginKey !== loginKey) {
    return {
      remainingMs: INITIAL_REVIEW_DELAY_MS,
      reviewed: false,
      dismissed: false,
      loginKey,
    };
  }
  const remainingMs =
    typeof stored.remainingMs === "number" && Number.isFinite(stored.remainingMs)
      ? Math.min(INITIAL_REVIEW_DELAY_MS, Math.max(0, stored.remainingMs))
      : INITIAL_REVIEW_DELAY_MS;
  return {
    remainingMs,
    reviewed: false,
    dismissed: stored.dismissed === true,
    loginKey,
  };
}

export function remainingReviewTime(remainingMs, startedAt, now = Date.now()) {
  if (![remainingMs, startedAt, now].every(Number.isFinite)) return 0;
  return Math.max(0, remainingMs - Math.max(0, now - startedAt));
}
