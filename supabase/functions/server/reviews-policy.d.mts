export const APP_REVIEW_STATES:
  readonly ("pending" | "approved" | "rejected" | "hidden")[];
export function isAppReviewState(
  value: unknown,
): value is "pending" | "approved" | "rejected" | "hidden";
export function sanitizeReviewSearch(value: string): string;
export function isValidIsoDate(value: string): boolean;
export function isValidReviewDateRange(
  startDate: string,
  endDate: string,
): boolean;
