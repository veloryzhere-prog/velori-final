export const GROWTH_POPUP_MIN_GAP_MS = 5_000;
export const GROWTH_POPUP_LOCK_MAX_AGE_MS = 10 * 60 * 1_000;

export function growthPopupCooldownRemaining(
  lastClosedAt,
  now = Date.now(),
  minGap = GROWTH_POPUP_MIN_GAP_MS,
) {
  const closedAt =
    typeof lastClosedAt === "number" ? lastClosedAt : Date.parse(String(lastClosedAt ?? ""));
  if (!Number.isFinite(closedAt) || !Number.isFinite(now) || !Number.isFinite(minGap)) return 0;
  return Math.max(0, minGap - Math.max(0, now - closedAt));
}

export function isGrowthPopupLockedByOtherTab(lock, ownerId, now = Date.now()) {
  if (!lock || typeof lock !== "object") return false;
  const owner = lock.owner;
  const openedAt = lock.openedAt;
  if (typeof owner !== "string" || owner === ownerId || typeof openedAt !== "number") return false;
  return now >= openedAt && now - openedAt < GROWTH_POPUP_LOCK_MAX_AGE_MS;
}

export function isCriticalGrowthPopupRoute(pathname) {
  return (
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/verify-email" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/forge/pricing") ||
    pathname.startsWith("/forge/account/subscription")
  );
}
