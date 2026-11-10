# VELORI 33.1 — Source Integration Report

**Release label:** `33.1-integration-patch`  
**Source baseline verified:** the user's `VELORI_V31_COMPLETE_REDESIGN_SOURCE.zip`, dated 2026-10-25.  
**Target:** merge these edits into the independently maintained, live V33 workspace.  
**Status:** source patch built and unit-tested; **NOT** merged into actual V33, **NOT** deployed to the live site, and the new database migration was **NOT** applied.

## Executive summary

VELORI uses React, Vite, Supabase Auth, PostgreSQL/RLS, Edge Functions, and its own FORGE generation backend. These changes extend that codebase instead of swapping the site for an unrelated template. The live V33 source was not available through the attached files or connected GitHub (which returned no repositories); therefore these are **merge-ready changes based on V31**, not proof of compatibility with unseen changes in V33.

## Implemented changes in the included files

### Stories: person-based navigation

- The story player now derives a separate progress-rail sequence for the active author.
- Horizontal touch gestures and desktop arrow keys navigate between **different authors**; they no longer move through one giant cross-user progress sequence.
- Taps and automatic playback move through the current author's moments and then advance to the next author.
- The story tray supplies contiguous per-author groups when launching playback.
- Test cases cover per-author segments, moment progression, cross-author swipes, and last-author exit.

### Music: post / reel / story

- **Posts:** a music catalog picker selects only server-published, licensed tracks available to posts, with an excerpt. On post publish, the soundtrack is attached by `track_id` to the new `post_soundtracks` relation. On the feed, a user-controlled audio player fetches the current signed catalog URL and plays the excerpt. Absent migration, a plain post remains readable and a post with selected music fails with an actionable message, preserving the draft.
- **Stories:** existing audio export attempts to retrieve a licensed source through an HTTPS media loader and a local Blob URL for reliable Web Audio decoding, and releases the Blob URL when finished; the picker retains selected excerpt timing across URL refreshes.
- **Reels:** soundtrack decoding/playing failures are now surfaced instead of silently publishing a reel with missing selected audio.
- **Not implemented:** externally hosted commercial music licensing, background autoplay, audio muxing directly into photo pixels, guaranteed browser codec support, replacing expired signed URLs during indefinitely open post playback, or audio-mixing QA on real mobile hardware.

### FORGE AI interaction

- Generation requests, progress notices, errors, quota / provider-capacity messages, revision approvals, suggestions, and saved conversation turns appear in the chat area.
- Messages accurately describe what the current single-request backend can observe; **no simulated file-level tool calls** are represented as real activity.
- Connection and usage state re-checks when sign-in changes, avoiding stale sign-in state.
- Source ZIP download includes runnable static `index.html`, per-page HTML/CSS/JS layers, project JSON, and README.
- The existing shareable preview and license-aware attribution are preserved; source ZIP is an editable export, not executable Node/React/Next.js project scaffolding.
- No invented increase in user/provider quotas. Server-verified plan checks still control attribution in hosted previews and exports. Browser-distributed files cannot be rendered tamper-proof.

## Not implemented — do NOT market these as done

1. **Real V33 merge or live release:** No live V33 repository/workspace is accessible through these connectors; do not replace V33 with the included older tree.
2. **Complete full-stack AI build engine:** Not integrated. The current server accepts Gemini text and returns up to eight static HTML/CSS/JS pages. A real multi-file tool-using agent would need an isolated execution runtime, secure file system, package manager, build/test loops, persistent run/event log, SSH/network restrictions, billing limits, signed user approvals, and additional service deployment. A UI cannot make these backend capabilities appear automatically.
3. **Production-grade progress stream:** Backend does not currently expose event-stream tool steps or independent file actions. Frontend displays honest request milestones only.
4. **Server-enforced rights transfer:** No automatic copyright acquisition of user-generated code. VELORI's brand/code may be owned by its lawful rightsholders, while user inputs, third-party libraries and generated output each follow their own rights/licenses. Free-tier brand attribution is not copyright transfer. Premium removal must be authorized by current signed-in entitlements; no client-side entitlement trust.
5. **Strict unremovable watermark in downloaded source:** This is technically unenforceable for editable files. Hosted previews can enforce a brand overlay server-side; downloaded outputs can be altered.
6. **Paid subscription enablement:** Existing plans and payment infrastructure require provider, price, webhooks, compliance and policy verification. Premium labels alone do not confer billing authorization.
7. **Production browser/visual QA:** Browser and package dependencies weren't available in this environment. Do not claim pixel-perfect phone validation.
8. **Post soundtrack migration on live database:** Migration is staged in this archive only.

## Source merge order against actual V33

1. Obtain the live **V33 source**, current package lockfile and complete migrations. Make a commit/backup before editing; inventory V33 changes to story, post, reel and FORGE components.
2. Review every changed path in `VELORI_V33_1_MERGE_PATCH.zip`. Merge specific hunks into current V33 components, **never blindly overwrite V33 files with V31 snapshots**. Preserve newer imports/routes/type contracts.
3. Audit `supabase/migrations/20261105000000_velori_post_music_v331.sql` against **current** `posts`, `post_media`, `studio_music_tracks`, visibility, permissions, and RLS in the live database. Address schema drift and test private/follower-only posts using authenticated and anonymous roles; **then** apply migration to staging first. Do not apply this file to production without tests.
4. Install dependencies using the project's pinned lockfile, then run: `npm run typecheck`, `npm test`, `npm run build`; conduct browser QA at narrow phone and desktop widths.
5. On a staging deployment: verify story swipes per author, reel+story soundtrack export/signed URLs, post music attach/play/visibility, FORGE login refresh, quota/error messages in chat, project ZIP download, shareable preview, and Premium attribution.
6. Confirm media rights/licenses in the music catalog, no service keys in client bundle, private content access denied through direct queries, protection from repeated retries/double billing, and reasonable quotas.
7. Promote V33.1 from a verified revision to production with rollback and DB backup plans; don't change production secrets just to apply this patch.

## Future FORGE full-stack builder architecture (design only)

- **Coordinator service:** authenticated API accepts user prompt, approved scope, model tier and project revision, provides idempotent request ID and durable run records.
- **Scoped workspace runner:** isolated sandbox/container per user project; restricted network and credentials; CPU/time/disk caps; working terminal, file reads/writes and package manager in sandbox only, not Supabase Edge Functions.
- **Tool protocol:** `plan`, `read_files`, `write_files`, `run_command`, `inspect_errors`, `request_approval`, `publish_preview`, `export_source`; all events persist and stream into FORGE chat via authenticated server-sent events or similar.
- **Model router:** Gemini model selection plus fallback policies; per-tenant provider quotas, retry with backoff only when safe, real provider 429 handling, request cancellation and audit logs.
- **Safe preview:** temporary isolated preview deployments with unguessable IDs, short-lived signed shares, access controls, abuse protections and cleanup; distinguish free-attributed and entitled Premium previews.
- **User control:** user can see a diff, approve high-impact operations and secrets access, roll back revisions, download source, and delete projects; default-deny external deployments and protected writes.
- **Licensing:** If implementing source code from bolt.diy, preserve required MIT notices. WebContainer API commercial/prod usage requires separate license from its owner; no such third-party runtime was copied into this patch. User-visible branding can stay VELORI, but attribution/license obligations still apply behind the scenes.

## Test evidence

From the verified V31-derived working copy using Node 22 with `NODE_OPTIONS=--experimental-strip-types`:

- 272 unit tests **passed**, 1 **skipped**, 0 **failed** when running available-suite test files excluding `scripts/env.test.mjs`.
- The excluded `scripts/env.test.mjs` depends on `vite`, which is not installed in this working environment; the **full** default suite therefore cannot pass here.
- All modified TS/TSX files were syntax-parsed with TypeScript with no parse diagnostics, **not equivalent to a full typecheck**.
- No live browser or production test was conducted; npm dependencies absent.

## Deployment outcome

**Files only.** Live website, Supabase tables, Edge Functions, authentication, API keys and other secrets were not modified. This release must not be labeled deployed or complete V33.1 until merged against the true V33 source and tested.
