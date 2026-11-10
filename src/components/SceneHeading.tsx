import { MotionAccent } from "../motion/MotionAccent";
import type { ReactNode } from "react";
import { m } from "framer-motion";
import { useInterfaceMotion } from "../motion/InterfaceMotion";
import { MotionSculpture } from "../motion/MotionSculpture";
export function SceneHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  const { reduced } = useInterfaceMotion();
  return (
    <m.header
      className="v-page-heading scene-heading"
      data-has-action={Boolean(action)}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      <div>
        <span className="v-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <MotionAccent />
      </div>
      <MotionSculpture compact />
      {action && <div className="v-page-heading-action">{action}</div>}
    </m.header>
  );
}
