export const INITIAL_REVIEW_DELAY_MS: number;
export const REVIEW_PROMPT_FOLLOW_UP_DELAYS_MS: readonly [number, number];

export type ReviewPromptScheduleState = {
  remainingMs: number;
  reviewed: boolean;
  dismissed: boolean;
  dismissedCount: number;
};

export type ReviewPromptVisibility = {
  active: boolean;
  visible: boolean;
  reviewed: boolean;
  dismissed: boolean;
  eligibility: "unknown" | "eligible" | "ineligible";
};

export function shouldOpenReviewPrompt(state: ReviewPromptVisibility): boolean;

export function reviewPromptDelayForDismissals(dismissedCount: number): number;

export function reviewPromptStateForUser(
  stored: Partial<ReviewPromptScheduleState> | null | undefined,
): ReviewPromptScheduleState;

export function remainingReviewTime(remainingMs: number, startedAt: number, now?: number): number;

export function reviewSubmissionErrorMessage(
  error: {
    code?: string;
    message?: string;
  } | null,
): string;
