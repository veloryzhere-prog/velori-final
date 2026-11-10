export function resolveViewportMetrics(input: {
  layoutHeight: number;
  visualHeight?: number;
  scale?: number;
  baselineHeight?: number;
  editable?: boolean;
}): { height: number; keyboard: boolean } | null;
