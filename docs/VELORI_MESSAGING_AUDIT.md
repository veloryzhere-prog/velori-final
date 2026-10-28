# VELORI messaging audit

Audit date: 2026-10-06. Scope: the existing React/Supabase messaging feature and its current database contracts. The newest unread-count migration is local and has not been applied to a live database.

## Findings and changes

- Direct and group conversations already use Postgres RLS, participant membership, a private media bucket, signed attachment URLs, message idempotency keys, and message Realtime. The existing anonymous-access suite passed all 17 probes before and after the changes.
- Direct-message opening now checks the recipient's `message_permission`, blocks, and restrictions. Existing direct conversations stop being readable after either participant blocks the other, and every direct send is checked again by RLS. A live QA probe temporarily set a recipient to `nobody`, observed the expected HTTP 403, and restored their previous preference.
- Group message inserts now respect group membership, locked state, `allow_messages`, `allow_media`, and slow mode. Attachment metadata writes use a separate media-settings check so clients cannot bypass the media control.
- The inbox filters unread, groups, and archived chats; pinned chats sort first. Per-chat controls pin, mute for 1, 8, or 24 hours, archive/restore, and mark unread. Message actions support replies, one emoji reaction per member, editing and soft deletion. A single pinned message can also be set per participant.
- Thread history loads in 40-message pages. Text drafts persist in local storage, scoped to the signed-in account and conversation. Voice notes render in an audio player, and the composer caps text at 5,000 characters.
- Typing broadcasts and opt-in online presence use a private Realtime topic. Database policies allow only current conversation members to join, publish, and receive those events; sender preferences control whether the user's typing and online state are shared.

## Feature status

| Area                            | Status  | Notes                                                                                                                                                                                                                   |
| ------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct/group text messaging     | PARTIAL | Existing send/read flows remain; privacy and group send checks are enforced. Direct privacy denial passed live; positive send and group slow-mode scenarios were not end-to-end exercised.                              |
| Privacy, blocks, private media  | PARTIAL | Anonymous probes and recipient privacy denial passed live. Authenticated block and full media-setting matrix remain untested.                                                                                           |
| Voice notes and attachments     | PARTIAL | Private upload/signing path supports the accepted image, MP4 video, PDF, and audio MIME types; audio displays with native controls. A live upload/playback flow was not exercised.                                      |
| Thread pagination               | PARTIAL | Older history loads in 40-message pages; interaction against a long live thread was not exercised. Conversation-list paging is still fixed at 50.                                                                       |
| Replies, reactions, edit/delete | PARTIAL | Persisted with existing message fields and reaction table. Reactions allow one emoji per user per message; full member interaction flows were not end-to-end exercised.                                                 |
| Pin, mute, archive, mark unread | PARTIAL | Participant preferences persist in Postgres; mute durations and controls are implemented, but mutation/readback is not verified in a browser flow.                                                                      |
| Draft recovery                  | PARTIAL | Text draft persists per account/thread; attachments and failed uploads are not queued for offline retry.                                                                                                                |
| Search                          | PARTIAL | Inbox search checks loaded names and previews. Starting chat now searches eligible people; full account discovery and message-history search are not implemented.                                                       |
| Message requests                | BLOCKED | No request table or accept/decline flow exists; privacy-denied new chats are refused.                                                                                                                                   |
| Typing and online presence      | PASS    | Private Realtime channels are membership-scoped; a nonmember was denied and an authorized QA member broadcast and tracked successfully. The direct-thread header shows opted-in online state.                           |
| Read receipts and unread counts | PARTIAL | Numeric conversation and navigation counts are implemented locally with a new authenticated RPC migration; they require migration application and end-to-end read-state verification. No per-message receipt UI exists. |
| Admin message moderation        | PARTIAL | Existing reporting is metadata-only; no dedicated admin message review/retention console was found.                                                                                                                     |
| Responsive/accessibility audit  | PARTIAL | Existing mobile two-pane layout and labelled controls were retained; messaging-specific mobile and assistive-technology runs were not available.                                                                        |

## Verification

- Previous verification on 2026-10-04: `tsc --noEmit`, `oxfmt --check src`, production Vite build, Node tests (48), Playwright smoke (7), authenticated route sweep, 17 anonymous authorization probes, recipient privacy probe, and private Realtime membership probe passed. These do not verify today's local changes.
- This audit turn: `pnpm typecheck`, `pnpm format:check`, `pnpm test` (48 passed), and `pnpm build` passed after the changes. The local migration extends the schema validator's required RPC, grant, and Realtime publication checks; it has not been replayed against Postgres or deployed. The production build retains the existing >500 kB main-chunk warning.

## Remaining work

## Follow-up implementation (2026-10-06)

- Added authenticated-only `conversation_unread_counts()` and aligned the total-unread RPC to count unread messages and omit archived threads. The client renders per-conversation numeric counts and the desktop/mobile navigation badges; read and participant preference changes refresh the shared count.
- Added debounced people search while starting a chat, resolving account handles/display names through the existing profile visibility policies and opening threads through the canonical `open_direct_conversation` RPC.
- Added mute duration choices (1, 8, and 24 hours) using the existing `muted_until` notification contract.
- Extended the schema assertion and probe files for the unread RPC grants and participant table Realtime publication.
- Not yet verified: apply/replay of the new migration, two-user read/unread and messaging flows, Realtime updates in another signed-in session, deployment state, mobile layout, screen-reader operation, and authenticated attachment/media behavior. Browser-based testing was not run.

Message requests, full-history and account search beyond starting-chat lookup, offline attachment retry, per-message read receipts, and admin moderation remain outstanding. The inbox itself is still limited to the first 50 conversations; message history is paged by 40.
