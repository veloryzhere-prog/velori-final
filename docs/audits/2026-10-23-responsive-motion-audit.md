# Whole-site responsive and motion audit — 2026-10-23

## Scope

Source audit covered shared route/layout owners for visitor/home, authentication, feed, discovery/search, profiles, post readers/libraries, messaging, groups, notifications, settings/privacy, public/CMS pages, post/story/reel creation, reel/story viewing, campaign overlays and administration. Existing route/data/permission contracts are preserved. This is not a claim of exhaustive functional or browser acceptance.

## Changes

- Replaced the full-width motion strip with a fixed top-left icon. Visitors and signed-in members can choose Full, Gentle, Off or Device mode using labeled native radios. Changes apply across routes and retain the existing browser preference key and cross-tab synchronization. The popover supports Escape, outside dismissal, focus restoration, bounded scrolling and light/dark appearance.
- Removed obsolete fixed 44px strip offsets from product/auth, admin, campaign, story and reel layouts. Independent headers reserve room for the control. Compact public navigation has a shorter Join label; the destination is unchanged.
- Refined shared content gutters, wrapping actions, horizontally scrollable tabs, phone typography, settings/notification grids, profile statistics, group controls, footer spacing and safe areas.
- Active phone chat uses the available viewport rather than a tall fixed minimum. The composer stays within the visible region as keyboards resize or overlay the viewport. Pinch zoom is ignored to avoid reflowing the page under the user. Existing mobile navigation remains available through the header menu; the bottom dock is hidden while a conversation is active.
- Added shared animated linework to primary introductions, a live motion-settings preview and restrained unread indicators. Existing decorative scenes remain. Full mode enables loops; Gentle/Off keep them still, and reduced-motion media preferences remain respected.
- Motion observers release disconnected targets, batch DOM additions, pause offscreen linework and suspend loops when the tab is hidden. Pointer tilt cancels pending frames on exit and ignores disconnected/zero-sized elements.
- Entrance animations no longer retain a completed transform, which otherwise creates a containing block that can clip fixed overlays inside cards.
- Fixed workspace navigation highlighting when search tabs and query text are combined.

## Verification

- TypeScript: passed.
- Existing suite plus viewport regressions: 223 passed, 0 failed.
- Targeted viewport and motion-preference checks: 8 passed, covering keyboard overlay/resize, address bars, missing visualViewport, pinch zoom and preference resolution.
- Vite served the new motion-control module with HTTP 200. Production build runs in the Sites packaging workflow.
- Formatting applied only to changed implementation files.
- No schema, dependency, authentication, authorization, campaign or user-content mutations.

## Verification limits

Browser automation repeatedly failed to launch (trusted Node process exited unexpectedly); preview handoff also failed. No desktop/mobile screenshots, interactive downloads, actual keyboard/device behavior or responsive viewport passes are claimed for this session. The target widths remain 320/375/430/768/1024/1440. Visual acceptance is pending, as required by AGENTS.md.

The prior optional source-management server integration and SMTP delivery findings remain separate backend follow-ups. The frontend update does not deploy a Supabase function or verify email delivery.

## Private project ZIP

The export contains the complete tracked project, frontend/admin source, public assets, Supabase functions/migrations/tests and setup documentation. At the owner’s explicit request, available checkout-local environment configuration is added only to the private download. The checkout contains .env.local and .env.example. Supabase-hosted secrets, database contents and storage uploads are not present locally. ChatGPT/Sites authorization, Git history, installed dependencies and privileged QA/audit credentials are excluded.
