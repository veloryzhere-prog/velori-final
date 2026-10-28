export function reelSwipeDirection(dx, dy, elapsed) {
  const threshold = elapsed < 300 ? 36 : 64;
  return Math.abs(dy) >= threshold && Math.abs(dy) > Math.abs(dx) * 1.2 ? (dy < 0 ? 1 : -1) : 0;
}
export function reelWheelDirection(sum, delta) {
  const next = sum + delta;
  return { sum: next, direction: Math.abs(next) >= 70 ? (next > 0 ? 1 : -1) : 0 };
}
