# Repository and backend audit

> Implementation status: the current public documentation release is deployed as version 20. The expanded workflow requirements below are not all implemented. New relational tables are a review-only proposal; no migration has been applied. This document is not evidence of a deployed API, legal approval, live vacancy, delivered email or translated platform.

The connected database has cms_pages, cms_page_versions and cms_page_publication_events, but no support-ticket, job, blog metadata, developer-application, verification or localization tables matching the requested systems. Reuse CMS content/revisions and existing Auth/admin permissions rather than creating a second dashboard or auth system.

# VELORI documentation and expression picker audit

24 October 2026 — release `velori-editorial-2026-10-24-r2`.

## Implementation

Recreated 23 VELORI/VELORYZ documents with an editorial design, animated paper scenes, responsive reading layouts, chapter navigation, SEO, searchable Help and accurate current feature status. Meta AI/Muse/Threads are absent from the footer; legacy paths redirect to VELORYZ AI or Roadmap. AI and public developer registration remain under construction. Careers states no announced vacancies and uses the configured public contact email.

Actual HTML/CSS/JavaScript is published in cms_pages and preserved in cms_page_versions. Sixteen previous published/draft snapshots were saved before recreation. Unrelated custom pages were unchanged. No database schema, grants, authentication rules or RLS policies changed.

Page Studio can load the current bundled design into a draft and export source JSON. Site directory's ordered, hideable blocks drive the shared footer and remain editable in Custom HTML mode. Footer navigation opens the CMS library. Display settings use a hidden existing content block to retain the current public column grants. Existing permissions, reauthentication, conflict protection and publishing behavior remain.

Added a dismissible top-left motion discovery hint, animated wordmark accents, live motion changes inside CMS frames, hidden/off-screen pausing and frame-source validation for Lite's motion shortcut. Fixed iframe chapter links and form events. CSP still blocks direct form actions.

Chat adds category search, Unicode emoji insertion at the caret, recents, GIF selection, validation feedback and image/GIF previews with object-URL cleanup. GIFs use the private message-media bucket, existing 25 MB limit and existing send/signing/participant workflow. Its MIME allowlist now includes image/gif. No new dependency or external GIF provider was added.

## Browser evidence

The actual managed Vite preview was checked in the cloud browser:

- Journal/Help render complete documents without the previous duplicate article frame.
- Searching Help for animations changes nine answers to one; FAQ expansion works.
- Full runs vd-paper-float when visible; Off returns animation none; off-screen paper pauses.
- Back-to-top, internal Contact/Help links and Lite's global motion shortcut work.
- Contact creates a correctly encoded mail draft including line breaks. No email was sent and no support ticket is created.
- Places search reaches the existing sign-in gate for a signed-out visitor.
- /meta-ai redirects to /veloryz-ai with explicit Under construction status.
- Actual documents inside 390 px/768 px frames measured 373/373 and 701/701 client/scroll pixels, without horizontal overflow.
- Isolated actual ChatExpressionPicker inserted an emoji and kept it in Recent. The fixture sent no messages and was removed before publication.

## Verification and limits

250 tests: 249 passed, one existing skip, zero failures. TypeScript and source formatting passed. Build passed, then runs again at final packaging. Copyright inventory/check completed; unresolved origins are reported rather than treated as rights clearance.

The unchanged production dependency tree has 13 audit advisories using authoritative pnpm 10.34.3: six high, six moderate, one low. Fabric, extract-zip, basic-ftp, Vite and Zod appear in high-severity paths. A system-pnpm audit ignored overrides and is not authoritative. No dependencies were added or upgraded; these advisories are not claimed fixed.

Supabase advisors were inspected after the MIME update. Existing security-definer exposure, extension placement and leaked-password-protection findings remain for individual review. No protections were weakened to silence findings.

No live messages, reports, applications or emails were sent. Two-account GIF delivery, authenticated admin mutations, physical phone keyboards and every existing social/editor feature were not exhaustively retested. The complete backend source and migrations remain in the project; this is not a claim of a universally bug-free platform.
