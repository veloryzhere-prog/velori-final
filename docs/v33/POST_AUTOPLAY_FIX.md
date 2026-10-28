# Post autoplay and active Reel sound correction

Removed the post playback toolbar (seek, mute, fullscreen and transport row) from PostMediaGallery. A single visibility coordinator chooses the visible post nearest the viewport center, pauses every other post and pauses all videos when the document is hidden. Videos loop, request unmuted playback, support tap/Space/Enter pause/resume and retain deliberate pauses. Controls remain absent; a central retry/play prompt appears only when necessary. Browser autoplay rejection does not silently switch to muted playback; the next real gesture retries sound.

The actual active Reel viewer uses features/reels/hooks/useReelVideo.ts, which still initialized isMuted=true despite the prior legacy-viewer fix. Corrected it to false and added gesture-based retries that respect active visibility and deliberate pauses.

Files: src/components/social/PostMediaGallery.tsx; src/components/social/post-video.css; src/features/reels/hooks/useReelVideo.ts; src/dev/v32-components.tsx (development-only playback harness). No backend, data or permission changes.

Full verify passed: 317 cases, 316 passed, one existing skip, zero failures; formatting, TypeScript, production dependency audit, inventory check and production build passed. Build took 1.53 seconds with existing large-chunk warnings.

Actual browser component acceptance used a locally generated MP4 containing real AAC audio: first post automatically paused=false, muted=false, currentTime=0.012757; second offscreen post paused=true, muted=false. Toolbar count was zero and native controls=false. Tapping the first video paused it at 1.988822 seconds. After scrolling, its time remained 1.988822 with paused=true, while the second post was paused=false and visible from y=6.39 to755.19 in a936px viewport. Screenshot: post-autoplay-fixed.jpg. These are real media-state observations; no physical-phone or acoustic-output claim is made.

A fresh authenticated production browser playback test remains unverified because this browser session is signed out. Browser policies can require an initial gesture for sound. No impossible guarantee of audible autoplay before any gesture is made.

Rollback: saved Site version appgprj_6ad9f8a7371481918bde729c8934a24d~appgver_34f4fdcee9dc819198068bc33eeba801, source f8920a3d31b49d2bba894be1834cb77172358e3b.
