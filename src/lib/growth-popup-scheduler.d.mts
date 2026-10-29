export const GROWTH_POPUP_MIN_GAP_MS: 5000;
export const GROWTH_POPUP_LOCK_MAX_AGE_MS: number;
export function growthPopupCooldownRemaining(
  lastClosedAt: string | number | null | undefined,
  now?: number,
  minGap?: number,
): number;
export function isGrowthPopupLockedByOtherTab(
  lock: unknown,
  ownerId: string,
  now?: number,
): boolean;
export function isCriticalGrowthPopupRoute(pathname: string): boolean;
