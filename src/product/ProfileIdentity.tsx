import { MutualConnections } from "../components/MutualConnections";
import { useRef, useState, type ReactNode } from "react";
import { AvatarPreview } from "../components/AvatarPreview";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import type { Profile } from "../lib/supabase";
export function ProfileIdentity({
  profile,
  avatar,
  actions,
  counts,
  feedback,
}: {
  profile: Profile;
  avatar: ReactNode;
  actions: ReactNode;
  counts: ReactNode;
  feedback: ReactNode;
}) {
  const avatarRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ src: string | null; name: string } | null>(null);
  return (
    <header className="v-profile-identity">
      <div className="v-profile-banner">
        <span>YOUR PEOPLE. YOUR PERSPECTIVE.</span>
        <img className="v-profile-wing" src="/velori-wing-mark.png" alt="" />
      </div>
      <div className="v-profile-summary">
        <div className="v-profile-avatar" ref={avatarRef}>
          {avatar}
          <button
            type="button"
            className="profile-avatar-preview-trigger"
            aria-label="Preview profile picture"
            onClick={() =>
              setPreview({
                src: avatarRef.current?.querySelector("img")?.currentSrc || null,
                name: profile.display_name || profile.username,
              })
            }
          >
            ↗
          </button>
        </div>
        <div className="v-profile-names">
          {(profile.account_type === "creator" || profile.account_type === "business") && (
            <span className="v-eyebrow">
              {profile.account_type === "creator" ? "Creator" : "Business"}
            </span>
          )}
          <h1>
            {profile.display_name || profile.username}
            {profile.is_private && <LockKeyhole size={16} aria-label="Private profile" />}
          </h1>
          <p>@{profile.username}</p>
        </div>
        <div className="v-profile-actions">{actions}</div>
      </div>
      <div className="v-profile-about">
        <div>
          {profile.bio && <p>{profile.bio}</p>}
          {profile.website_url && (
            <a href={profile.website_url} target="_blank" rel="noopener noreferrer">
              {profile.link_title || profile.website_url}
              <ArrowUpRight size={14} />
            </a>
          )}
          <MutualConnections profileId={profile.id} />
          {feedback}
        </div>
        {counts}
      </div>
      {preview ? <AvatarPreview {...preview} onClose={() => setPreview(null)} /> : null}
    </header>
  );
}
