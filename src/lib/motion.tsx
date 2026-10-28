import { AnimatePresence, m } from "framer-motion";
import { useInterfaceMotion } from "../motion/InterfaceMotion";
import { Outlet, useLocation } from "react-router";
import type { ReactNode } from "react";
import { listItemMotion, listStagger, pageTransition } from "../motion/variants";
import { defaultSpring, pageTransitionTiming } from "../motion/springs";

export function AnimatedContent({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { reduced: reducedMotion } = useInterfaceMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        className="velori-route-transition"
        key={pathname}
        variants={pageTransition}
        initial={reducedMotion ? false : "hidden"}
        animate="visible"
        exit={reducedMotion ? { opacity: 1 } : "exit"}
        transition={reducedMotion ? { duration: 0 } : pageTransitionTiming}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

export function AnimatedOutlet() {
  return (
    <AnimatedContent>
      <Outlet />
    </AnimatedContent>
  );
}

export function MotionList({ children, className }: { children: ReactNode; className?: string }) {
  const { reduced: reducedMotion } = useInterfaceMotion();

  return (
    <m.div
      className={className}
      role="list"
      variants={listStagger}
      initial={reducedMotion ? false : "hidden"}
      animate={reducedMotion ? undefined : "visible"}
    >
      {children}
    </m.div>
  );
}

export function MotionListItem({ children }: { children: ReactNode }) {
  const { reduced: reducedMotion } = useInterfaceMotion();

  return (
    <m.div
      role="listitem"
      variants={listItemMotion}
      initial={reducedMotion ? false : "hidden"}
      animate={reducedMotion ? undefined : "visible"}
      whileHover={reducedMotion ? undefined : "hover"}
      whileTap={reducedMotion ? undefined : "tap"}
      transition={defaultSpring}
    >
      {children}
    </m.div>
  );
}
