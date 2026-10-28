import { Camera, Heart, MessageCircle, Send } from "lucide-react";
import "../styles/connection-scene.css";

/** An animated editorial illustration, never a fake feed or account statistic. */
export function ConnectionScene({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`connection-scene${compact ? " is-compact" : ""}`} aria-hidden="true">
      <span className="connection-orbit orbit-one" />
      <span className="connection-orbit orbit-two" />
      <div className="connection-photo">
        <img src="/images/mountains.jpg" alt="" />
        <span>
          <Camera size={13} /> A NEW PERSPECTIVE
        </span>
      </div>
      <div className="connection-note">
        <MessageCircle size={20} />
        <span>
          Find your
          <br />
          <em>kind of people.</em>
        </span>
      </div>
      <span className="connection-signal signal-heart">
        <Heart size={21} />
      </span>
      <span className="connection-signal signal-send">
        <Send size={20} />
      </span>
      <span className="connection-cross">+</span>
      <span className="connection-dot" />
    </div>
  );
}
