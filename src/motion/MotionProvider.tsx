import type { ReactNode } from "react";
import { domMax, LazyMotion, MotionConfig } from "framer-motion";
import { defaultSpring } from "./springs";
import { InterfaceMotionProvider, useInterfaceMotion } from "./InterfaceMotion";

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <InterfaceMotionProvider>
      <MotionRuntime>{children}</MotionRuntime>
    </InterfaceMotionProvider>
  );
}

function MotionRuntime({ children }: { children: ReactNode }) {
  const { reduced } = useInterfaceMotion();
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "never"} transition={defaultSpring}>
      <LazyMotion features={domMax}>{children}</LazyMotion>
    </MotionConfig>
  );
}
