# VELORI Child Mode

Child Mode is an optional text-language filter for a conversation. It encourages kinder language and uses your personal account preference. It is not a parental lock, age check, guardian-control system or a guarantee that a conversation is safe.

## Enable and disable

Open Messages, select a conversation, click the name at the top, then Settings. Turn on the highlighted Child Mode switch. It applies to the current client immediately and synchronizes to your account. Other devices refresh settings when opening a conversation, returning to the window or reconnecting. Other participants keep their own setting. Anyone using your account can turn it off.

If blocked language is detected while typing or pasting, a small notice offers Child Mode settings and Turn off Child Mode. Your draft is retained so you can edit it. Send and edit actions also check the text. Matching received message text and relevant previews are hidden in the client.

## Filter behavior

The filter covers the requested Hindi/Hinglish words (including lund, chut, madherchod/madarchod, chod, bhosdike, behenchod/bhenchod and randi), several common English variants, Unicode normalization, common character substitutions, and simple punctuation/spacing disguises. Whole-word matching avoids innocent words such as London and chutney. A dictionary cannot recognize every disguise, meaning or context.

Images, videos, voice, outside links and text embedded in media are not inspected. This is client-side filtering; it does not stop another client from sending a message or enforce a server moderation policy. Blocking, reporting and account privacy controls remain available separately.

## Synchronization and offline use

Themes, nicknames, Child Mode and hidden-message references synchronize privately to your account. Settings display the actual sync status and a Retry sync action. A cached copy and pending queue work offline; changes retry when connected or when returning to the window. A failed or unavailable service is explicitly shown; a local save is not presented as a cloud acknowledgment.

## Delete choices and reporting

Delete for me hides the message for your account; other devices update on sync. Other participants retain their copies. Delete for everyone soft-deletes your own message through the existing permission checks. Recipients may already have seen or saved a copy. Full motion shows the velori disappearance after a successful local hide or acknowledged server deletion. Gentle/Off avoid this decoration.

Private-message reports require a readable message from another participant and go to the existing moderation system. Duplicate reports are idempotent and submissions are rate-limited. Report errors are displayed without claiming submission succeeded.

## Backend verification

Migration 20261024062302_chat_preferences_and_private_reporting.sql was applied on 24 October 2026. Live transactional tests verified participant preference persistence, private hides, report idempotence, invalid-category rejection and outsider/cross-account/anonymous denials. All fixtures were rolled back. Catalog assertions and three anonymous Data API probes passed. Physical multi-device UI delivery remains a separate acceptance check.
