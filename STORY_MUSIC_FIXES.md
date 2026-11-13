# VELORI V33.1.4 — Story and Music fixes

This source update is based on the uploaded VELORI V33.1.4 archive.

## Admin Music Library

- Selecting an audio file now scans common embedded tags in MP3 (ID3v2/ID3v1), WAV INFO, Ogg Vorbis and MP4/M4A files.
- Available title, artist, album, genre, mood, language, date/year, BPM, track number, composer, comment and embedded cover art are imported where present.
- Imported values are suggestions, not locked fields. The admin can edit every visible field and replace embedded cover art before saving.
- If a file has no embedded metadata, the filename is suggested as the title and the rest can be entered manually.
- Audio remains a manual admin upload. No external song extraction or third-party metadata lookup was added.
- Existing licensing checks, upload permissions, admin API, and catalog schema are unchanged.

## Story Studio

- Selecting a catalogue track derives the active slide's duration from its selected excerpt, clamped to the existing 1–20 second per-slide limit.
- Slide duration can be adjusted from 1 to 20 seconds in 0.1-second steps.
- Video preview trim now uses the same 20-second limit and loops the selected clip while the slide/music clock continues.
- Story soundtrack playback synchronizes to the preview clock and can request a refreshed signed audio URL if the current one expires.
- Published video playback first tries audio; if the browser blocks audible autoplay, it falls back to muted autoplay and exposes a working unmute control.
- After all slides in a private sequence publish successfully, the local draft ID, saved project snapshot and temporary draft media references are cleared. Shared and client-preview projects are retained.
- Story preview sizing, side-panel widths and soundtrack-control placement were adjusted for fewer overlaps and clipped controls.

## Verification and release status

- TypeScript: `pnpm typecheck` equivalent passed using the installed TypeScript 5.9.3 binary.
- Focused audio metadata/story timing/music tests: 9 passed.
- Broad suite: 392 passed, 1 skipped when excluding four files that could not be verified in this extracted environment (two require Rolldown's missing Linux native binding; two contain existing unrelated test failures).
- Production build: not verified here. The uploaded archive's extracted `node_modules` contains Windows Rolldown binaries but no Linux `@rolldown/binding-linux-x64-gnu`. On Windows, reinstall exactly from `pnpm-lock.yaml` before building.
- Browser playback, mobile visual acceptance, and publish/reopen acceptance still need manual verification in the target environment.
- No database migrations/schema changes, dependency version changes, GitHub push, or deployment were made.

## Safe setup

1. Keep a backup of the current working folder.
2. Extract this source ZIP and replace/update the matching source files in the VELORI V33.1.4 project.
3. On Windows, run `pnpm install --frozen-lockfile` from the project directory to rebuild platform-appropriate dependencies.
4. Run `pnpm typecheck`, `pnpm test`, and `pnpm build` before committing or deploying.
5. Test audio in Story Studio, publish a test story, close/reopen Story Studio, and confirm the editor starts as a fresh draft.

The archive deliberately excludes `.env`, `.env.local`, `node_modules`, `.git`, build caches and generated `dist` output.
