# VELORI admin and maintenance audit

Date: 2026-10-04

## Maintenance mode

The public site reads `site_settings.maintenance_mode`. The previous emergency-mode endpoint also flipped posting, uploads, messaging, and registration settings, then returned success without checking that the maintenance row had actually been updated. The admin confirmation path hid request failures, which left operators without a clear answer about whether the change had taken effect.

The endpoint now changes only the maintenance flag, requires a reason for either direction, reads the updated row back, and reports success only when the stored value matches the request. Turning maintenance off also attempts to clear the fixed emergency announcement. If that cleanup fails, the API still confirms the maintenance change and returns a separate warning. The admin updates its visible state from the confirmed response and shows errors inside the confirmation dialog.

The public settings provider listens for database changes and refetches when a tab becomes visible, with a two-minute fallback refresh. An already-open tab may therefore need a reload if a realtime channel is unavailable.

Live check: the site setting was already `false` when inspected. I sent the authenticated, reauthenticated switch-off action anyway; the deployed endpoint returned HTTP 200, and a separate settings read confirmed `maintenance_mode=false` with no cleanup warning. I also drove the admin confirmation UI with the live switch-off request while stubbing only the displayed initial state, and confirmed the UI showed “Maintenance mode turned off.” No public outage was introduced during verification.

## Advertisements

The old admin editor used `cta_url`, `cta_label`, and singular `story`/`reel` placement values. The server accepts `target_url`, `image_url`, and the plural placement enum, so campaign creation could reject its placement or silently discard destination fields. The public renderer also fell back to showing an ad from a different placement.

The editor now sends the database fields and currently implemented placements (`feed` and `search`). The public renderer respects `ads_enabled`, requests an exact placement, clears stale results on read failure, and now renders both feed and search placements. Campaign actions show errors and success feedback.

Live check: there are zero campaigns and `ads_enabled` is `false`, so no advertisement is expected to appear to visitors. The public delivery path is intentionally gated off in the live configuration; an active campaign was not created or exposed to real visitors during this audit.

## Other requested admin areas

- Error Pages save errors remain visible in the editor, and a success state appears after the API confirms the save.
- Motion Studio loaded its published configuration and rendered without application, console, or network errors. I added section jump links for common tasks (basics, page experience, route and error rules, preview, publishing, and history) to make the long advanced editor easier to navigate.
- Settings, Platform, Ads, Error Pages, and all other registered admin routes rendered during the live route sweep.

## Verification

- Live admin audit: 9 passed, 1 skipped because the live database had no user row for search; every swept screen returned HTTP 200 with zero page errors, console errors, failed requests, or bad responses.
- Public smoke tests: 7 passed.
- Unit tests: 48 passed.
- TypeScript check, formatting check, and production build passed.
- The Supabase `server` Edge Function was deployed with the maintenance fix and confirmed through the live switch-off request.
