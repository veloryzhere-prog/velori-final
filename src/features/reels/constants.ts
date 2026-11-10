import type { Transition } from "framer-motion";

export const SPRINGS = {
  default: { type: "spring", stiffness: 300, damping: 30 } satisfies Transition,
  heavy: { type: "spring", stiffness: 200, damping: 25 } satisfies Transition,
  light: { type: "spring", stiffness: 400, damping: 30 } satisfies Transition,
  bounce: { type: "spring", stiffness: 400, damping: 15 } satisfies Transition,
};

export const GLASS = {
  bg: "rgba(255, 255, 255, 0.08)",
  bgHover: "rgba(255, 255, 255, 0.12)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  shadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  blur: "blur(20px)",
  radius: "16px",
};

export const TIMING = {
  micro: 0.2,
  entrance: 0.3,
  page: 0.4,
  exit: 0.2,
  stagger: 0.05,
};

export const commentListVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: TIMING.stagger } },
};

export const commentItemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRINGS.default },
};
