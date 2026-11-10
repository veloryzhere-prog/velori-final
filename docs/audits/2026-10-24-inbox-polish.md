# Inbox, display fit and mutual connections — 24 October 2026

## Corrected inbox behavior

Conversation selection now updates the conversation query parameter, so an earlier deep link cannot pull selection back after inbox refresh. Selecting a new thread clears previous content in the same render. Pending message/media/reaction/history requests check the active conversation before writing state; older history retains scroll position. The inbox has paginated loading beyond 50 conversations, avoids flashing its full loading state on background refresh, and avoids using Child Mode-hidden preview text as a search match. Draft-cache failures do not undo successfully sent messages. Inbox alerts honor the account notification setting, and changes to online/typing settings reconfigure the existing realtime channel.

## Display and motion

Chat styles now target the actual ProductFrame root rather than a retired app-shell selector. The chat fills the remaining display below the application header, with independently scrolling inbox/thread and a retained composer. The route transition wrapper receives a stable full-height layout. Mobile hides the bottom dock during messaging and keeps secondary actions in the conversation-details panel. Loading uses a branded orbit/dots loop in Full motion and remains static under Gentle/Off; no artificial loading delays were added. Existing administrator-configured loading assets/presets remain supported.

## New settings and mutual connections

Conversation settings now expose the existing account-wide who-can-message, typing, online and message-notification controls with real persistence, error feedback and retry. Profiles and direct-chat details expose people you both follow using the deployed profile_mutual_connections RPC. It honors target profile privacy, following-list visibility, blocks, accepted follow status and avatar visibility. This is explicitly labeled shared following rather than claiming all mutual social relationships.

Supabase migration 20261024063821_profile_mutual_connections.sql is deployed. Live role-based transactional checks passed for a visible shared connection, hidden-list denial and anonymous denial. The test setup initially hit the existing follow-acceptance trigger; it was corrected to avoid no-op updates to accepted follows and to accept only pending requests as the recipient. Fixtures and temporary setting changes were rolled back. Account messaging settings also passed live owner-persistence/cross-account-denial checks with rollback.

## Actual browser evidence

The isolated test rendered the actual MessagesPage inside the actual ProductFrame and a data router. A controlled attachment-signing promise from chat A was held while chat B opened. Releasing A and refreshing the inbox left B selected, the query parameter on B, and only B content visible. The pending loader reported the velori-loader-orbit keyframe and no old-thread content. Account typing and message-permission changes persisted after closing/reopening the panel in the isolated service. No real messages, blocks or reports were sent for browser testing.

320/375/430/768/1024/1440 widths were measured with no document horizontal overflow and the composer inside the viewport. A final wide-screen correction was inspected at 1440: workspace x=226, width=1214, right=1440, y=78, bottom=900, exactly matching the available main column. Phone and desktop screenshots were inspected. Temporary QA files were removed.

## Verification limits

Final TypeScript, regression suite and production build run during packaging. The initial final regression attempt encountered Windows sandbox permission errors in disposable Git fixture directories; it was rerun using a writable temporary directory. Real hardware keyboard behavior, a full route-by-route accessibility audit and numerical low-end frame-rate benchmarks are not claimed. Existing broader database advisories remain documented in the motion-performance-sync audit.

## Official Instagram reference review

Meta documents nicknames/themes, pinning, edit controls and account/chat read-receipt settings: https://about.fb.com/news/2024/03/instagram-dm-updates/ . Its later DM overview covers scheduled messages, pinned content, translation/music and group invites: https://about.fb.com/news/2025/02/new-instagram-dm-features-stay-connected/ . VELORI reuses its working equivalent controls where supported. Scheduled delivery, licensed music stickers, translation services and full Instagram feature parity are not claimed or represented by placeholder buttons.
