import {
  ArrowRight,
  Compass,
  Film,
  LockKeyhole,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";
import { isNativeAndroid } from "../lib/native-android";
import "./native-android.css";

export function NativeAndroidWelcome({ from }: { from: string }) {
  if (!isNativeAndroid()) return null;

  const signInState = { from };
  return (
    <main className="native-welcome">
      <header className="native-welcome-brand">
        <span className="native-welcome-mark">
          <img src="/velori-wing-mark.png" alt="" />
        </span>
        <span>VELORI</span>
      </header>

      <section className="native-welcome-hero" aria-labelledby="native-welcome-title">
        <p className="native-welcome-eyebrow">A little more human</p>
        <h1 id="native-welcome-title">Find your people. Feel at home.</h1>
        <p className="native-welcome-description">
          Share the moments that matter and discover a community that feels like yours.
        </p>
        <div className="native-welcome-actions">
          <Link className="native-welcome-primary" to="/signup" state={signInState}>
            Create your account <ArrowRight size={18} />
          </Link>
          <Link className="native-welcome-secondary" to="/login" state={signInState}>
            I already have an account
          </Link>
        </div>
      </section>

      <section className="native-welcome-highlights" aria-label="Explore VELORI">
        <article>
          <span className="native-highlight-icon">
            <Compass size={20} />
          </span>
          <div>
            <strong>Find your corner</strong>
            <span>Discover people and ideas</span>
          </div>
        </article>
        <article>
          <span className="native-highlight-icon">
            <Film size={20} />
          </span>
          <div>
            <strong>Stories in motion</strong>
            <span>Watch and share short videos</span>
          </div>
        </article>
        <article>
          <span className="native-highlight-icon">
            <MessageCircle size={20} />
          </span>
          <div>
            <strong>Stay connected</strong>
            <span>Make room for real conversation</span>
          </div>
        </article>
      </section>

      <footer className="native-welcome-footer">
        <LockKeyhole size={15} />
        <span>Your space, your pace.</span>
        <Link to="/about" aria-label="About VELORI">
          <UserRound size={17} />
        </Link>
      </footer>
    </main>
  );
}
