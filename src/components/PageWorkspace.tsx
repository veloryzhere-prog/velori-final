import { type ReactNode } from "react";
import { NavLink, Link, useLocation } from "react-router";
import {
  ArrowUpRight,
  Archive,
  Bell,
  Bookmark,
  Camera,
  Compass,
  FileText,
  FolderOpen,
  Heart,
  HelpCircle,
  Lock,
  MessageCircle,
  Palette,
  Plus,
  Search,
  Settings,
  Sparkles,
  BookOpen,
  CreditCard,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
const navigation = {
  discover: [
    { to: "/explore", label: "Explore", icon: Compass },
    { to: "/search", label: "Search everything", icon: Search },
    { to: "/people", label: "People", icon: Users },
    { to: "/search?tab=hashtags", label: "Topics", icon: Heart },
  ],
  library: [
    { to: "/saved", label: "Saved", icon: Bookmark },
    { to: "/drafts", label: "Drafts", icon: FileText },
    { to: "/archive", label: "Archive", icon: Archive },
    { to: "/trash", label: "Recently deleted", icon: Trash2 },
  ],
  activity: [
    { to: "/notifications", label: "Your activity", icon: Bell },
    { to: "/settings/follow-requests", label: "Follow requests", icon: Users },
    { to: "/settings/notifications", label: "Preferences", icon: Settings },
  ],
  stories: [
    { to: "/stories", label: "Latest stories", icon: Camera },
    { to: "/stories/create", label: "Create a story", icon: Plus },
    { to: "/stories/archive", label: "Your archive", icon: Archive },
  ],
  settings: [
    { to: "/settings", label: "Account", icon: Settings },
    { to: "/settings/appearance", label: "Appearance", icon: Palette },
    { to: "/settings/privacy", label: "Privacy & safety", icon: ShieldCheck },
    { to: "/settings/notifications", label: "Notifications", icon: Bell },
    { to: "/settings/follow-requests", label: "Follow requests", icon: Users },
  ],
  community: [
    { to: "/groups", label: "Discover groups", icon: Users },
    { to: "/groups/create", label: "Create a group", icon: Plus },
    { to: "/messages", label: "Conversations", icon: MessageCircle },
  ],
  information: [
    { to: "/forge", label: "Forge AI", icon: Sparkles },
    { to: "/forge-docs", label: "Forge user guide", icon: BookOpen },
    { to: "/forge-pricing", label: "Forge pricing", icon: CreditCard },
    { to: "/forge-payments", label: "Payments & billing", icon: CreditCard },
    { to: "/about", label: "About VELORI", icon: Compass },
    { to: "/help", label: "Help center", icon: HelpCircle },
    { to: "/safety", label: "Safety", icon: ShieldCheck },
    { to: "/community-guidelines", label: "Community guidelines", icon: Users },
    { to: "/privacy", label: "Privacy", icon: Lock },
    { to: "/terms", label: "Terms", icon: FileText },
    { to: "/cookies", label: "Cookies", icon: Settings },
    { to: "/acceptable-use", label: "Acceptable use", icon: ShieldCheck },
    { to: "/data-policy", label: "Your data", icon: FolderOpen },
    { to: "/legal", label: "Legal", icon: FileText },
    { to: "/contact", label: "Contact", icon: MessageCircle },
  ],
  account: [
    { to: "/settings", label: "Your account", icon: Settings },
    { to: "/settings/privacy", label: "Privacy", icon: Lock },
    { to: "/help", label: "Get help", icon: HelpCircle },
  ],
};
export type WorkspaceArea = keyof typeof navigation;
const labels: Record<WorkspaceArea, string> = {
  discover: "DISCOVER",
  library: "YOUR COLLECTION",
  activity: "STAY CONNECTED",
  stories: "MOMENTS",
  settings: "YOUR SETTINGS",
  community: "COMMUNITIES",
  information: "VELORI / INFORMATION",
  account: "YOUR ACCOUNT",
};
export function PageWorkspace({
  area,
  children,
  className = "",
  wide = false,
}: {
  area: WorkspaceArea;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const location = useLocation();
  return (
    <div
      className={"v-section-layout page-workspace workspace-" + area + " " + className}
      data-wide={wide || undefined}
    >
      <header className="v-section-navigation">
        <span className="v-eyebrow">{labels[area]}</span>
        <nav aria-label={labels[area]}>
          {navigation[area].map(({ to, label, icon: Icon }) => {
            const target = new URL(to, "https://velori.local");
            const active =
              location.pathname === target.pathname &&
              target.searchParams.get("tab") === new URLSearchParams(location.search).get("tab");
            return (
              <Link key={to} to={to} aria-current={active ? "page" : undefined}>
                <Icon size={17} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </header>
      <section className="workspace-content">{children}</section>
    </div>
  );
}
