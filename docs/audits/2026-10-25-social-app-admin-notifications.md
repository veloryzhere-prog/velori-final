# VELORI social app and administration update — 25 October 2026

The update extends the existing React/Vite site and Supabase integration. It adds no package dependencies, schema objects or alternative authentication flow.

## Shipped behavior

- `/admin/admins`: create accounts through the existing API; search by name, username and role; filter enabled/disabled accounts; edit supported role/display-name/session-timeout fields; enable/disable with an audit reason; remove console access. The UI respects the existing permission requirements and prevents self changes. The backend remains the authority for the last active super administrator and authorization. Role changes require both the patch route permission and the existing role-assignment permission.
- Visible request failures stay visible, including within edit/create/confirmation dialogs. The active session count now reads the field returned by the live API.
- Phone header: visible message and notification actions with numeric counts. Existing bottom navigation and post/reel/story creation remain connected. Desktop also has direct Home, Create, Profile, notification/message and Forge entry points.
- Forge workspace, user guide, pricing, API/security and payments-help links are accessible from the shared navigation and footer. `/forge-payments` has an editable CMS draft with complete document source. CMS groups Forge pages together; the existing Page Studio regenerates the updated source when requested by an administrator. The Forge workspace is a functional app route, not a replacement CMS landing page.
- Settings → Notifications → Message alerts: explicit permission opt-in, off action and test notification. New private messages can produce generic system alerts while a VELORI tab is open in the background. Visible VELORI tabs rely on in-app indicators. No private message content is copied to a lock screen.

## Push delivery boundaries

The existing `push_subscriptions`, notification preferences and service-worker push receiver remain. There is no configured server push sender or VAPID key in this build. Closed-app delivery is therefore not active. The UI labels this separately instead of claiming subscription equals verified delivery.

Completing closed-app push requires a trusted server dispatcher, its private VAPID key, corresponding public browser key, delivery retries/expired-subscription cleanup, an authenticated database-event or job connection, and a real-device acceptance test. Any new database queue/trigger is subject to the repository's schema-approval rule. Do not place service-role or private VAPID keys in `VITE_*` variables.

## Connection repair and release guard

The recovered repository had no browser environment configuration and the first actual CMS navigation failed. Retrieved the existing project's browser-safe publishable key through the Supabase connector, restored the local public configuration and saved only public browser values in Sites environment revision 1. After reloading, the real `/forge-payments` route loaded its source fallback following a successful published-page absence check.

`pnpm build` now refuses missing, placeholder, invalid-URL or private browser credentials before bundling. `.env.local` stays ignored. On a fresh checkout, obtain the existing public environment values from the Site settings before building; keep private backend credentials on the backend. Do not rotate credentials merely to restore a checkout.

## Verification record

- Full Node suite: 294 cases, 293 passed, one Windows-only skip, zero failures (final release run).
- TypeScript and production build passed; changed-source formatting and copyright inventory/check passed.
- Actual Supabase metadata confirms `notifications`, `messages` and `conversation_participants` already belong to `supabase_realtime`. No publication/schema changes were needed.
- CMS read verifies all five Forge entries are drafts with HTML, CSS, JS and draft content. Only the new payments draft was inserted; no existing publication was changed.
- Read-only live source inspection confirmed the current administrator list/patch contracts in social server v47. That function was not redeployed.
- Local browser component fixtures: six widths (320, 375, 430, 768, 1024, 1440), no document horizontal overflow for home, inbox and administrator list. Header controls are 44px. Admin search/status filtering, protected own-account controls, navigation menu and Create choices inspected.
- Actual public CMS page loaded after restoring the connection; documentation navigation from Payments to User guide reached /forge-docs through its accessible link. Hardened the CMS click handler to resolve srcdoc routes against the owning app URL and avoid cross-realm element assumptions.

## Acceptance still required

No signed-in administrator or social-user session was used for production mutations. Account create/edit/disable/remove, message send/read across two real users, OS permission prompts, real device notification display, background-tab suspension behavior, iOS installed-app behavior and closed-app push were not accepted on a physical device. Component fixtures are not production account testing. Existing Forge commercial activation, the isolated environment endpoint and transcription deployment limitations remain as recorded in prior audits.
