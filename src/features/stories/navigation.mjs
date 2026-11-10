/** A held finger pauses; horizontal swipes navigate; deliberate downward swipes close. */
export function storyGesture(dx, dy, elapsed) {
  if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.25) return "close";
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) return dx < 0 ? "next" : "previous";
  if (Math.hypot(dx, dy) > 16 || elapsed > 280) return "hold";
  return "tap";
}
