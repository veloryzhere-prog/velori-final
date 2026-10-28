import { NavLink } from "react-router";
import { Camera, Film, ImagePlus, FolderOpen, ChevronRight } from "lucide-react";
import { useFeatureFlag } from "../lib/feature-flags";
export function CreatorDestinations() {
  const reels = useFeatureFlag("reels_enabled", true),
    stories = useFeatureFlag("stories_enabled", true);
  return (
    <nav className="creator-destinations v-studio-navigation" aria-label="Creation workspaces">
      <span>CREATE</span>
      {[
        { to: "/create", label: "Post", icon: ImagePlus },
        ...(reels ? [{ to: "/reels/create", label: "Reel", icon: Film }] : []),
        ...(stories ? [{ to: "/stories/create", label: "Story", icon: Camera }] : []),
        { to: "/drafts", label: "Your drafts", icon: FolderOpen },
      ].map(({ to, label, icon: Icon }) => (
        <NavLink key={to} end to={to}>
          <Icon size={16} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
