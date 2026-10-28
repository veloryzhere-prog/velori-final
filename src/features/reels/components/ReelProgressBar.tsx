import { m, useMotionValueEvent, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import { useState } from "react";

interface Props {
  progress: MotionValue<number>;
  onSeek?: (fraction: number) => void;
}

export function ReelProgressBar({ progress, onSeek }: Props) {
  const scaleX = useTransform(progress, (value) => Math.min(1, Math.max(0, value)));
  const [progressPercent, setProgressPercent] = useState(() =>
    Math.round(Math.min(1, Math.max(0, progress.get())) * 100),
  );
  useMotionValueEvent(progress, "change", (value) => {
    setProgressPercent(Math.round(Math.min(1, Math.max(0, value)) * 100));
  });

  return (
    <div
      className="reel-progress-bar"
      role="slider"
      aria-label="Reel playback position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progressPercent}
      tabIndex={onSeek ? 0 : -1}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (!onSeek) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width > 0) onSeek((event.clientX - rect.left) / rect.width);
      }}
      onKeyDown={(event) => {
        if (!onSeek || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
        event.preventDefault();
        onSeek(progress.get() + (event.key === "ArrowRight" ? 0.05 : -0.05));
      }}
    >
      <span className="reel-progress-track" />
      <m.span className="reel-progress-fill" style={{ scaleX, transformOrigin: "left" }} />
    </div>
  );
}
