import {
  Activity,
  Bell,
  Blocks,
  Building2,
  CircleHelp,
  FileText,
  Flag,
  Gauge,
  Image,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  MonitorCog,
  Navigation,
  Palette,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Users,
  UsersRound,
  Video,
  Workflow,
  Wrench,
  X,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { areaDestination, canOpenEntry } from "./tools.mjs";
import { useAdminPreferences } from "./preferences";
import { NavLink, useLocation } from "react-router";
import officialLogo from "../../imports/velori-official.svg";
import { useAdminSession, usePermissions } from "./session";

type NavEntry = {
  to: string;
  label: string;
  permissions: string[];
  icon: LucideIcon;
};

export const GROUPS: { label: string; entries: NavEntry[] }[] = [
  {
    label: "Overview",
    entries: [
      {
        to: "/admin/dashboard",
        label: "Dashboard",
        permissions: ["system.view", "users.view"],
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "People",
    entries: [
      { to: "/admin/users", label: "Users", permissions: ["users.view"], icon: Users },
      { to: "/admin/groups", label: "Groups", permissions: ["groups.view"], icon: UsersRound },
    ],
  },
  {
    label: "Moderation",
    entries: [
      { to: "/admin/reports", label: "Reports", permissions: ["reports.view"], icon: Flag },
      { to: "/admin/posts", label: "Posts", permissions: ["posts.view"], icon: FileText },
      { to: "/admin/reels", label: "Reels", permissions: ["reels.view"], icon: Video },
      { to: "/admin/stories", label: "Stories", permissions: ["stories.view"], icon: Image },
      {
        to: "/admin/comments",
        label: "Comments",
        permissions: ["comments.view"],
        icon: MessageSquare,
      },
      {
        to: "/admin/messages",
        label: "Message reports",
        permissions: ["messages.view_reports"],
        icon: ShieldAlert,
      },
    ],
  },
  {
    label: "Publishing",
    entries: [
      { to: "/admin/cms", label: "Pages", permissions: ["cms.view"], icon: Blocks },
      {
        to: "/admin/announcements",
        label: "Announcements",
        permissions: ["notifications.view"],
        icon: Megaphone,
      },
      {
        to: "/admin/notifications",
        label: "Notifications",
        permissions: ["notifications.view"],
        icon: Bell,
      },
      { to: "/admin/ads", label: "Advertisements", permissions: ["ads.view"], icon: Building2 },
    ],
  },
  {
    label: "Website",
    entries: [
      {
        to: "/admin/website",
        label: "Website overview",
        permissions: ["cms.view", "navigation.view", "branding.view"],
        icon: Workflow,
      },
      {
        to: "/admin/navigation",
        label: "Navigation",
        permissions: ["navigation.view"],
        icon: Navigation,
      },
      {
        to: "/admin/branding",
        label: "Brand assets",
        permissions: ["branding.view"],
        icon: Palette,
      },
      { to: "/admin/theme", label: "Appearance", permissions: ["theme.view"], icon: Sparkles },
      {
        to: "/admin/creator-control-center",
        label: "Creator Control Center",
        permissions: ["motion.read"],
        icon: Sparkles,
      },
      { to: "/admin/motion", label: "Motion", permissions: ["motion.read"], icon: Activity },
      {
        to: "/admin/error-pages",
        label: "Error pages",
        permissions: ["motion.read"],
        icon: ShieldAlert,
      },
      {
        to: "/admin/routes",
        label: "Routes & SEO",
        permissions: ["navigation.view"],
        icon: Workflow,
      },
    ],
  },
  {
    label: "Business & Growth",
    entries: [
      {
        to: "/admin/business-growth",
        label: "Overview",
        permissions: ["settings.view", "flags.view", "cms.view"],
        icon: Gauge,
      },
      {
        to: "/admin/business-growth/offers",
        label: "Offers",
        permissions: ["offers.view"],
        icon: Megaphone,
      },
      {
        to: "/admin/business-growth/app-rewards",
        label: "APK Promotions",
        permissions: ["notifications.view"],
        icon: Sparkles,
      },
      {
        to: "/admin/business-growth/pricing",
        label: "Pricing",
        permissions: ["settings.view", "flags.view", "cms.view"],
        icon: Building2,
      },
      {
        to: "/admin/business-growth/referrals",
        label: "Referrals & Rewards",
        permissions: ["referrals.view"],
        icon: Users,
      },
    ],
  },
  {
    label: "Forge AI",
    entries: [
      {
        to: "/admin/forge",
        label: "Forge overview",
        permissions: ["settings.view", "flags.view", "cms.view"],
        icon: Sparkles,
      },
      {
        to: "/admin/feature-flags",
        label: "Forge controls",
        permissions: ["flags.view"],
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    label: "System",
    entries: [
      {
        to: "/admin/settings",
        label: "Settings",
        permissions: ["settings.view"],
        icon: SlidersHorizontal,
      },
      {
        to: "/admin/maintenance",
        label: "Maintenance",
        permissions: ["settings.view"],
        icon: Wrench,
      },
      {
        to: "/admin/feature-flags",
        label: "Features",
        permissions: ["flags.view"],
        icon: Sparkles,
      },
      { to: "/admin/system", label: "System health", permissions: ["system.view"], icon: Gauge },
      {
        to: "/admin/admins",
        label: "Manage administrators",
        permissions: ["admins.view"],
        icon: Shield,
      },
      { to: "/admin/roles", label: "Roles & access", permissions: ["admins.view"], icon: Shield },
      { to: "/admin/sessions", label: "Sessions", permissions: [], icon: UsersRound },
      { to: "/admin/security", label: "Security", permissions: [], icon: ShieldAlert },
      { to: "/admin/audit", label: "Audit log", permissions: ["audit.view"], icon: FileText },
      { to: "/admin/emails", label: "Email", permissions: ["emails.view"], icon: Mail },
      {
        to: "/admin/environment",
        label: "Manage Importants",
        permissions: ["security.edit"],
        icon: SlidersHorizontal,
      },
      {
        to: "/admin/provisioning",
        label: "Provisioning",
        permissions: ["admins.view"],
        icon: MonitorCog,
      },
    ],
  },
];

export const AREAS: {
  label: string;
  to: string;
  icon: LucideIcon;
  groups: string[];
  paths?: string[];
}[] = [
  { label: "Site", to: "/admin/website", icon: Building2, groups: ["Website"] },
  {
    label: "Content Studio",
    to: "/admin/cms",
    icon: Blocks,
    groups: ["Publishing"],
    paths: ["/admin/cms", "/admin/content", "/admin/pages"],
  },
  {
    label: "Social",
    to: "/admin/users",
    icon: UsersRound,
    groups: ["People", "Moderation", "Social"],
  },
  {
    label: "Communications",
    to: "/admin/announcements",
    icon: Megaphone,
    groups: ["Publishing"],
    paths: ["/admin/announcements", "/admin/communication", "/admin/notifications"],
  },
  {
    label: "Monetization",
    to: "/admin/ads",
    icon: Building2,
    groups: ["Publishing"],
    paths: ["/admin/ads"],
  },
  {
    label: "Business & Growth",
    to: "/admin/business-growth",
    icon: Gauge,
    groups: ["Business & Growth"],
    paths: [
      "/admin/business-growth",
      "/admin/business-growth/offers",
      "/admin/business-growth/pricing",
      "/admin/business-growth/subscriptions",
      "/admin/business-growth/referrals",
      "/admin/business-growth/rewards",
      "/admin/business-growth/usage",
      "/admin/business-growth/app-rewards",
      "/admin/business-growth/customers",
      "/admin/business-growth/analytics",
      "/admin/business-growth/audit",
    ],
  },
  {
    label: "Forge AI",
    to: "/admin/forge",
    icon: Sparkles,
    groups: ["Forge AI"],
    paths: ["/admin/forge", "/admin/feature-flags"],
  },
  {
    label: "System",
    to: "/admin/system",
    icon: Gauge,
    groups: ["System"],
    paths: [
      "/admin/system",
      "/admin/settings",
      "/admin/maintenance",
      "/admin/feature-flags",
      "/admin/emails",
      "/admin/environment",
    ],
  },
  {
    label: "Administration",
    to: "/admin/admins",
    icon: Shield,
    groups: ["System"],
    paths: [
      "/admin/admins",
      "/admin/roles",
      "/admin/sessions",
      "/admin/security",
      "/admin/audit",
      "/admin/provisioning",
    ],
  },
];

export const ADMIN_ENTRIES = GROUPS.flatMap((group) => group.entries);
export const ADMIN_PATHS = ADMIN_ENTRIES.map((entry) => entry.to);
export function adminHome(permissions: ReadonlySet<string>) {
  return ADMIN_ENTRIES.find((entry) => canOpenEntry(entry, permissions))?.to ?? "/admin/security";
}

export function adminArea(pathname: string) {
  const aliases: Record<string, string> = {
    "/admin/people": "/admin/users",
    "/admin/moderation": "/admin/reports",
    "/admin/content": "/admin/cms",
    "/admin/communication": "/admin/announcements",
    "/admin/brand": "/admin/branding",
    "/admin/brand-assets": "/admin/branding",
    "/admin/errors": "/admin/error-pages",
    "/admin/analytics": "/admin/dashboard",
    "/admin/creator-manager": "/admin/creator-control-center",
    "/admin/manage-creators": "/admin/creator-control-center",
    "/admin/studio-catalog": "/admin/creator-control-center",
  };
  const path =
    pathname.startsWith("/admin/pages/") || pathname === "/admin/website/pages"
      ? "/admin/cms"
      : (aliases[pathname] ?? pathname);
  return (
    AREAS.find((area) =>
      GROUPS.filter((group) => area.groups.includes(group.label))
        .flatMap((group) => group.entries)
        .some(
          (entry) =>
            (!area.paths ||
              area.paths.some((scope) => entry.to === scope || entry.to.startsWith(scope + "/"))) &&
            (path === entry.to || path.startsWith(entry.to + "/")),
        ),
    ) ?? AREAS[0]
  );
}

export function AdminLogo() {
  return <img className="admin-logo-small" src={officialLogo} alt="VELORI" />;
}

export function ConsoleSidebar({
  onNavigate,
  open = false,
  onClose,
  onAccount,
  collapsed,
  onCollapseToggle,
}: {
  onNavigate?: () => void;
  open?: boolean;
  onClose?: () => void;
  onAccount: () => void;
  collapsed: boolean;
  onCollapseToggle: () => void;
}) {
  const permissions = usePermissions();
  const { me } = useAdminSession();
  const location = useLocation();
  const isCollapsed = collapsed && !open;
  const { pins } = useAdminPreferences(ADMIN_PATHS);
  const pinned = ADMIN_ENTRIES.filter(
    (entry) => pins.includes(entry.to) && canOpenEntry(entry, permissions),
  );
  const home = adminHome(permissions);
  const currentArea = adminArea(location.pathname);
  const entriesFor = (group: (typeof GROUPS)[number]) =>
    group.entries.filter(
      (entry) =>
        entry.permissions.length === 0 ||
        entry.permissions.some((permission) => permissions.has(permission)),
    );

  return (
    <aside
      className={`admin-sidebar${open ? " is-open" : ""}${isCollapsed ? " is-collapsed" : ""}`}
      aria-label="Administration navigation"
    >
      <div className="admin-sidebar-header">
        <NavLink
          className="admin-sidebar-brand"
          to={home}
          onClick={onNavigate}
          aria-label="VELORI administration home"
        >
          <AdminLogo />
          {!isCollapsed ? (
            <span className="admin-brand-copy">
              <strong>VELORI</strong>
              <small>Administration</small>
            </span>
          ) : null}
        </NavLink>
        {open ? (
          <button
            type="button"
            className="admin-sidebar-collapse"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="admin-sidebar-collapse"
            onClick={onCollapseToggle}
            aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!isCollapsed}
          >
            <ChevronLeft aria-hidden="true" className={isCollapsed ? "rotated" : ""} />
          </button>
        )}
      </div>

      {!isCollapsed ? (
        <div className="admin-workspace-identity">
          <span className="admin-workspace-avatar" aria-hidden="true">
            {(me?.displayName || me?.username || "A").slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>{me?.displayName || me?.username || "Administrator"}</strong>
            <small>Platform workspace</small>
          </span>
        </div>
      ) : null}

      <nav className="admin-side-navigation" aria-label="Admin areas and tools">
        <ul className="admin-area-list admin-overview-link">
          <li>
            <NavLink
              to={home}
              onClick={onNavigate}
              aria-label={home === "/admin/dashboard" ? "Command Center" : "Workspace home"}
              className={location.pathname === home ? "admin-is-active" : undefined}
            >
              <LayoutDashboard aria-hidden="true" />
              {!isCollapsed ? (
                <span>{home === "/admin/dashboard" ? "Command Center" : "Workspace home"}</span>
              ) : null}
            </NavLink>
          </li>
        </ul>
        {!isCollapsed ? <h2 className="admin-area-nav-heading">AREAS</h2> : null}
        <ul className="admin-area-list">
          {AREAS.filter((area) => areaDestination(area, GROUPS, permissions)).map((area) => {
            const Icon = area.icon;
            const active = currentArea?.label === area.label;
            return (
              <li key={area.label}>
                <NavLink
                  to={areaDestination(area, GROUPS, permissions)!}
                  aria-label={area.label}
                  onClick={onNavigate}
                  className={active ? "admin-is-active" : undefined}
                  aria-current={active ? "page" : undefined}
                  title={isCollapsed ? area.label : undefined}
                >
                  <Icon aria-hidden="true" />
                  {!isCollapsed ? <span>{area.label}</span> : null}
                </NavLink>
              </li>
            );
          })}
        </ul>
        {pinned.length && !isCollapsed ? (
          <section className="admin-nav-group admin-pinned" aria-label="Pinned workspaces">
            <h2>Pinned</h2>
            <ul className="admin-menu">
              {pinned.map((entry) => (
                <li key={entry.to}>
                  <NavLink to={entry.to} onClick={onNavigate}>
                    <entry.icon aria-hidden="true" />
                    <span>{entry.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {currentArea ? (
          <div className="admin-context-nav-label">
            {!isCollapsed ? currentArea.label.toUpperCase() : null}
          </div>
        ) : null}
        {GROUPS.filter((group) => currentArea && currentArea.groups.includes(group.label)).map(
          (group) => {
            const entries = entriesFor(group);
            const scopedEntries = currentArea?.paths
              ? entries.filter((entry) =>
                  currentArea.paths!.some(
                    (path) => entry.to === path || entry.to.startsWith(`${path}/`),
                  ),
                )
              : entries;
            if (!scopedEntries.length) return null;
            return (
              <section key={group.label} className="admin-nav-group" aria-label={group.label}>
                {!isCollapsed ? <h2>{group.label}</h2> : null}
                <ul className="admin-menu">
                  {scopedEntries.map((entry) => {
                    const Icon = entry.icon;
                    const active =
                      location.pathname === entry.to ||
                      location.pathname.startsWith(`${entry.to}/`) ||
                      (entry.to === "/admin/cms" && location.pathname.startsWith("/admin/pages/"));
                    return (
                      <li key={entry.to}>
                        <NavLink
                          to={entry.to}
                          aria-label={entry.label}
                          onClick={onNavigate}
                          className={active ? "admin-is-active" : undefined}
                          aria-current={active ? "page" : undefined}
                          title={isCollapsed ? entry.label : undefined}
                          data-tooltip={isCollapsed ? entry.label : undefined}
                        >
                          <Icon aria-hidden="true" />
                          {!isCollapsed ? <span>{entry.label}</span> : null}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          },
        )}
      </nav>

      <div className="admin-sidebar-foot">
        <NavLink
          to="/help"
          aria-label="Help center"
          onClick={onNavigate}
          title={isCollapsed ? "Help" : undefined}
        >
          <CircleHelp aria-hidden="true" />
          {!isCollapsed ? <span>Help center</span> : null}
        </NavLink>
        {permissions.has("settings.view") ? (
          <NavLink
            to="/admin/settings"
            aria-label="Settings"
            onClick={onNavigate}
            title={isCollapsed ? "Settings" : undefined}
          >
            <SlidersHorizontal aria-hidden="true" />
            {!isCollapsed ? <span>Settings</span> : null}
          </NavLink>
        ) : null}
        <button
          type="button"
          onClick={() => {
            onAccount();
            onNavigate?.();
          }}
          aria-label="Admin profile"
          title={isCollapsed ? "Admin profile" : undefined}
        >
          <Users aria-hidden="true" />
          {!isCollapsed ? <span>Admin profile</span> : null}
        </button>
      </div>
    </aside>
  );
}
