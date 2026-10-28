# VELORI motion, scroll-letter and creator reliability audit — 2026-10-23

## Implemented

- Announcements use a shared vintage parchment scroll in live delivery, banner presentation and administrator previews. Wooden rollers, a wax seal, serif lettering and an animated top arrival/unroll replace the folded paper. Long copy scrolls independently; acknowledgement and action buttons stay visible. Full, Gentle and Off remain authoritative.
- Added keyboard skip navigation, lazy-route loading feedback, correct focus restoration to the mobile Create trigger, dark motion controls, subtle looping accents, and off-screen/background suspension.
- Fixed insert-only post likes/saves and reel reactions using conflict-ignore inserts instead of requesting UPDATE permission. Added an immediate post reaction guard and failure cleanup. No database or permission changes.
- Fixed gallery updates that could index a removed item, retained arrow-key video seeking, restricted carousel swipes to horizontal intent, added signed-media retry, reset video state across sources and pause/cleanup on background/unmount.
- Fixed Reel Studio shell navigation covering the fixed editor. The phone header now keeps Save/Preview/Export/Publish visible in a compact grid, with accessible Tools/Properties below the timeline. Story Studio no longer competes with social navigation.
- Fixed MP4 format selection: the prior first-choice H.264 Level 3 profile was inappropriate for the default full-HD portrait canvas. Prefer browser-selected MP4, with Level 4 fallback; request explicit canvas frames for still-image compositions. Added audio-track scheduling, media-preparation timeout/cancellation and recorder cleanup.

## Evidence

- Full regression suite: 215 passed, 0 failed before the final renderer refinements; repeated during final packaging. Three new tests cover insert-only reaction permissions, viewer-scoped removal and invalid/error handling.
- Live authorization probes: 17/17 passed against the existing backend. Anonymous access to messaging and private storage remained refused.
- Real post Like and Save persisted after refresh, then were removed to restore the QA account state. No messages, comments, campaigns or social content were published.
- Scroll popup checked at 320, 375, 430, 768, 1024 and 1440 pixels: no horizontal overflow, letter/action controls fit. Long required announcement remained open on Escape and closed on acknowledgement; focus returned to its opener. Tab and Shift+Tab wrap checked.
- Full computed cp-scroll-delivery/cp-scroll-length; Gentle only cp-paper-fade, and Off no animation.
- Announcement editor at 320, 390, 768 and 1440: surface and footer fit, no internal horizontal overflow. The editor uses the same public scroll component.
- Small-phone route checks included home, explore, search, messages, notifications, settings, privacy, notification preferences, groups, profile, saved, drafts, archive, stories, post creation, reel creation and story creation. Document/client widths matched. Desktop checks of home, explore, messages, settings, groups and stories matched at 1440 pixels.
- Reel Studio export control was reachable at all six widths. Fractional viewport rounding measured up to 0.2px on the studio edge, without document overflow.
- A real existing project image was imported, placed on a five-second timeline and exported through the actual studio. The updated full-resolution renderer reported a non-empty MP4. A separate small-composition recording also produced 38,712 bytes. The imported QA asset/clip was removed and the empty draft saved after verification.

## Acceptance limits

This is an implemented and verified motion/announcement/creator reliability increment, not an exhaustive launch sign-off. Real campaign publication, scheduled delivery across accounts, email recovery delivery, all privacy combinations, uploads/publication of each social content type, hardware/device codec combinations and low-end mobile performance remain outside this pass. No schema, dependency, backend contract or site audience was changed. The full application should not be described as universally verified or feature-perfect.

Additional audio evidence: a generated one-second tone was added through the actual audio-asset and rendering helpers. The resulting MP4 contained 58,303 bytes; decoded audio peak was 0.288, confirming a non-silent track. The test used no live publication or remote audio asset.
