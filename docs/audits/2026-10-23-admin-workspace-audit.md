# Admin workspace audit — 2026-10-23

Scope: shared console and the dashboard, people/groups, moderation, publishing/campaigns, website/CMS, appearance/motion/error screens, creator tools, settings/features/email, and access/security/system workspaces. This is a source and service audit; responsive visual verification is pending.

## Implemented

- Consistent warm-white surfaces, pink active states, readable typography, clearer fields/actions, responsive workspace controls, and scoped dark-mode colors. Existing motion preferences remain respected.
- Permission-aware area destinations, section visibility, home links, dashboard cards and breadcrumbs. Fixed the CMS-only SEO shortcut and incorrect social-area context. Collapsed navigation has explicit accessible names.
- Search available to all authenticated roles for permitted workspaces; remote record search remains gated by users.view. Fixed grouped-result keyboard ordering, stale requests, focus handling and portal placement.
- Up to six per-administrator pinned workspaces, persistent comfortable/compact density, storage failure fallback, and pin validation against known internal routes.
- Shared table tools filter the loaded page and export its visible data columns to CSV. Labels state the loaded-page scope. Action columns are omitted; CSV escapes quotes/newlines and guards formula prefixes. Existing server filters/pagination remain in place.
- Profile uses the shared accessible dialog. Dialogs have a close button, nested focus handling, body scroll locking and deduplicated dismiss actions. Repeat submissions are guarded immediately; resources discard late responses on unmount.
- System checks refresh health, storage and version together. A downloadable health report contains the information displayed on that page.
- Optional creator source-management service now explains a missing server deployment rather than displaying an opaque Not found message.

## Evidence

- Full existing test suite plus four admin regressions: 219 passed, 0 failed.
- New regression coverage: limited-role area routing, scope isolation, pin validation/limit, Unicode row matching, CSV quoting and formula defense.
- Actual Table component server-render smoke check passed: both fixture records and loaded counts appear; records are not accidentally hidden.
- TypeScript validation passed during implementation; final source/build checks are recorded by the Sites packaging workflow.
- 37 authenticated read-only service probes: 35 returned HTTP 200. The optional /creator-source/files endpoint returned 404. The legacy /error-pages endpoint also returned 404, but it is not used by the current ErrorPagesScreen; that screen uses /design/motion, which returned 200.
- System-health report: overall operational; database, authentication and both storage probes operational; SMTP delivery unknown. No pending migrations reported.
- No content, campaign, role, credential or database-schema changes were made. Audit used existing QA authentication; no email/test notification was sent.

## Verification limits and follow-up

- Browser tooling could not launch: CreateProcessSecurityEnvironment, HRESULT 0x80070020. Desktop/mobile appearance, focus behavior and downloads have not been visually or interactively verified in this session. This work is not marked visually verified.
- Hosted GitHub source browsing/pull-request tools require the matching server integration to be deployed. Website source deployment does not deploy the separate Supabase function.
- SMTP delivery remains unverified; the audit did not send messages.
