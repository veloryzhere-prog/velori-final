import { ArrowDown, ArrowUpRight, Camera, Film, Heart, MessageCircle } from "lucide-react";
import { Link } from "react-router";
export function PinkLandingHero({ from }: { from?: string }) {
  const state = from ? { from } : undefined;
  return (
    <section className="pink-hero" id="your-world">
      <div className="pink-hero-copy">
        <span className="pink-pill">
          <i /> A LITTLE MORE HUMAN.
        </span>
        <h1>
          Your people.
          <br />
          <span>
            Your kind of <em>place.</em>
          </span>
        </h1>
        <p>
          Share what moves you. Find who gets you.
          <br />
          Make the everyday a little more extraordinary.
        </p>
        <div className="pink-hero-actions">
          <Link to="/signup" state={state}>
            Step into your world <ArrowUpRight size={19} />
          </Link>
          <Link to="/explore">
            Explore VELORI <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
      <div className="pink-social-stage" aria-label="Illustration of sharing moments on VELORI">
        <span className="pink-stage-orbit orbit-one" />
        <span className="pink-stage-orbit orbit-two" />
        <figure className="pink-moment-card">
          <img src="/images/friends.jpg" alt="Friends enjoying a moment together" />
          <figcaption>
            <span>THESE ARE THE DAYS.</span>
            <strong>
              More moments.
              <br />
              More us.
            </strong>
            <Heart size={21} />
          </figcaption>
        </figure>
        <figure className="pink-reel-card">
          <img src="/images/coast.jpg" alt="Ocean waves" />
          <span>
            <Film size={17} /> A different perspective.
          </span>
          <figcaption>
            Stay
            <br />
            <em>curious.</em>
          </figcaption>
        </figure>
        <div className="pink-chat-card">
          <span className="pink-mini-label">
            <MessageCircle size={15} /> GOOD CONVERSATIONS START HERE
          </span>
          <p>
            Little messages.
            <br />
            <strong>Big connections.</strong>
          </p>
          <div aria-hidden="true">
            <span>Hey, your world looks good.</span>
            <span>Better with you in it.</span>
            <i>● ● ●</i>
          </div>
          <small>Illustration of a conversation</small>
        </div>
        <span className="pink-floating-note">
          <Camera size={18} /> Make a little memory.
        </span>
        <span className="pink-floating-heart">
          <Heart size={22} />
        </span>
        <span className="pink-stage-word">hello, world.</span>
      </div>
      <a className="pink-scroll" href="#ways-to-connect">
        <ArrowDown size={15} /> KEEP SCROLLING. THERE IS MORE TO YOU.
      </a>
    </section>
  );
}
