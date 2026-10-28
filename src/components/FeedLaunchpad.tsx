import { Camera, Film, ImagePlus, MoveUpRight } from "lucide-react";
import { Link } from "react-router";
import { useFeatureFlag } from "../lib/feature-flags";
export function FeedLaunchpad({ name, avatar }: { name?: string | null; avatar?: string | null }) {
  const stories = useFeatureFlag("stories_enabled", true);
  const reels = useFeatureFlag("reels_enabled", true);
  return (
    <section className="composer-rebuilt" aria-label="Create on VELORI">
      <Link className="composer-rebuilt-prompt" to="/create">
        <span className="composer-rebuilt-avatar">
          {avatar ? <img src={avatar} alt="" /> : (name || "V").slice(0, 1).toUpperCase()}
        </span>
        <span>
          <strong>What is your world looking like?</strong>
          <small>A thought. A photo. A little moment.</small>
        </span>
        <MoveUpRight size={21} />
      </Link>
      <div className="composer-rebuilt-tools">
        <Link to="/create">
          <ImagePlus size={17} />
          <span>Share a post</span>
        </Link>
        {stories && (
          <Link to="/stories/create">
            <Camera size={17} />
            <span>Add a story</span>
          </Link>
        )}
        {reels && (
          <Link to="/reels/create">
            <Film size={17} />
            <span>Make a reel</span>
          </Link>
        )}
      </div>
    </section>
  );
}
