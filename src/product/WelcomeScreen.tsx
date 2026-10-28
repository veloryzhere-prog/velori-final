import { InformationFooter } from "../features/information/InformationPage";
import { MotionAtmosphere, MotionSculpture } from "../motion/MotionSculpture";
import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Code2,
  Film,
  MessageCircle,
  ShieldCheck,
  X,
  Heart,
  Plus,
} from "lucide-react";
import { useSiteSettings } from "../lib/site-settings";
const formats = [
  {
    name: "Post your perspective",
    text: "Photos, thoughts, and everything in between.",
    to: "/create",
    icon: Camera,
  },
  {
    name: "Make a little movie",
    text: "Create a reel that feels like you.",
    to: "/reels/create",
    icon: Film,
  },
  {
    name: "Keep it between friends",
    text: "A conversation is a good place to start.",
    to: "/messages",
    icon: MessageCircle,
  },
];
export function WelcomeScreen({ from }: { from?: string }) {
  const settings = useSiteSettings();
  const [notice, setNotice] = useState(true);
  const state = from ? { from } : undefined;
  return (
    <div className="v-entry">
      <MotionAtmosphere />
      <header className="v-public-header">
        <Link to="/" className="v-wordmark">
          <span className="v-brand-mark">
            <img src="/velori-wing-mark.png" alt="" />
          </span>
          VELORI
        </Link>
        <nav aria-label="Public navigation">
          <a href="#your-world">Why VELORI</a>
          <Link to="/safety">Safety</Link>
          <Link to="/forge">Forge AI</Link>
          <Link to="/help">Help</Link>
        </nav>
        <Link to="/forge" className="v-forge-fab" aria-label="Open FORGE AI" title="Open FORGE AI">
          <Code2 size={20} />
        </Link>
        <div>
          <Link to="/login" state={state}>
            Log in
          </Link>
          <Link className="v-button v-button-dark" to="/signup" state={state}>
            <span className="v-join-full">Join the circle</span>
            <span className="v-join-short">Join</span> <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      {notice && settings.announcement_text && (
        <div className="v-public-notice">
          {settings.announcement_text}
          <button aria-label="Dismiss announcement" onClick={() => setNotice(false)}>
            <X size={16} />
          </button>
        </div>
      )}
      <main>
        <section className="v-welcome">
          <div className="v-welcome-copy">
            <span className="v-eyebrow">
              <span />
              MAKE ROOM FOR REAL CONNECTION
            </span>
            <h1>
              Less scrolling.
              <br />
              More <mark>living.</mark>
              <br />
              Together.
            </h1>
            <p>
              Your people, your stories, your little corner of the internet. A social space that
              feels like you.
            </p>
            <div className="v-welcome-actions">
              <Link className="v-button v-button-dark" to="/signup" state={state}>
                Find your circle <ArrowRight size={18} />
              </Link>
              <Link to="/login" state={state}>
                Already here? Log in
              </Link>
            </div>
            <div className="v-welcome-signature">
              <span className="v-small-flower">✳</span>
              <p>
                A place for everyday stories.
                <br />
                <strong>And the people behind them.</strong>
              </p>
            </div>
          </div>
          <div
            data-depth-surface
            className="v-social-board"
            aria-label="Illustration of everyday moments"
          >
            <MotionSculpture compact />
            <div className="v-board-title">
              <span>THE GOOD PARTS OF EVERYDAY</span>
              <span className="v-board-dot" />
            </div>
            <div className="v-board-stories">
              {["friends", "coast", "mountains"].map((x, i) => (
                <div key={x}>
                  <img src={"/images/" + x + ".jpg"} alt="" />
                  <span>{["Together", "Somewhere", "Outside"][i]}</span>
                </div>
              ))}
              <Link to="/stories/create">
                <span className="v-story-plus">
                  <Plus size={22} />
                </span>
                <span>Your story</span>
              </Link>
            </div>
            <figure className="v-board-photo">
              <img src="/images/friends.jpg" alt="Friends sharing an afternoon together" />
              <figcaption>
                <span>
                  <strong>Collect moments.</strong>
                  <small>Keep the people.</small>
                </span>
                <Heart size={24} />
              </figcaption>
            </figure>
            <div className="v-board-bottom">
              <div>
                <span className="v-mini-avatar">☺</span>
                <span>
                  <strong>Good company.</strong>
                  <small>That's what it's all about.</small>
                </span>
              </div>
              <MessageCircle size={22} />
            </div>
            <div className="v-board-sticker">
              <span>✳</span>MADE FOR
              <br />
              YOUR KIND OF PEOPLE
            </div>
          </div>
        </section>
        <section className="v-format-section" id="your-world">
          <div className="v-section-heading">
            <span className="v-eyebrow">EVERY VERSION OF YOU</span>
            <h2>Share it your way.</h2>
            <p>A big idea or a small moment. There’s room for both.</p>
          </div>
          <div className="v-format-grid">
            {formats.map(({ name, text, to, icon: Icon }, i) => (
              <Link to={to} key={to}>
                <span className="v-format-number">0{i + 1}</span>
                <Icon size={29} />
                <h3>{name}</h3>
                <p>{text}</p>
                <span className="v-format-arrow">
                  <ArrowUpRight size={22} />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="v-safety-banner">
          <ShieldCheck size={33} />
          <div>
            <h2>Your circle. Your boundaries.</h2>
            <p>Choose your audience, manage your privacy, and feel at home.</p>
          </div>
          <Link to="/safety">
            Explore your controls <ArrowUpRight size={18} />
          </Link>
        </section>
        <section className="v-final-invite">
          <span>YOUR NEXT GOOD CONNECTION STARTS HERE</span>
          <h2>Come as you are.</h2>
          <Link className="v-button v-button-dark" to="/signup" state={state}>
            Make yourself at home <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <InformationFooter />
    </div>
  );
}
