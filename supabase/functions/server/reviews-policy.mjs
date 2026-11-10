export const APP_REVIEW_STATES = ["pending", "approved", "rejected", "hidden"];

export function isAppReviewState(value) {
  return typeof value === "string" && APP_REVIEW_STATES.includes(value);
}

export function sanitizeReviewSearch(value) {
  return value
    .trim()
    .slice(0, 120)
    .replace(/[%,_()\\]/g, " ");
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isValidReviewDateRange(startDate, endDate) {
  if ((startDate && !isValidIsoDate(startDate)) || (endDate && !isValidIsoDate(endDate))) {
    return false;
  }
  return !startDate || !endDate || startDate <= endDate;
}
