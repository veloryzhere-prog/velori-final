import { useState } from "react";
import { Music2, BadgeCheck } from "lucide-react";
import { ProfileLink } from "../../../app/social-engagement";
import type { Reel } from "../types";
export function ReelInfo({
  reel: r,
  onFollow,
}: {
  reel: Reel;
  visible: boolean;
  onFollow: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rv-info" onClick={(e) => e.stopPropagation()}>
      <div className="reel-author-row">
        <ProfileLink username={r.user.username} className="rv-author-avatar">
          {r.user.avatarUrl ? (
            <img className="reel-avatar" src={r.user.avatarUrl} alt="" />
          ) : (
            <span className="reel-avatar reel-avatar-fallback">
              {(r.user.displayName || r.user.username).slice(0, 1)}
            </span>
          )}
        </ProfileLink>
        <ProfileLink className="reel-username" username={r.user.username}>
          @{r.user.username}
        </ProfileLink>
        {r.user.verified && <BadgeCheck size={16} aria-label="Verified" />}
        {r.canFollow && (
          <button className="reel-follow-button" onClick={onFollow}>
            {r.followLabel || (r.isFollowing ? "Following" : "Follow")}
          </button>
        )}
      </div>
      {r.caption && (
        <div className="rv-caption">
          <p className={expanded ? "is-expanded" : ""}>{r.caption}</p>
          {r.caption.length > 100 && (
            <button onClick={() => setExpanded(!expanded)}>{expanded ? "Less" : "More"}</button>
          )}
        </div>
      )}
      {r.audioTrack && (
        <span className="reel-audio-track">
          <Music2 size={13} />
          {r.audioTrack.title} · {r.audioTrack.artist}
        </span>
      )}
    </div>
  );
}
