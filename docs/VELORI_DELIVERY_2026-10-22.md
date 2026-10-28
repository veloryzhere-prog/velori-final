## 2026-10-22 hosted VELORI delivery

Prepared a separate source checkout for a private hosted build using the current existing Supabase project. Original checkout was read-only throughout this work.

- New editorial visitor experience: ivory, black typography, subtle gold, responsive composition, local photographs, continuous CSS motion, and reduced-motion support.
- New shared mention autocomplete: debounced account search, keyboard selection, pointer selection, suffix preservation, cancellation, and safe controlled-input updates. Verified in a real post caption. This is a text-field picker; contenteditable text engines and full story mention-back/resharing are not completed by this change.
- Post Studio now has public/followers/only-me audience and interaction controls, real account identity in preview, a 10-slide limit, and explicit server publication confirmation. Fixed fresh-draft INSERT rather than UPSERT under collaboration RLS. Media rows are also attached to drafts for authorized restore and cleanup.
- Story video export waits for a drawable frame, sets cross-origin media handling before loading, and correctly stretches fill-mode media to canvas dimensions.
- Existing routes, backend integrations, RLS, admin console, and media pipelines retained. No database schema or policy changes made.
- New hosted origin added to backend CORS and auth redirect configuration. Admin access additionally requires the active ALLOWED_ORIGINS setting; both hosted and loopback origins confirmed.

### Verification

- Existing Node suite: 198 passed, zero failed.
- TypeScript and production build passed.
- Live backend verification script passed with the protected read-only verification configuration.
- 87 browser visits: 27 authenticated/public routes at 1440, 390, and 320 pixels; landing at 320, 375, 430, 768, 1024, and 1440 pixels. No uncaught page errors or document horizontal overflow. This is route/layout coverage, not exhaustive interaction coverage.
- Existing QA user signed in. An image story was published privately, reopened, and its 1080x1920 media decoded successfully.
- A private post rendered at 1080x1080, published successfully, and was unreadable to a second authenticated QA user.
- A real generated MP4 was imported, placed on the reel timeline, rendered/published privately, and played in the reel viewer at 1080x1920.
- Administrator sign-in and six admin routes loaded without alert errors.
- Created QA post/reel data and media were removed; story removal used the existing deletion queue.
- Exact-value scan found no privileged credential values in publishable text source.

### Verification limits and remaining work

Do not describe this as every historical requirement being production-verified. Full story mention-back/resharing is not implemented here; cross-type mention notifications, interactive story sticker responses, cross-device realtime message delivery/read receipts, comprehensive account privacy permutations, third-party email deliverability, all admin save/publish workflows, browser camera/microphone permissions, and Play Store packaging need further implementation or dedicated end-to-end verification. Public launch and custom-domain reassignment have not been requested or performed. The hosted edition remains private.

### Illustration assets

Local landing images downloaded from Unsplash image identifiers photo-1464822759023-fed622ff2c3b, photo-1518837695005-2083093ee35b, and photo-1529156069898-49953e39b3ac. Product illustrations are explicitly illustrative, with no fabricated user or engagement statistics.
