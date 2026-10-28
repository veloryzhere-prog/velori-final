import { type ReactNode, type RefObject } from "react";
import { Link, NavLink } from "react-router";
import { ArrowUpRight, ImagePlus, Film, Camera, RotateCw, Bookmark, Compass } from "lucide-react";
import { useFeatureFlag } from "../lib/feature-flags";
export function FeedScreen({
  name,
  avatar,
  stories,
  children,
  recommendations,
  loading,
  refresh,
}: {
  name?: string | null;
  avatar?: string | null;
  stories: ReactNode;
  children: ReactNode;
  recommendations: ReactNode;
  loading: boolean;
  refresh: () => void;
}) {
  const reelsEnabled = useFeatureFlag("reels_enabled", true),
    storiesEnabled = useFeatureFlag("stories_enabled", true);
  return (
    <div className="v-home">
      <div className="v-home-main">
        <header className="v-feed-title">
          <div>
            <span className="v-eyebrow">YOUR WORLD. YOUR PEOPLE.</span>
            <h1>Home</h1>
          </div>
          <button
            className="v-refresh"
            onClick={refresh}
            disabled={loading}
            aria-label={loading ? "Refreshing feed" : "Refresh feed"}
          >
            <RotateCw size={18} />
            <span>Refresh</span>
          </button>
        </header>
        <section className="v-stories-section" aria-label="Stories from your circle">
          {stories}
        </section>
        <section className="v-share-box" aria-label="Create a new moment">
          <Link to="/create" className="v-share-prompt">
            <span className="v-avatar">
              {avatar ? <img src={avatar} alt="" /> : (name || "V").slice(0, 1)}
            </span>
            <span>What’s worth sharing today?</span>
            <ArrowUpRight size={19} />
          </Link>
          <div>
            <Link to="/create">
              <ImagePlus size={18} />
              Photo / post
            </Link>
            {reelsEnabled && (
              <Link to="/reels/create">
                <Film size={18} />
                Reel
              </Link>
            )}
            {storiesEnabled && (
              <Link to="/stories/create">
                <Camera size={18} />
                Story
              </Link>
            )}
          </div>
        </section>
        <nav className="v-feed-tabs" aria-label="Feed views">
          <NavLink to="/home" end>
            Latest moments
          </NavLink>
          <Link to="/explore">
            <Compass size={16} />
            Explore
          </Link>
          <Link to="/saved">
            <Bookmark size={16} />
            Saved
          </Link>
        </nav>
        <section className="v-feed-stream" aria-label="Your feed" aria-busy={loading}>
          {children}
        </section>
      </div>
      <aside className="v-home-aside">
        <section className="v-creator-note">
          <span>GOT A LITTLE INSPIRATION?</span>
          <h2>
            Make a moment
            <br />
            of your own.
          </h2>
          <p>
            A photo, a thought, a story.
            <br />
            Start wherever you are.
          </p>
          <Link to="/create">
            Create something <ArrowUpRight size={17} />
          </Link>
        </section>
        <section className="v-creator-note">
          <span>FORGE AI</span>
          <h2>
            Give your next idea
            <br />a place to begin.
          </h2>
          <p>Create a presentation, website or interactive experience.</p>
          <Link to="/forge">
            Open FORGE <ArrowUpRight size={17} />
          </Link>
        </section>
        {recommendations}
        <p className="v-aside-footnote">
          A place for your people.
          <br />
          Made by VELORYZ.
        </p>
      </aside>
    </div>
  );
}
