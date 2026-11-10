import { useLocation } from "react-router";
const sections: Record<string, [string, string]> = {
  home: ["Home", "Your people. Your point of view."],
  feed: ["Home", "Your people. Your point of view."],
  explore: ["Explore", "Find something that moves you."],
  search: ["Search", "A new connection starts here."],
  people: ["People", "Find your kind of people."],
  profile: ["Profile", "A space that is entirely you."],
  messages: ["Messages", "Keep the conversation going."],
  notifications: ["Activity", "All your connections, together."],
  groups: ["Communities", "Better, together."],
  settings: ["Settings", "Your space. Your rules."],
  create: ["Creator Studio", "Make something worth sharing."],
  saved: ["Your collection", "Keep what speaks to you."],
  stories: ["Stories", "The little moments matter."],
  reels: ["Reels", "A different point of view."],
  drafts: ["Drafts", "Good ideas take their time."],
  archive: ["Archive", "Your moments, kept."],
  help: ["Help center", "A little guidance goes a long way."],
};
export function ShellPageIdentity() {
  const { pathname } = useLocation();
  const segment = pathname.split("/").filter(Boolean)[0] || "home";
  const [title, description] = sections[segment] ?? [
    segment.replace(/-/g, " "),
    "The VELORI experience.",
  ];
  return (
    <div className="shell-page-identity">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
