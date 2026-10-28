/** Pinch zoom must never resize the page underneath the user. */
export function resolveViewportMetrics({
  layoutHeight,
  visualHeight,
  scale = 1,
  baselineHeight,
  editable = false,
}) {
  if (
    !Number.isFinite(layoutHeight) ||
    layoutHeight <= 0 ||
    !Number.isFinite(scale) ||
    Math.abs(scale - 1) > 0.02
  )
    return null;
  const height = Math.round(
    Math.min(
      layoutHeight,
      Number.isFinite(visualHeight) && visualHeight > 0 ? visualHeight : layoutHeight,
    ),
  );
  const baseline = Math.max(
    layoutHeight,
    Number.isFinite(baselineHeight) ? baselineHeight : layoutHeight,
  );
  return { height, keyboard: Boolean(editable && baseline - height > 120) };
}
