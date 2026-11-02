# 07 — Messaging, groups, and notifications

Status: IMPLEMENTED — AUTHENTICATED ACCEPTANCE NOT VERIFIED. Messaging/notification presentation slice is complete; group workflows have not started.

## Routes and implementation

- `/messages` → `MessagesPage`, re-exported by `src/app/views.tsx` from social page modules; source uses Supabase conversations, participant checks, realtime events, attachments, reactions and safety constraints.
- Groups are separate real routes: `/groups`, `/groups/create`, `/groups/:slug`, `/groups/:slug/members`, `/groups/:slug/requests`. They support membership lifecycle and permission/role behavior; inspect owning exports before editing.
- `/notifications` → `NotificationsPage`.
- `/settings/notifications` → `NotificationSettingsPage` with in-app and push preferences/device controls.
- Feature flags include `messaging_enabled`, `groups_enabled`, and `notifications_enabled`.

## Phase 6 plan

- Preserve conversation selection via query/hash, unread state, message send/edit/delete, reactions, attachments, voice/media behavior if present, typing/realtime updates, participant privacy and block enforcement.
- Preserve group create/join/request/invite/member/role flows, locked/private/hidden group discovery, and permission-gated controls.
- Preserve notification filters, unread markers, navigation targets, bulk actions, preferences, push support checks, opt-in/disable flow and errors.
- Do not add fictional messages or notifications. Honor `PendingFeature`/feature-flag unavailable states where an integration is not actually enabled.
- Preserve mobile touch targets and ensure the conversation list/detail layout remains usable on narrow screens.

## Acceptance

Check empty/loading/error, new and selected conversations, send and failed-send, permissions, attachments, unread/read, notification filters and push unsupported/denied/supported states, group request/approval/denial/role states, reduced motion and responsive overflow. Run messaging security/privacy scripts when affected.

## Implementation and verification record

- Updated the existing messaging and notification interfaces with scoped Motion Glass styling, visible focus states, responsive/touch-sized controls, and clearer filter/unread states. Filtered conversation empty messages now describe the active search/filter and are announced as status updates. Notification filters use a labeled toggle group with `aria-pressed`; existing Supabase queries, realtime, permissions, actions, and navigation were preserved.
- `pnpm run typecheck`, `pnpm test` (203 passed, 0 failed), `pnpm run build`, and focused `oxfmt --check src/app/social-views.tsx src/app/views.tsx` passed. The formatter reports existing whole-file drift when `src/index.css` is included; that large stylesheet was not reformatted wholesale.
- Signed-out browser smoke checks confirmed `/messages` and `/notifications` redirect to `/login`. Authenticated UI and behavior remain unverified because no authorized session was available. No fake conversations or notifications were created. Groups are not implemented in this slice.
