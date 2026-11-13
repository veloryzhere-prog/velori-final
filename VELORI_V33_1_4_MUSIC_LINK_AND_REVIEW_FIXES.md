# VELORI V33.1.4 — Music link import and admin review fixes

This source snapshot extends `VELORI_V33_1_4_STORY_MUSIC_FIXES.zip`.

## Admin Music Library: import details from a link

In **Admin → Creator Control Center / Studio Catalog → Music → Add music**:

1. Paste a direct track link.
2. Select **Import details**.
3. Review and edit the fields that were returned.
4. Upload the audio file that VELORI is authorized to store and use.
5. Optionally select imported artwork where the source makes it available and its use is authorized, or upload your own cover.
6. Set licensing / permitted-use information before publishing.

Supported link formats:

- YouTube Music / YouTube single-video links.
- Spotify single-track links.
- SoundCloud track links.
- Apple Music single-song links (including song IDs on album URLs).

Metadata availability varies by provider:

- YouTube's public oEmbed endpoint supplies a title, channel/uploader name and thumbnail. The channel name is not guaranteed to be the recording artist; the admin is warned to verify it.
- Spotify's public oEmbed endpoint supplies the item title and thumbnail, but not the artist name or complete album metadata. The artist field must be entered or verified manually.
- SoundCloud oEmbed supplies a title and commonly includes the uploader/artist in the title or author field.
- Apple Music's public lookup supplies track title, artist, album, genre and duration. Its promotional artwork is not copied into VELORI by this import flow.

**This is metadata import, not audio extraction.** It does not download, rip, proxy or stream audio from YouTube Music, Spotify, SoundCloud or Apple Music. The admin must upload an audio file that VELORI is authorized to use. The imported provider link is saved in the editable description for reference. The actual uploaded file's probed duration remains authoritative for the VELORI music asset.

The backend accepts HTTPS links only, allowlists provider hosts, calls fixed provider metadata endpoints, rejects redirects, limits request time, and returns only selected metadata fields (never provider iframe HTML or audio/download URLs).

## Admin review moderation

Changes in this snapshot:

- Successful review approval / rejection / hiding / response updates are returned as successful even if the subsequent audit-log write fails. The admin receives a warning and a trace reference instead of a misleading “approval failed” response after the row has already changed.
- Review deletion has the same post-commit audit-warning behavior.
- Administrator reauthentication now verifies that the current unrevoked session's `reauthenticated_at` value was actually written before allowing the guarded action retry.
- Permission-denial audit failures no longer turn an otherwise correct 403 permission response into a generic server error. Access remains denied.
- Review list and moderation endpoints return a specific `reviews_migration_missing` response when the app-review table or summary function is absent/outdated.
- The Reviews screen explains when the signed-in administrator role lacks `reviews.moderate`. The server-side permission check remains enforced; no permission bypass was added.

The migrations already present in the source are:

- `supabase/migrations/20261108000000_velori_app_reviews.sql`
- `supabase/migrations/20261109000000_review_lifetime_status.sql`

No new database migration or schema change was added in this update. Confirm these existing migrations are applied to the correct Supabase project before testing moderation. Do not reset the database to apply them.

## Verification performed in this workspace

- Music-link metadata tests: pass.
- Story timing tests: pass.
- Review-policy tests: pass.
- TypeScript / TSX syntax transpilation for modified files: pass.
- Full application typecheck and production build: not run here because the uploaded archive did not include installed dependencies and the package manager could not be bootstrapped in this environment.
- Live Supabase/provider and browser testing: not performed. The Edge Function and front-end still need to be deployed to test against the live project.

## Deployment checklist

1. Back up the existing local project folder and keep its `.env`, `.env.local`, `.git`, and project-specific configuration.
2. Install from the checked-in lockfile with `pnpm install --frozen-lockfile`.
3. Run `pnpm typecheck`, `pnpm test`, and `pnpm build` in the local environment.
4. Deploy the updated Supabase Edge Function named `server` and deploy the updated front-end build.
5. Confirm the two existing app-review migrations are recorded as applied in the intended Supabase project. Apply only reviewed pending migrations; never use a database reset for this update.
6. Test an admin music import for each supported provider and test review moderation with an account that legitimately has `reviews.moderate`.
