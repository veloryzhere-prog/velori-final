# VELORI route rebuild audit

Updated 2026-10-23. Every route below remains connected to its existing component and backend. An alias shares its target screen; parameterized routes share their route-family template. A layout implementation is not exhaustive workflow acceptance.

| Route | Screen / source entry |
| --- | --- |
| `/admin/login` | adminAuthView("AdminLogin") |
| `/admin/` | adminScreen(() => import("./admin-console/frame"), "ConsoleIndex") |
| `/admin/assets` | () => <Navigate to="/admin/branding" replace /> |
| `/admin/logs` | () => <Navigate to="/admin/audit" replace /> |
| `/admin/moderation` | () => <Navigate to="/admin/posts" replace /> |
| `/admin/dashboard` | adminScreen(() => import("./admin-console/screens/dashboard"), "DashboardScreen") |
| `/admin/website` | adminScreen(() => import("./admin-console/screens/content"), "WebsiteScreen") |
| `/admin/website/pages` | adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen") |
| `/admin/pages/:pageId` | adminScreen(() => import("./admin-console/screens/content"), "CmsPageStudioScreen") |
| `/admin/website/navigation` | adminScreen(() => import("./admin-console/screens/content"), "NavigationScreen") |
| `/admin/website/footer` | adminScreen(() => import("./admin-console/screens/content"), "NavigationScreen") |
| `/admin/website/seo` | adminScreen(() => import("./admin-console/screens/content"), "RoutesScreen") |
| `/admin/people` | adminScreen(() => import("./admin-console/screens/users"), "UsersScreen") |
| `/admin/users` | adminScreen(() => import("./admin-console/screens/users"), "UsersScreen") |
| `/admin/content` | adminScreen(() => import("./admin-console/screens/content"), "CmsScreen") |
| `/admin/posts` | adminScreen(() => import("./admin-console/screens/moderation"), "PostsScreen") |
| `/admin/comments` | adminScreen(() => import("./admin-console/screens/moderation"), "CommentsScreen") |
| `/admin/reports` | adminScreen(() => import("./admin-console/screens/moderation"), "ReportsScreen") |
| `/admin/messages` | adminScreen(() => import("./admin-console/screens/moderation"), "MessagesScreen") |
| `/admin/reels` | adminScreen(() => import("./admin-console/screens/social"), "ReelsScreen") |
| `/admin/stories` | adminScreen(() => import("./admin-console/screens/social"), "StoriesScreen") |
| `/admin/groups` | adminScreen(() => import("./admin-console/screens/groups"), "GroupsScreen") |
| `/admin/brand` | adminScreen(() => import("./admin-console/screens/appearance"), "BrandingScreen") |
| `/admin/brand-assets` | adminScreen(() => import("./admin-console/screens/appearance"), "BrandingScreen") |
| `/admin/cms` | adminScreen(() => import("./admin-console/screens/content"), "CmsScreen") |
| `/admin/moderation` | adminScreen(() => import("./admin-console/screens/moderation"), "ReportsScreen") |
| `/admin/communication` | adminScreen(() => import("./admin-console/screens/platform"), "AnnouncementsScreen") |
| `/admin/analytics` | adminScreen(() => import("./admin-console/screens/dashboard"), "DashboardScreen") |
| `/admin/errors` | adminScreen(() => import("./admin-console/screens/appearance"), "ErrorPagesScreen") |
| `/admin/maintenance` | adminScreen(() => import("./admin-console/screens/platform"), "PlatformScreen") |
| `/admin/navigation` | adminScreen(() => import("./admin-console/screens/content"), "NavigationScreen") |
| `/admin/routes` | adminScreen(() => import("./admin-console/screens/content"), "RoutesScreen") |
| `/admin/branding` | adminScreen(() => import("./admin-console/screens/appearance"), "BrandingScreen") |
| `/admin/animations` | adminScreen(() => import("./admin-console/screens/appearance"), "AnimationsScreen") |
| `/admin/motion` | adminScreen(() => import("./admin-console/screens/appearance"), "MotionScreen") |
| `/admin/error-pages` | adminScreen(() => import("./admin-console/screens/appearance"), "ErrorPagesScreen") |
| `/admin/theme` | adminScreen(() => import("./admin-console/screens/appearance"), "ThemeScreen") |
| `/admin/creator-control-center` | adminScreen( () => import("./admin-console/screens/creator-manager"), "CreatorManagerScreen", ) |
| `/admin/creator-manager` | adminScreen( () => import("./admin-console/screens/creator-manager"), "CreatorManagerScreen", ) |
| `/admin/manage-creators` | adminScreen( () => import("./admin-console/screens/creator-manager"), "CreatorManagerScreen", ) |
| `/admin/studio-catalog` | adminScreen( () => import("./admin-console/screens/creator-manager"), "CreatorManagerMusicScreen", ) |
| `/admin/website/about` | adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen") |
| `/admin/website/contact` | adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen") |
| `/admin/website/help` | adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen") |
| `/admin/website/terms` | adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen") |
| `/admin/website/privacy` | adminScreen(() => import("./admin-console/screens/content"), "WebsitePagesScreen") |
| `/admin/announcements` | adminScreen(() => import("./admin-console/screens/platform"), "AnnouncementsScreen") |
| `/admin/notifications` | adminScreen(() => import("./admin-console/screens/platform"), "NotificationsScreen") |
| `/admin/ads` | adminScreen(() => import("./admin-console/screens/platform"), "AdsScreen") |
| `/admin/settings` | adminScreen(() => import("./admin-console/screens/platform"), "SiteSettingsScreen") |
| `/admin/platform` | adminScreen(() => import("./admin-console/screens/platform"), "PlatformScreen") |
| `/admin/feature-flags` | adminScreen(() => import("./admin-console/screens/platform"), "FeatureFlagsScreen") |
| `/admin/emails` | adminScreen(() => import("./admin-console/screens/platform"), "EmailsScreen") |
| `/admin/admins` | adminScreen(() => import("./admin-console/screens/governance"), "AdminsScreen") |
| `/admin/roles` | adminScreen(() => import("./admin-console/screens/governance"), "RolesScreen") |
| `/admin/provisioning` | adminScreen(() => import("./admin-console/screens/governance"), "ProvisioningScreen") |
| `/admin/sessions` | adminScreen(() => import("./admin-console/screens/governance"), "SessionsScreen") |
| `/admin/audit` | adminScreen(() => import("./admin-console/screens/governance"), "AuditScreen") |
| `/admin/system` | adminScreen(() => import("./admin-console/screens/governance"), "SystemScreen") |
| `/admin/security` | adminScreen(() => import("./admin-console/screens/security"), "SecurityScreen") |
| `/admin/*` | adminAuthView("AdminRouteFallback") |
| `/` | view("Feed") |
| `/home` | view("Feed") |
| `/feed` | view("Feed") |
| `/explore` | view("Explore") |
| `/search` | view("Search") |
| `/people` | view("Search") |
| `/hashtags/:tag` | view("Search") |
| `/post/:id` | view("PostDetail") |
| `/profile` | view("OwnProfileRedirect") |
| `/profile/:username` | view("ProfilePage") |
| `/settings/follow-requests` | view("FollowRequests") |
| `/settings/notifications` | async () => ({ Component: (await import("./notification-settings")).NotificationSettingsPage, }) |
| `/settings/privacy` | async () => ({ Component: (await import("./privacy-settings")).PrivacySettingsPage, }) |
| `/saved` | view("Saved") |
| `/archive` | postLibraryPage("archive") |
| `/trash` | postLibraryPage("trash") |
| `/drafts` | postLibraryPage("drafts") |
| `/create` | creatorStudioView |
| `/settings` | view("Settings") |
| `/settings/appearance` | view("Settings") |
| `/settings/account` | view("Settings") |
| `/login` | view("AuthPage") |
| `/signup` | view("AuthPage") |
| `/forgot-password` | view("AuthPage") |
| `/reset-password` | view("AuthPage") |
| `/auth/check-email` | view("AuthCheckEmail") |
| `/auth/confirm` | view("AuthConfirm") |
| `/auth/confirmed` | view("AuthConfirmed") |
| `/verify-email` | view("AuthCheckEmail") |
| `/onboarding` | view("Onboarding") |
| `/help` | view("HelpCenter") |
| `/maintenance` | Maintenance |
| `/messages` | view("MessagesPage") |
| `/notifications` | view("NotificationsPage") |
| `/stories/create` | async () => ({ Component: (await import("./story-editor-page")).StoryEditorPage, }) |
| `/stories` | view("StoriesPage") |
| `/stories/archive` | view("StoriesArchivePage") |
| `/reels/create` | view("ReelStudioPage") |
| `/reels` | view("ReelsPage") |
| `/groups` | view("GroupsPage") |
| `/groups/create` | view("GroupsPage") |
| `/groups/:slug/members` | view("GroupMembersPage") |
| `/groups/:slug/requests` | view("GroupRequestsPage") |
| `/groups/:slug` | view("GroupDetailPage") |
| `/*` | view("RouteDispatcher") |
| `/about` | Published CMS / PageWorkspace information |
| `/privacy` | Published CMS / PageWorkspace information |
| `/terms` | Published CMS / PageWorkspace information |
| `/community-guidelines` | Published CMS / PageWorkspace information |
| `/safety` | Published CMS / PageWorkspace information |
| `/cookies` | Published CMS / PageWorkspace information |
| `/acceptable-use` | Published CMS / PageWorkspace information |
| `/data-policy` | Published CMS / PageWorkspace information |
| `/legal` | Published CMS / PageWorkspace information |
| `/contact` | Published CMS / PageWorkspace information |

## Rebuilt templates

Discovery/search, library, activity, stories, settings/privacy/notifications, communities, information/CMS, account journeys, profiles, creator destinations, administrator resources, and loading/error/maintenance use the new structural templates. Home/auth/feed, post reader and reel viewer retain the preceding clean-product rebuild. Published custom CMS content is preserved inside the rebuilt host.

## Verification

Browser coverage is recorded in VELORI_PROGRESS.md. Individual dynamic item/detail states depend on existing authorized data; they are not fabricated. Permission checks and backend handlers remain in place.

## Final rebuild checks

The public welcome composition, global desktop navigation, feed greeting, and creation actions were rebuilt together with the route workspaces. Browser checks covered 49 admin routes and 33 social routes at desktop and phone widths; the message-admin route correctly showed the existing role restriction. Narrow public and auth layouts were inspected at 320px. Existing QA sessions were signed out. The complete regression suite passed 203/203 using writable temporary fixtures. These are layout and regression checks, not a claim that every production mutation or media export was exercised.
