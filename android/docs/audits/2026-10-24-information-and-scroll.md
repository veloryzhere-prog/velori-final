# Information pages and parchment motion — 24 October 2026

## Delivered scope

Added a VELORI information directory with twelve new CMS-registered routes: `/veloryz`, `/blog`, `/jobs`, `/developers`, `/locations`, `/popular`, `/lite`, `/meta-ai`, `/muse`, `/threads`, `/contact-uploading`, and `/verified`. Existing About, Privacy, Terms, Contact, Safety and policy routes share the new information layout. The footer is present on entry, authentication, public-information and signed-in product surfaces; existing full-screen inbox/editor footer hiding remains intact.

The content describes implemented functionality and marks unavailable services explicitly. Jobs has no invented vacancies; API explains the actual source stack without offering a public API; Lite is an experience guide with real motion controls; Locations uses existing content search rather than inventing a map. Meta AI, Muse, Threads and Meta Verified remain independent external destinations. No affiliation, paid verification, translation system, address-book importer or subscription was added. English is the currently supported interface language.

Published admin CMS content still wins over bundled section copy. It is embedded inside the new page frame without changing stored content or publication state. The Help Center now keeps its searchable product answers available alongside admin-published guidance. Added current answers for motion, announcements, shared chat content, Child Mode, deletion scope, profile previews, mutual connections, offline recovery and verification/contact-import limitations. Corrected stale reporting and username guidance. Account contact fields remain live site settings.

## Motion repair

Older operating-system reduced-motion CSS could suppress an explicit Full selection. The legacy suppression rules now apply only when the resolved interface preference is not Full; Auto still resolves to Gentle on a reduced-motion device, and Off still disables interface animation. This does not override the user's selected mode. No dependencies were added.

Parchment reveal no longer collapses a flex/grid subtree. The final layout stays stable while the sheet reveals from the top, its bottom roller moves downward, and ink fades in. Full delivery is 1.65 seconds; Gentle is a brief fade; Off is immediately readable. Banner, modal and admin preview use the same paper. New announcement IDs remount the arrival, and admin preview can replay without publishing. Existing targeting, frequency caps, schedule, acknowledgment, publication permissions and real event recording are preserved.

Published CMS frames now receive the selected motion mode, resize when content/fonts change, and disconnect their resize observer on unmount. This preserves author HTML/CSS/JavaScript and existing sandbox/link behavior rather than replacing admin content.

## Browser evidence

- Actual application: all twelve new routes loaded. Phone route checks showed no document horizontal overflow. About retained its published custom content inside the new design.
- Actual Help: searching Child Mode returned the matching answer; expanding it showed the documented limitations. Published team guidance remained present below. Switching to Off propagated `data-ui-motion="off"` into the published CMS frame.
- Actual page layouts checked at 320, 375, 430, 768, 1024 and 1440 px, including published About content. Document scroll width did not exceed client width.
- The actual AnnouncementPaper/AnnouncementOverlay rendered in a disposable local component fixture. At 0 ms the sheet was closed with hidden ink and roller at -12 px; at 700 ms it was partly open with roller around 354 px; at 1200 ms almost open; at 1800 ms fully readable. The card's height remained stable across samples. These were browser measurements of the actual keyframes, not a claim based only on source text.
- Long letter text scrolled independently. Close/CTA/acknowledgment fit the viewport at six widths; 375×667 was checked separately. Full showed `cp-parchment-reveal` and `vi-note`/`vi-orbit`; Gentle and Off showed no continuous paper or illustration animation. Viewport override was reset.
- Locations submitted to the existing search route, which correctly requested sign-in for an anonymous visitor. No real messages, reports, jobs, subscriptions, announcements or CMS edits were submitted for testing.
- Disposable fixture files are removed before source packaging.

## Checks and limits

The existing complete suite passed 243/243 after adding two regressions covering footer completeness and reduced-motion CSS precedence. TypeScript passed after the published-content integration. Final verification/build results are recorded in the release notes during packaging.

No schema, backend, auth, permission or dependency changes in this pass. Physical mobile keyboards, every authored CMS document's own internal animation, external vendor availability and a complete route-by-route accessibility/performance audit are not claimed. Third-party pages stay at their original destinations. Product policy copy is guidance and is not represented as a lawyer-reviewed agreement. Hosted CMS rows, user records, uploaded media and hosted-only secrets remain separate from the source export.

### Final check result

The full `pnpm verify` was attempted. Formatting now passes across all 356 source files and TypeScript passes. The combined pipeline stops at its pre-existing stale intellectual-property inventory (including files changed in previous releases and newly added source). That inventory has not been relabeled as verified ownership or silently bypassed. Security audit, tests and build do not run inside that stopped combined command. The complete 243-test suite passed separately; the final production build is run separately during source packaging. This is a known repository audit limitation, not a runtime UI failure.

### Production handoff correction

The published root returned HTTP 200, but a fresh direct `/blog` visit returned HTTP 404. The source hosting manifest had no SPA fallback; client navigation and local Vite fallback concealed this. Added the supported `static.not_found_handling: "single-page-application"` configuration and a manifest regression, preserving all app/API permission boundaries. This makes the static host serve the React entrypoint for direct client routes; React Router still handles unknown-page rendering. Repackage and republish are required for this correction.
