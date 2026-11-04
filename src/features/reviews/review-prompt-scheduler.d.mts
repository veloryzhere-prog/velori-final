export const INITIAL_REVIEW_DELAY_MS: number;

export type ReviewPromptScheduleState = {
  remainingMs: number;
  reviewed: boolean;
  dismissed: boolean;
  loginKey: string;
};

export type ReviewPromptVisibility = {
  active: boolean;
  visible: boolean;
  reviewed: boolean;
  dismissed: boolean;
  eligibility: "unknown" | "eligible" | "ineligible";
};

export function shouldOpenReviewPrompt(state: ReviewPromptVisibility): boolean;

export function reviewPromptStateForLogin(
  stored: Partial<ReviewPromptScheduleState> | null | undefined,
  loginKey: string,
): ReviewPromptScheduleState;

export function remainingReviewTime(remainingMs: number, startedAt: number, now?: number): number;
