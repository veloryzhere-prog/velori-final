# 08 — Settings, administration, moderation, and CMS

Status: IMPLEMENTED - NOT VERIFIED; authenticated settings and admin acceptance is pending.

## User-facing routes

- `/settings`, `/settings/appearance`, `/settings/account` → `Settings`.
- `/settings/privacy` → `PrivacySettingsPage`; `/settings/notifications` → `NotificationSettingsPage`; `/settings/follow-requests` → `FollowRequests`.
- `/help` → `HelpCenter`.
- Public CMS registry: `/about`, `/privacy`, `/terms`, `/community-guidelines`, `/safety`, `/cookies`, `/acceptable-use`, `/data-policy`, `/legal`, `/contact`. Unknown routes use published CMS lookup/Not Found handling.
- `/maintenance` is a dedicated platform state.

## Admin routes

Admin auth: `/admin/login`; nested `/admin` console. Current route declarations include:
`/admin`, `/admin/dashboard`, `/admin/website`, `/admin/website/pages`, `/admin/pages/:pageId`, `/admin/website/navigation`, `/admin/website/footer`, `/admin/website/seo`, `/admin/people`, `/admin/users`, `/admin/groups`, `/admin/content`, `/admin/cms`, `/admin/posts`, `/admin/comments`, `/admin/reports`, `/admin/messages`, `/admin/reels`, `/admin/stories`, `/admin/brand`, `/admin/brand-assets`, `/admin/branding`, `/admin/animations`, `/admin/motion`, `/admin/error-pages`, `/admin/errors`, `/admin/theme`, `/admin/navigation`, `/admin/routes`, `/admin/announcements`, `/admin/notifications`, `/admin/ads`, `/admin/settings`, `/admin/platform`, `/admin/feature-flags`, `/admin/emails`, `/admin/analytics`, `/admin/communication`, `/admin/maintenance`, `/admin/admins`, `/admin/roles`, `/admin/provisioning`, `/admin/sessions`, `/admin/audit`, `/admin/system`, `/admin/security`, plus `/admin/assets`, `/admin/logs`, `/admin/moderation` aliases/duplicate declaration and `/admin/*` fallback.
Screen modules are `src/app/admin-console/screens/{appearance,content,dashboard,governance,groups,moderation,platform,security,social,users}.tsx`. Access is permission-filtered in session/navigation; preserve every permission check.

## Phase 7 plan

- Settings: account, appearance, privacy, notification preferences, device/push, safety/block/mute/restriction controls.
- Admin: dashboard, users/groups, moderation, reports, CMS, public navigation/SEO, branding/theme/motion, notifications/ads/platform settings, feature flags, roles/provisioning/sessions/audit/security.
- CMS: preserve draft/publish status, route registry, editor components, sanitization, SEO metadata and public page rendering.
- Keep admin controls distinct from user-facing settings; do not leak administrator data or bypass permissions.
- Resolve duplicate/alias route behavior only after a route test and explicit decision; document current outcomes first.

## Public CMS resolution policy

- Registered public pages and the Help Center query only published rows. Until that lookup resolves, render a loading state rather than bundled copy; on a request error, show an error with retry rather than treating the failure as a missing page.
- Bundled copy is an intentional fallback for registered routes only after a successful lookup confirms that no published row exists. Unknown routes show Not Found only after the same successful absence check.
- Lookups are normalized by route, deduplicated while in flight, and cached per route for up to two minutes. Publication events trigger a refresh. Previously validated published content remains visible if a background refresh fails.
- All CMS routes use the same renderer, including custom HTML and its corresponding custom CSS. Draft rows are never selected for public display.

## Acceptance

Verify user and admin sessions separately, role/permission denial, destructive confirmations, settings load/save errors, theme preview/publish, CMS draft/publish, public page output, maintenance/error/404 routes, and responsive admin tables/menus. Run admin/security/CMS relevant E2E and security scripts.


## Campaign redesign — 23 October 2026

Announcements and ads now use scoped campaign workspaces with public-component previews. Existing admin access/API/publication contracts retained. Reels/Search delivery and announcement frequency behavior corrected. Full regression suite passed 212/212. Authenticated admin screens and local payload/interaction fixtures audited; no live test campaign published. Exact responsive and remaining acceptance limits: docs/audits/2026-10-23-campaign-ui.md.
