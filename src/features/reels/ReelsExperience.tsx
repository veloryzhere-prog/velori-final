import { createPortal } from "react-dom";
import { useInterfaceMotion } from "../../motion/InterfaceMotion";
import { LazyMotion, MotionConfig, domMax, m } from "framer-motion";
import { ReelsPage, type ReelsPageProps } from "./ReelsPage";
import "./reels.css";

export function ReelsExperience(props: ReelsPageProps) {
  const reducedMotion = useInterfaceMotion().reduced;

  return createPortal(
    <LazyMotion features={domMax}>
      <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
        <m.div
          className="rv-experience"
          initial={reducedMotion ? false : { opacity: 0, x: 36 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? { opacity: 1 } : { opacity: 0, x: 36 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
        >
          <ReelsPage {...props} />
        </m.div>
      </MotionConfig>
    </LazyMotion>,
    document.body,
  );
}
