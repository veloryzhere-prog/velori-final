# Recovery, maintenance and social usability audit

## Delivered

- Self-contained offline screen with layered animated geometry, connection-aware messages, real eight-second retry checks, reconnect handling and persistent Device/Full/Gentle/Off motion preferences. No external stylesheet, font, script or image is required.
- Service worker now handles failed, timed-out and HTTP 5xx same-origin navigations. Required fallback precaching prevents a replacement worker installing without its recovery document. Cache eviction protects the fallback; authenticated HTML and API responses are not cached. Existing push handlers remain intact.
- Distinct default animated maintenance, offline, missing-page, access and application-error illustrations. Published administrator artwork, text, actions and permission rules remain authoritative. Last-resort rendering no longer calls router hooks outside RouterProvider and uses a standalone recovery screen.
- Maintenance administration includes an expanded page selector (studios, libraries, settings and registered public pages), saved-scope status, unsaved-change protection before enabling, saved-scope confirmation, retained emergency permission/reauthentication/reason requirements and a visitor preview. Turning maintenance off remains possible with unsaved settings. Global, exact-route and route-group maintenance and scheduled windows retain existing backend contracts. Public settings refresh on reconnect/focus and every 15 seconds while armed, with revision protection against stale request results.
- Followers and Following counters open paginated profile dialogs with actual profile links, keyboard close/focus restoration, retry, loading and privacy-aware empty states. Uses existing profile_connections RPC; no direct relationship-table fallback or expanded visibility.
- Chat presentation has date separators, clearer light/dark bubbles, readable contrast, improved phone header actions and retained messaging, attachment, reactions, safety and realtime logic.

## Verification

- Full existing Node suite: 231 passed, 0 failed, including eight added worker regression tests (deep navigation rejection, server failures versus preserved 4xx, timeouts, required precache failure, private HTML exclusion, API/probe bypass, fallback-preserving eviction and readable fallback without cache).
- Actual browser outage test: stopped the local server, reloaded /maintenance, saw the self-contained recovery screen at the original URL, retried and received the unavailable message. Restarted server; retry recovered the actual page.
- Real UI components inspected through temporary isolated fixtures with no production mutations. Error, maintenance, connection dialogs, admin maintenance controls and chat measured at 320, 375, 430, 768, 1024 and 1440 pixels with no document horizontal overflow. Phone and desktop screenshots inspected during work; temporary fixture files removed before packaging.
- Full motion computed status-float; Gentle and Off rendered still artwork. Device reduced-motion remains supported. Connection dialog pagination, direction switching, failure feedback, Escape close and profile link destinations inspected. Admin fixture confirmed save-before-enable guard, saved /reels/create confirmation, enable/disable updates, deactivation with dirty settings and draft /messages visitor preview. Scope controls measured 46px tall at all six widths.
- Read-only deployed profile_connections probe: HTTP 200 with an empty result for an unknown profile. Source review confirms visibility, approved-follower and block enforcement remains server-side.
- Final TypeScript and production build run through the packaging workflow. Publication preserves the existing owner-private audience.

## Limits

A service worker can recover navigations only after a successful visit and installation on this VELORI origin. It cannot replace first-visit browser DNS/TLS/security errors or error pages on other domains. Existing clients may need the Update now action to activate a waiting worker. Service/settings recovery does not imply an unsent message or post was saved: recovery copy asks visitors to check before resubmitting.

No production maintenance setting was changed and no live messages were sent for testing. Admin backend mutations, cross-account privacy combinations, real delivery, actual mobile keyboards and unavailable-platform edge cases were not exhaustively tested. The mocked chat checks validate presentation with actual components, not live message delivery. Scheduled maintenance behavior retains the already-tested shared matching/window functions. This audit is scoped to the requested recovery, maintenance, profile connections and messaging improvements.
