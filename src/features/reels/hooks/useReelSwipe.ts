import { useCallback, useState } from "react";
import type { PanInfo } from "framer-motion";
import { useMotionValue, useSpring } from "framer-motion";
import { SPRINGS } from "../constants";

interface Config {
  total: number;
  index: number;
  onIndexChange: (index: number) => void;
  onDismiss?: () => void;
}

export function useReelSwipe({ total, index, onIndexChange, onDismiss }: Config) {
  const y = useMotionValue(0);
  const springY = useSpring(y, SPRINGS.default);
  const [isDragging, setIsDragging] = useState(false);

  const onDragStart = useCallback(() => setIsDragging(true), []);
  const onDrag = useCallback(() => {}, []);
  const onDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, { offset, velocity }: PanInfo) => {
      setIsDragging(false);
      y.set(0);
      if (offset.y < -150 || velocity.y < -600) {
        if (index < total - 1) onIndexChange(index + 1);
        else onDismiss?.();
      } else if (offset.y > 150 || velocity.y > 600) {
        if (index > 0) onIndexChange(index - 1);
      }
    },
    [index, onDismiss, onIndexChange, total, y],
  );

  return { y, springY, isDragging, onDragStart, onDrag, onDragEnd };
}
