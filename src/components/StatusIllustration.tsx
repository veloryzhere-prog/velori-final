import { CloudOff, Compass, Heart, LockKeyhole, Settings2, Sparkles } from "lucide-react";
import { useInterfaceMotion } from "../motion/InterfaceMotion";

/** Decorative geometry only: never represents live service progress. */
export function StatusIllustration({
  kind = "error",
  animated = true,
}: {
  kind?: "maintenance" | "offline" | "missing" | "locked" | "error";
  animated?: boolean;
}) {
  const { mode } = useInterfaceMotion();
  const Icon =
    kind === "maintenance"
      ? Settings2
      : kind === "offline"
        ? CloudOff
        : kind === "missing"
          ? Compass
          : kind === "locked"
            ? LockKeyhole
            : Heart;
  return (
    <div
      className="status-scene"
      data-status={kind}
      data-animate={animated && mode === "full"}
      aria-hidden="true"
    >
      <div className="status-scene-orbit" />
      <div className="status-scene-orbit status-scene-orbit-inner" />
      <div className="status-scene-shadow" />
      <div className="status-scene-window">
        <div className="status-window-chrome">
          <i />
          <i />
          <i />
          <span>velori</span>
        </div>
        <div className="status-scene-symbol">
          <Icon strokeWidth={1.5} />
        </div>
        <div className="status-window-lines">
          <i />
          <i />
        </div>
      </div>
      <span className="status-scene-token">
        <Sparkles size={23} />
      </span>
      <span className="status-scene-dot" />
    </div>
  );
}
