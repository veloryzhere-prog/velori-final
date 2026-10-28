import type { ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Shell, RouteError, NotFound, Maintenance } from "./shell";
import { PUBLIC_PAGE_REGISTRY } from "./admin-console/page-registry";
import veloriLogo from "../imports/velori-official.svg";

type ViewName =
  | "Feed"
  | "Explore"
  | "Search"
  | "PostDetail"
  | "OwnProfileRedirect"
  | "ProfilePage"
  | "FollowRequests"
  | "Saved"
  | "CreatePost"
  | "Settings"
  | "AuthPage"
  | "AuthCheckEmail"
  | "AuthConfirm"
  | "AuthConfirmed"
  | "Onboarding"
  | "HelpCenter"
  | "ReelsPage"
  | "ReelStudioPage"
  | "StoriesPage"
  | "StoriesArchivePage"
  | "NotificationsPage"
  | "MessagesPage"
  | "GroupsPage"
  | "GroupDetailPage"
  | "GroupMembersPage"
  | "GroupRequestsPage"
  | "RouteDispatcher";
const view = (name: ViewName) => async () => ({
  Component: (await import("./views"))[name],
});
const publicPage = (kind: string) => async () => {
  const { PublicPage } = await import("./views");
  return { Component: () => <PublicPage kind={kind} /> };
};
const pendingPage = (kind: string) => async () => {
  const { PendingFeature } = await import("./views");
  return { Component: () => <PendingFeature kind={kind} /> };
};
const postLibraryPage = (kind: "archive" | "trash" | "drafts") => async () => {
  const { PostLibrary } = await import("./views");
  return { Component: () => <PostLibrary kind={kind} /> };
};
/**
 * Post Studio and Reel Studio (the replaced Figma creation studios) share one
 * route component; the studio mode is derived from the matched path.
 */
const creatorStudioView = async () => ({
  Component: (await import("../features/creator-studios")).CreatorStudioPage,
});
/** `/admin/login` and the unregistered-path guard. */
const adminAuthView = (name: "AdminLogin" | "AdminRouteFallback") => async () => ({
  Component: (await import("./admin-auth"))[name],
});

/**
 * One lazy route per console screen.
 *
 * `load` is a literal dynamic import so Vite can split each screen into its own
 * chunk: the console is large, and an operator who only opens the dashboard should
 * not download the CMS editor and the motion studio along with it.
 */
const adminScreen = (load: () => Promise<unknown>, name: string) => async () => ({
  Component: ((await load()) as Record<string, ComponentType>)[name],
});

function InitialRouteFallback() {
  return (
    <div className="initial-route-fallback" role="status" aria-live="polite">
      <div className="initial-route-mark" aria-label="VELORI">
        v
      </div>
      <span className="initial-route-progress" aria-hidden="true" />
      <span>Loading your space…</span>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/admin/login",
    lazy: adminAuthView("AdminLogin"),
    ErrorBoundary: RouteError,
    HydrateFallback: InitialRouteFallback,
  },
  {
    path: "/admin",
    lazy: adminScreen(() => import("./admin-console/frame"), "AdminConsoleLayout"),
    ErrorBoundary: RouteError,
    HydrateFallback: InitialRouteFallback,
    children: [
      {
        index: true,
        lazy: adminScreen(() => import("./admin-console/frame"), "ConsoleIndex"),
      },
      { path: "assets", Component: () => <Navigate to="/admin/branding" replace /> },
      { path: "logs", Component: () => <Navigate to="/admin/audit" replace /> },
      { path: "moderation", Component: () => <Navigate to="/admin/posts" replace /> },
      {
        path: "dashboard",
        lazy: adminScreen(() => import("./admin-console/screens/dashboard"), "DashboardScreen"),
      },
      {
        path: "website",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "WebsiteScreen"),
      },
      {
        path: "website/pages",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen"),
      },
      {
        path: "pages/:pageId",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "CmsPageStudioScreen"),
      },
      {
        path: "website/navigation",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "NavigationScreen"),
      },
      {
        path: "website/footer",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen"),
      },
      {
        path: "website/seo",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "RoutesScreen"),
      },
      {
        path: "people",
        lazy: adminScreen(() => import("./admin-console/screens/users"), "UsersScreen"),
      },
      {
        path: "users",
        lazy: adminScreen(() => import("./admin-console/screens/users"), "UsersScreen"),
      },
      {
        path: "content",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "CmsScreen"),
      },
      {
        path: "posts",
        lazy: adminScreen(() => import("./admin-console/screens/moderation"), "PostsScreen"),
      },
      {
        path: "comments",
        lazy: adminScreen(() => import("./admin-console/screens/moderation"), "CommentsScreen"),
      },
      {
        path: "reports",
        lazy: adminScreen(() => import("./admin-console/screens/moderation"), "ReportsScreen"),
      },
      {
        path: "messages",
        lazy: adminScreen(() => import("./admin-console/screens/moderation"), "MessagesScreen"),
      },
      {
        path: "reels",
        lazy: adminScreen(() => import("./admin-console/screens/social"), "ReelsScreen"),
      },
      {
        path: "stories",
        lazy: adminScreen(() => import("./admin-console/screens/social"), "StoriesScreen"),
      },
      {
        path: "groups",
        lazy: adminScreen(() => import("./admin-console/screens/groups"), "GroupsScreen"),
      },
      {
        path: "brand",
        lazy: adminScreen(() => import("./admin-console/screens/appearance"), "BrandingScreen"),
      },
      {
        path: "brand-assets",
        lazy: adminScreen(() => import("./admin-console/screens/appearance"), "BrandingScreen"),
      },
      {
        path: "cms",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "CmsScreen"),
      },
      {
        path: "moderation",
        lazy: adminScreen(() => import("./admin-console/screens/moderation"), "ReportsScreen"),
      },
      {
        path: "communication",
        lazy: adminScreen(() => import("./admin-console/screens/platform"), "AnnouncementsScreen"),
      },
      {
        path: "analytics",
        lazy: adminScreen(() => import("./admin-console/screens/dashboard"), "DashboardScreen"),
      },
      {
        path: "errors",
        lazy: adminScreen(() => import("./admin-console/screens/appearance"), "ErrorPagesScreen"),
      },
      {
        path: "maintenance",
        lazy: adminScreen(() => import("./admin-console/screens/platform"), "PlatformScreen"),
      },
      {
        path: "navigation",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "NavigationScreen"),
      },
      {
        path: "routes",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "RoutesScreen"),
      },
      {
        path: "branding",
        lazy: adminScreen(() => import("./admin-console/screens/appearance"), "BrandingScreen"),
      },
      {
        path: "animations",
        lazy: adminScreen(() => import("./admin-console/screens/appearance"), "AnimationsScreen"),
      },
      {
        path: "motion",
        lazy: adminScreen(() => import("./admin-console/screens/appearance"), "MotionScreen"),
      },
      {
        path: "error-pages",
        lazy: adminScreen(() => import("./admin-console/screens/appearance"), "ErrorPagesScreen"),
      },
      {
        path: "theme",
        lazy: adminScreen(() => import("./admin-console/screens/appearance"), "ThemeScreen"),
      },
      {
        path: "creator-control-center",
        lazy: adminScreen(
          () => import("./admin-console/screens/creator-manager"),
          "CreatorManagerScreen",
        ),
      },
      {
        path: "creator-manager",
        lazy: adminScreen(
          () => import("./admin-console/screens/creator-manager"),
          "CreatorManagerScreen",
        ),
      },
      {
        path: "manage-creators",
        lazy: adminScreen(
          () => import("./admin-console/screens/creator-manager"),
          "CreatorManagerScreen",
        ),
      },
      {
        path: "studio-catalog",
        lazy: adminScreen(
          () => import("./admin-console/screens/creator-manager"),
          "CreatorManagerMusicScreen",
        ),
      },
      {
        path: "website/about",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen"),
      },
      {
        path: "website/contact",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen"),
      },
      {
        path: "website/help",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen"),
      },
      {
        path: "website/terms",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen"),
      },
      {
        path: "website/privacy",
        lazy: adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen"),
      },
      {
        path: "announcements",
        lazy: adminScreen(() => import("./admin-console/screens/platform"), "AnnouncementsScreen"),
      },
      {
        path: "notifications",
        lazy: adminScreen(() => import("./admin-console/screens/platform"), "NotificationsScreen"),
      },
      {
        path: "ads",
        lazy: adminScreen(() => import("./admin-console/screens/platform"), "AdsScreen"),
      },
      {
        path: "settings",
        lazy: adminScreen(() => import("./admin-console/screens/platform"), "SiteSettingsScreen"),
      },
      {
        path: "platform",
        lazy: adminScreen(() => import("./admin-console/screens/platform"), "PlatformScreen"),
      },
      {
        path: "forge",
        lazy: adminScreen(() => import("./admin-console/screens/forge-admin"), "ForgeAdminScreen"),
      },
      {
        path: "feature-flags",
        lazy: adminScreen(() => import("./admin-console/screens/platform"), "FeatureFlagsScreen"),
      },
      {
        path: "emails",
        lazy: adminScreen(() => import("./admin-console/screens/platform"), "EmailsScreen"),
      },
      {
        path: "admins",
        lazy: adminScreen(() => import("./admin-console/screens/governance"), "AdminsScreen"),
      },
      {
        path: "roles",
        lazy: adminScreen(() => import("./admin-console/screens/governance"), "RolesScreen"),
      },
      { path: "manage-importants", element: <Navigate to="/admin/environment" replace /> },
      {
        path: "environment",
        lazy: adminScreen(() => import("./admin-console/screens/environment"), "EnvironmentScreen"),
      },
      {
        path: "provisioning",
        lazy: adminScreen(() => import("./admin-console/screens/governance"), "ProvisioningScreen"),
      },
      {
        path: "sessions",
        lazy: adminScreen(() => import("./admin-console/screens/governance"), "SessionsScreen"),
      },
      {
        path: "audit",
        lazy: adminScreen(() => import("./admin-console/screens/governance"), "AuditScreen"),
      },
      {
        path: "system",
        lazy: adminScreen(() => import("./admin-console/screens/governance"), "SystemScreen"),
      },
      {
        path: "security",
        lazy: adminScreen(() => import("./admin-console/screens/security"), "SecurityScreen"),
      },
    ],
  },
  {
    path: "/admin/*",
    lazy: adminAuthView("AdminRouteFallback"),
    ErrorBoundary: RouteError,
    HydrateFallback: InitialRouteFallback,
  },
  {
    path: "/",
    Component: Shell,
    ErrorBoundary: RouteError,
    HydrateFallback: InitialRouteFallback,
    children: [
      { index: true, lazy: view("Feed") },
      { path: "home", lazy: view("Feed") },
      ...["forge", "forge/projects/new", "artifacts", "studio", "studio/:projectId"].map(
        (path) => ({
          path,
          lazy: async () => ({
            Component: (await import("../features/artifacts/StudioPage")).StudioPage,
          }),
        }),
      ),
      {
        path: "forge/commercial",
        lazy: async () => ({
          Component: (await import("../features/artifacts/CommercialPricing")).CommercialPricing,
        }),
      },
      {
        path: "forge/pricing",
        lazy: async () => ({
          Component: (await import("../features/artifacts/PublicPages")).Pricing,
        }),
      },
      {
        path: "forge/rewards",
        lazy: async () => ({
          Component: (await import("../features/artifacts/PublicPages")).RewardsPage,
        }),
      },
      {
        path: "forge/account/subscription",
        lazy: async () => ({
          Component: (await import("../features/artifacts/BillingAccount")).BillingAccount,
        }),
      },
      ...["s/:secretToken", "preview/:secretToken"].map((path) => ({
        path,
        lazy: async () => ({
          Component: (await import("../features/artifacts/PublicPages")).SharedPreview,
        }),
      })),
      { path: "feed", lazy: view("Feed") },
      { path: "explore", lazy: view("Explore") },
      { path: "search", lazy: view("Search") },
      { path: "people", lazy: view("Search") },
      { path: "hashtags/:tag", lazy: view("Search") },
      { path: "post/:id", lazy: view("PostDetail") },
      { path: "profile", lazy: view("OwnProfileRedirect") },
      { path: "profile/:username", lazy: view("ProfilePage") },
      { path: "settings/follow-requests", lazy: view("FollowRequests") },
      {
        path: "settings/notifications",
        lazy: async () => ({
          Component: (await import("./notification-settings")).NotificationSettingsPage,
        }),
      },
      {
        path: "settings/privacy",
        lazy: async () => ({
          Component: (await import("./privacy-settings")).PrivacySettingsPage,
        }),
      },
      { path: "saved", lazy: view("Saved") },
      { path: "archive", lazy: postLibraryPage("archive") },
      { path: "trash", lazy: postLibraryPage("trash") },
      { path: "drafts", lazy: postLibraryPage("drafts") },
      { path: "create", lazy: creatorStudioView },
      { path: "settings", lazy: view("Settings") },
      { path: "settings/appearance", lazy: view("Settings") },
      { path: "settings/account", lazy: view("Settings") },
      { path: "login", lazy: view("AuthPage") },
      { path: "signup", lazy: view("AuthPage") },
      { path: "forgot-password", lazy: view("AuthPage") },
      { path: "reset-password", lazy: view("AuthPage") },
      { path: "auth/check-email", lazy: view("AuthCheckEmail") },
      { path: "auth/confirm", lazy: view("AuthConfirm") },
      { path: "auth/confirmed", lazy: view("AuthConfirmed") },
      { path: "verify-email", lazy: view("AuthCheckEmail") },
      { path: "onboarding", lazy: view("Onboarding") },
      ...PUBLIC_PAGE_REGISTRY.filter((page) => page.slug !== "help").map(({ slug }) => ({
        path: slug,
        lazy: publicPage(slug),
      })),
      { path: "help", lazy: view("HelpCenter") },
      { path: "meta-ai", element: <Navigate to="/veloryz-ai" replace /> },
      { path: "muse", element: <Navigate to="/roadmap" replace /> },
      { path: "threads", element: <Navigate to="/roadmap" replace /> },
      { path: "maintenance", Component: Maintenance },
      { path: "messages", lazy: view("MessagesPage") },
      { path: "notifications", lazy: view("NotificationsPage") },
      {
        path: "stories/create",
        lazy: async () => ({
          Component: (await import("./story-editor-page")).StoryEditorPage,
        }),
      },
      { path: "stories", lazy: view("StoriesPage") },
      { path: "stories/archive", lazy: view("StoriesArchivePage") },
      { path: "reels/create", lazy: view("ReelStudioPage") },
      { path: "reels", lazy: view("ReelsPage") },
      { path: "groups", lazy: view("GroupsPage") },
      { path: "groups/create", lazy: view("GroupsPage") },
      { path: "groups/:slug/members", lazy: view("GroupMembersPage") },
      { path: "groups/:slug/requests", lazy: view("GroupRequestsPage") },
      { path: "groups/:slug", lazy: view("GroupDetailPage") },
      { path: "*", lazy: view("RouteDispatcher") },
    ],
  },
]);
