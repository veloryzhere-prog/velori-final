# VELORI chat upgrade — 2026-10-23

## Delivered

- Rebuilt conversation details with VELORI branding and Details, Media, Reels, Files, People and Settings views. Shared private attachments reuse existing signed-media helpers and paginate message history. Group conversations expose their people and existing group settings.
- Added picture previews and zoom in chat and on profiles, personal themes/nicknames, thread search, notification shortcuts, existing mute/pin/archive/unread controls, block confirmation and a private-report form.
- Added optional per-conversation Child Mode text filtering, blocked draft notices with settings/direct-disable actions, send/edit checks and matching received-text hiding. Guide: docs/CHILD_MODE_README.md and /child-mode-readme.html.
- Added delete-for-me browser hiding and existing own-message soft-delete-for-everyone flow with acknowledged writes, failure recovery and a 650ms velori magic disappearance in Full motion. Gentle/Off avoid the effect.
- Added inbox message notices without message-body previews and honored mute settings. Preserved existing realtime, upload/voice, reply, reaction, pin and unread integrations.
- Corrected legacy theme specificity and mobile inbox height/inset conflicts.

## Storage and service boundaries

Themes, nicknames, hidden-message IDs and Child Mode are account/conversation-scoped browser preferences. They are labeled on-device and do not sync or affect another participant. Child Mode is optional text filtering, not a guardian lock or server policy; it does not inspect media, voice or external links.

Private-message reporting requires the proposed report_chat_message RPC. The current service does not expose it; the UI clearly reports that no report was submitted when unavailable. Existing public-content reports are not used for private messages.

No database changes were applied. AGENTS.md requires asking before schema changes. docs/proposals/chat-account-sync.sql is review-only, outside migrations, and proposes authenticated participant-scoped preference/hide tables and a private report RPC using existing moderation reports. Frontend sync integration and live multi-account verification remain a subsequent approved phase. Server-enforced Child Mode is not included in that proposal.

## Verification

- TypeScript passed after functional edits. Final typecheck and production build run during packaging.
- Existing full Node suite: 235/235 passed, including new filter and preference tests.
- Deployed messaging authorization probes: 17/17 passed (anonymous private access/writes/RPCs/storage denied). No new live user messages, blocks, reports, deletions or maintenance mutations were made.
- Actual components exercised in an isolated in-memory Supabase/auth fixture: details, theme/nickname persistence, Child Mode incoming hiding and retained blocked draft, shared reel link, profile zoom, mute, local hide, acknowledged own-message deletion, failure retention and missing-RPC reporting. Full-motion keyframe and velori magic text observed; Off avoided animation.
- Desktop and 375px phone screenshots inspected. Final chat measurements at 320, 375, 430, 768, 1024 and 1440px found no document horizontal overflow and composer within viewport; settings panel also measured at all six widths. Fixed a collapsed mobile inbox and retained legacy panel offsets found by the production-shell fixture.
- Temporary fixtures removed before publication.

## Remaining acceptance

Private reporting and preference synchronization require the reviewed backend phase. Real multi-account group administration, authenticated message delivery, attachment upload/voice, background notification delivery and real mobile keyboard behavior were not end-to-end verified during this change. No claim of exhaustive platform completion is made.

## Product references

Meta's public documentation informed the use of nicknames, pinned conversations and personal themes: https://about.fb.com/news/2024/11/new-ways-to-connect-through-dms/ and https://about.fb.com/news/2024/03/instagram-dm-updates/. VELORI's local optional text filter does not claim Instagram Teen Account or guardian-control equivalence.
