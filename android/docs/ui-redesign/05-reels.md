# 05 — Reels

Status: IMPLEMENTED — NOT VERIFIED. The VELORI app remains the main site; the reel editor is available separately through the reels creation route. See `docs/VELORI_PROGRESS.md`.

## Routes and implementation

- `src/main.tsx` mounts the existing VELORI application shell and router through `src/App.tsx`.
- `/reels/create` mounts the separate device-format → Twick editor → publish flow in `ReelStudioPage`; the normal VELORI site, navigation, and reels viewer remain available outside the studio route.
- `src/pages/ReelStudio/DeviceSelect.tsx`, `Editor.tsx`, and `Publish.tsx` implement the studio screens. The publish confirmation is local UI only; it does not upload or persist a reel.

## Recent implementation record

The supplied Publish implementation is a UI-only mock: its button switches local component state to “Published!” and does not upload media or call Supabase. It is only shown in the reel creation section and does not replace the main site.

## Verification and remaining acceptance

- `pnpm run typecheck`: PASS after adjusting imports and API use to the installed Twick 0.15.31 declarations.
- `pnpm test`: PASS (130 passed, 0 failed).
- `pnpm run build`: PASS; Vite reports CSS `@import` ordering warnings from the required Twick stylesheet and existing global CSS, plus the Node deprecation warning.
- Focused `oxfmt --check` on changed TypeScript files: PASS.
- At 390 × 844, the device popup opened, the Mobile choice loaded the Twick editor, adding text inserted a timeline element, Export opened Publish, and the local Publish button showed its confirmation state. The page had no horizontal body overflow. The configured default port 8443 was occupied, so the dev app ran at `http://127.0.0.1:5173`.
- Authenticated access to `/reels/create` was unavailable in the browser used for this correction; signed-out users remain in the VELORI shell and are prompted to sign in.
- Remaining limitation: this is a local editor demonstration; it does not persist/export edited media or actually publish a reel.

## Current Reel Studio Flow

The `/reels/create` section presents a glass device-format selector, a Twick editor with an empty canvas until local media is added from its toolbar, and a caption screen with a local-only success state. Templates are gradient placeholders; selected templates currently change only the active-card styling. The root route continues to show the VELORI site.


## Current implementation and 2026-10-23 reliability correction

The earlier Twick/local-success inventory above is historical. The active /reels/create route now mounts src/components/reel-editor/ReelStudio.tsx through CreatorStudioPage, with the existing real publish pipeline in src/lib/reel-editor/publish.ts. It uses the shared frame renderer and browser MP4 capture. The mobile product navigation previously covered the fixed editor; studio-completion.css now removes that collision and puts primary actions in a compact phone grid. Full-HD export now prefers browser-selected MP4 rather than a forced H.264 Level 3 profile, requests explicit still-image canvas frames, schedules added audio, bounds media loading and cleans up the recorder. A real five-second still-image reel exported as a non-empty MP4. Actual server publication and cross-device encoding acceptance remain unverified.
