import { Heart, MessageCircle } from "lucide-react";
export function AuthEditorial() {
  return (
    <aside className="auth-editorial clean-auth-story">
      <span className="clean-label">A LITTLE MORE CONNECTED.</span>
      <h2>
        Your world.
        <br />
        Your people.
        <br />
        <span>Your VELORI.</span>
      </h2>
      <div className="clean-auth-image">
        <img src="/images/friends.jpg" alt="Friends spending time together" />
        <span>
          <Heart size={17} /> Moments worth keeping.
        </span>
      </div>
      <p>
        <MessageCircle size={16} /> Good conversations are waiting.
      </p>
    </aside>
  );
}
