import type { Transition } from "framer-motion";

export const defaultSpring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const heavySpring: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 25,
};

export const lightSpring: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

export const pageTransitionTiming: Transition = {
  duration: 0.4,
  ease: "easeOut",
};

export const componentEntranceTiming: Transition = {
  duration: 0.3,
  ease: "easeOut",
};

export const exitTiming: Transition = {
  duration: 0.2,
  ease: "easeIn",
};

export const microInteractionTiming: Transition = {
  duration: 0.2,
  ease: "easeOut",
};
