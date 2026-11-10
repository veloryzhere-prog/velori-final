import { Heart, MessageCircle, Camera, Play } from "lucide-react";

/** Lightweight CSS geometry: no canvas, WebGL, external assets, or render loop. */
export function MotionSculpture({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`vm-sculpture${compact ? " vm-sculpture-compact" : ""}`} aria-hidden="true">
      <div className="vm-floor" />
      <div className="vm-orbit vm-orbit-one">
        <i />
      </div>
      <div className="vm-orbit vm-orbit-two">
        <i />
      </div>
      <div className="vm-core">
        <Heart strokeWidth={1.4} />
        <span>v</span>
      </div>
      <div className="vm-token vm-token-chat">
        <MessageCircle strokeWidth={1.3} />
        <i />
        <i />
        <i />
      </div>
      <div className="vm-token vm-token-camera">
        <Camera strokeWidth={1.3} />
      </div>
      <div className="vm-token vm-token-play">
        <Play strokeWidth={1.4} />
      </div>
      <span className="vm-satellite vm-satellite-one" />
      <span className="vm-satellite vm-satellite-two" />
    </div>
  );
}

export function MotionAtmosphere() {
  return (
    <div className="vm-atmosphere" aria-hidden="true">
      <i />
      <i />
      <span />
    </div>
  );
}
