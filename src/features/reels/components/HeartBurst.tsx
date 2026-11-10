import { m } from "framer-motion";
import { Heart } from "lucide-react";
import { useInterfaceMotion } from "../../../motion/InterfaceMotion";
export function HeartBurst({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const reduced = useInterfaceMotion().reduced;
  if (!visible) return null;
  return (
    <div className="reel-heart-burst" aria-hidden="true">
      <m.div
        className="rv-bloom-ring"
        initial={{ opacity: 0, scale: 0.3 }}
        animate={
          reduced ? { opacity: [0, 0.5, 0] } : { opacity: [0, 0.6, 0], scale: [0.3, 1.5, 1.8] }
        }
        transition={{ duration: 0.7 }}
      />
      <m.div
        className="rv-bloom-heart"
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.2, rotate: -18 }}
        animate={
          reduced
            ? { opacity: [0, 1, 0] }
            : {
                opacity: [0, 1, 1, 0],
                scale: [0.2, 1.2, 1, 0.9],
                rotate: [-18, 8, -4, 0],
                y: [10, -8, -8, -25],
              }
        }
        transition={{
          duration: reduced ? 0.3 : 0.8,
          times: reduced ? undefined : [0, 0.25, 0.65, 1],
        }}
        onAnimationComplete={onDone}
      >
        <Heart size={104} fill="url(#velori-heart-gloss)" stroke="white" strokeWidth={0.5} />
        <svg width="0" height="0">
          <defs>
            <linearGradient id="velori-heart-gloss" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#fff0b7" />
              <stop offset=".4" stopColor="#ff78aa" />
              <stop offset="1" stopColor="#d93471" />
            </linearGradient>
          </defs>
        </svg>
      </m.div>
      {!reduced &&
        Array.from({ length: 7 }, (_, i) => (
          <m.i
            key={i}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.2 }}
            animate={{
              opacity: [0, 1, 0],
              x: Math.cos((i * 2 * Math.PI) / 7) * 95,
              y: Math.sin((i * 2 * Math.PI) / 7) * 95,
              scale: [0.2, 1, 0],
            }}
            transition={{ duration: 0.65, delay: 0.08 }}
          />
        ))}
    </div>
  );
}
