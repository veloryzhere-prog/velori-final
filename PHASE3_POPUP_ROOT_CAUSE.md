# Phase 3: Promotional Popup Root Cause

## Finding

The campaign overlay itself was mounted correctly on the normal product shell and already used a body portal, focus management, route/date eligibility, dismissal state, and the `system_announcements` public read model. The FORGE route branch in `src/app/shell.tsx` returned `AnimatedOutlet` early for `/forge`, `/artifacts`, and `/studio`, before `ProductFrame` rendered its `LiveAnnouncements` owner. Consequently, no system campaign could appear on the FORGE landing or project-entry routes.

A separate component, `PremiumOffer`, is inside `Assistant`. It is a verified plan-discovery experience, not a welcome campaign. It deliberately waits for account/quota/use conditions and therefore cannot satisfy a first-entry welcome trigger.

## Repair

- Mount the existing `LiveAnnouncements` component from the shell on `/forge`, `/artifacts`, and `/forge/projects/new` only. It remains absent from pricing, preview, and editor routes, so it cannot cover checkout or an active generation.
- Preserve existing campaign records, server eligibility state, and frequency settings. A `/forge` route-targeted campaign also qualifies at `/forge/projects/new` so the pending Build request is not interrupted by route transition.
- Reject malformed campaign dates and already-dismissed state in the shared eligibility policy.
- Preserve safe URL handling from the existing campaign policy. The configured CTA continues to use the existing `AnnouncementPaper` route/link handling.

## Reproduction And Evidence

The real `/forge` route was opened in Chromium. A Playwright network fixture returned one active `system_announcements` record; the actual shell loader, eligibility policy, overlay portal, focus handling, dismissal, and CTA link rendered. A separate browser case returned an empty campaign array and verified no overlay appeared. The configured CTA navigated to the existing `/forge/pricing` route.

The campaign record was mocked at the REST boundary. This proves real page rendering and routing, but does not prove that a live admin campaign is currently configured, eligible for a real account, or returned by production Supabase. No campaign or reward was created or granted.

## Current Limits

Only configured announcement links supported by the existing announcement contract are exercised. `OPEN_REWARDS`, `OPEN_REFERRALS`, `OPEN_DOWNLOAD`, `OPEN_HELP`, and `CONTINUE_TO_SETUP` action variants were not added as a new campaign action system. A real authenticated account's server-side campaign dismissal/cooldown behavior remains unverified.