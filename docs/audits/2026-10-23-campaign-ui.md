# Campaign UI and delivery audit — 23 October 2026

Implemented a shared folded-paper announcement, clean sponsored post/reel presentation, new campaign creation workspaces and matching live previews. Existing admin APIs, permissions, publishing confirmations, uploads, history, duplication and moderation controls remain connected. No schema, dependency or backend deployment changes.

## Findings resolved

- Reels was supported by the backend but absent from the editor and viewer: added placement selection and a labeled, skippable sponsored item after three organic reels, once per campaign per viewer mount.
- Default announcement lifetime count suppressed repeating frequency modes: every-refresh/session/day now use their actual frequency. An optional cap greater than one still applies; Once only always limits to one. The form explains the cap.
- Advertisement editing ignored saved draft payload: now merges private draft content before initializing fields.
- Search placement had no public renderer: connected the sponsored card on Search.
- Old destination choice used /discover-people: corrected to existing /people.
- Scheduled creatives needed route reload to appear: added one-minute eligibility refresh and foreground refresh, plus realtime ad updates.
- Destination validation now rejects insecure schemes, embedded credentials, protocol-relative links and backslashes. Existing sandbox/CSP rendering for custom HTML/CSS remains.
- Announcement feature flag is respected; ad creation indicates when delivery is switched off.

## Verification

- Full regression suite: 212 passed, 0 failed, including three campaign policy tests.
- TypeScript: passed before final formatting and repeated for publication.
- Real backend administrator sign-in and announcement/ad list loading succeeded using an existing approved local origin. Anonymous administrator ads request returned 401.
- Actual admin announcement and ad creation screens inspected. No existing campaign was changed or activated.
- Local-only form callbacks captured announcement draft/publish payloads and a Reels advertisement draft with correct destination. Required confirmation was shown before the local publish callback.
- Popup Full-mode computed cp-letter-delivery; acknowledgement, dismissibility and focus wrap exercised. Non-dismissible popup ignored Escape and remained until acknowledgement.
- Reel sequence: organic items 1–3, labeled sponsored reel, Skip, then organic item 4. No artificial engagement controls/counts on ads.
- Both editors at 320/390/768/1440: surfaces fit without internal horizontal overflow, action footers remained reachable. Popup surface also fit these widths.
- Temporary audit entry points/session bridge removed; no live campaign, reply, report or ad was published for testing.

## Remaining verification limits

Live upload, publication, scheduled delivery to other devices, analytics event totals and every role/audience combination were not exercised. Existing upload and publishing handlers remain the integration path. Background schedule refresh has up to a one-minute delay. Rich paper movement requires Full motion; Gentle/Off retain the readable document layout.
