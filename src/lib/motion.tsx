import { AnimatePresence, m } from "framer-motion";
import { useInterfaceMotion } from "../motion/InterfaceMotion";
import { Outlet, useLocation } from "react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { listItemMotion, listStagger } from "../motion/variants";
import { defaultSpring } from "../motion/springs";
import { useMotion } from "./motion-provider";

function routeTransitionVariants(preset: string) {
  if (preset === "page-slide" || preset === "fade-right" || preset === "fade-left") {
    const direction = preset === "fade-left" ? -1 : 1;
    return {
      hidden: { opacity: 0, x: 12 * direction },
      visible: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -6 * direction },
    };
  }
  if (preset === "fade-up") {
    return {
      hidden: { opacity: 0, y: 12 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -6 },
    };
  }
  if (preset === "fade-down") {
    return {
      hidden: { opacity: 0, y: -12 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 6 },
    };
  }
  if (preset === "scale-soft" || preset === "modal-rise") {
    return {
      hidden: { opacity: 0, scale: 0.985 },
      visible: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.995 },
    };
  }
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };
}

const transitionEasing = {
  standard: "easeOut",
  "ease-in": "easeIn",
  "ease-out": "easeOut",
  "ease-in-out": "easeInOut",
  smooth: [0.22, 1, 0.36, 1],
} as const;

function useMobileViewport() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    update();
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}

export function AnimatedContent({
  children,
  animateOnMount = false,
}: {
  children: ReactNode;
  animateOnMount?: boolean;
}) {
  const { pathname } = useLocation();
  const { reduced: reducedMotion } = useInterfaceMotion();
  const { config } = useMotion();
  const mobile = useMobileViewport();
  const { global } = config;
  const preset = global.transitionPreset;

  if (
    reducedMotion ||
    !global.enabled ||
    !global.pageTransitionsEnabled ||
    (mobile && !global.mobileAnimationsEnabled) ||
    preset === "none" ||
    global.intensity === "off"
  ) {
    return <>{children}</>;
  }

  const durationMultiplier = global.speed === "slow" ? 1.35 : global.speed === "fast" ? 0.75 : 1;
  const duration = Math.max(0, Math.round(global.transitionDurationMs * durationMultiplier)) / 1000;
  const transition =
    global.easing === "spring"
      ? { type: "spring" as const, duration, bounce: 0.12 }
      : { duration, ease: transitionEasing[global.easing] ?? transitionEasing.smooth };

  return (
    <AnimatePresence mode="sync" initial={!animateOnMount}>
      <m.div
        className="velori-route-transition"
        key={pathname}
        variants={routeTransitionVariants(preset)}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={transition}
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
  const { config } = useMotion();
  const cardRule = config.componentRules.find((rule) => rule.componentId === "card-hover");
  const enabled =
    !reducedMotion &&
    config.global.enabled &&
    config.global.intensity !== "off" &&
    config.global.cardAnimationsEnabled &&
    cardRule?.enabled !== false &&
    cardRule?.intensity !== "off";

  return (
    <m.div
      className={className}
      role="list"
      variants={listStagger}
      initial={enabled ? "hidden" : false}
      animate={enabled ? "visible" : undefined}
    >
      {children}
    </m.div>
  );
}

export function MotionListItem({ children }: { children: ReactNode }) {
  const { reduced: reducedMotion } = useInterfaceMotion();
  const { config } = useMotion();
  const cardRule = config.componentRules.find((rule) => rule.componentId === "card-hover");
  const buttonRule = config.componentRules.find((rule) => rule.componentId === "button-hover");
  const enabled =
    !reducedMotion &&
    config.global.enabled &&
    config.global.intensity !== "off" &&
    config.global.cardAnimationsEnabled &&
    cardRule?.enabled !== false &&
    cardRule?.intensity !== "off";
  const hoverEnabled =
    enabled && config.global.hoverAnimationsEnabled && config.global.cardAnimationsEnabled;
  const buttonEnabled =
    !reducedMotion &&
    config.global.enabled &&
    config.global.intensity !== "off" &&
    config.global.buttonAnimationsEnabled &&
    buttonRule?.enabled !== false &&
    buttonRule?.intensity !== "off";

  return (
    <m.div
      role="listitem"
      variants={listItemMotion}
      initial={enabled ? "hidden" : false}
      animate={enabled ? "visible" : undefined}
      whileHover={hoverEnabled ? "hover" : undefined}
      whileTap={buttonEnabled ? "tap" : undefined}
      transition={defaultSpring}
    >
      {children}
    </m.div>
  );
}
