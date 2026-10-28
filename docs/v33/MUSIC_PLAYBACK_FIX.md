# V33 music and playback hotfix

Changed ReelCanvas to start audible tracks directly inside the Play gesture, mount audio elements with explicit cleanup, avoid overlapping pending play promises, and expose playback errors. Shared Story soundtrack transport now uses loaded media duration when catalog duration is unavailable and shows load failures. Added an excerpt-bounded native Post music preview.

Music photo posts now render all composed images into one continuous MP4 with one uninterrupted selected soundtrack; slide durations divide the excerpt. Existing posts are not rewritten. Post video, Reel viewer and Story viewer default to unmuted. Existing video-surface tap-to-pause/resume remains active. Story autoplay restrictions expose a direct user-gesture resume button. Horizontal Story swipes move between creators, while taps continue within each creator's stories.

Verification: full suite 317 cases, 316 passed, one existing skip; formatting, TypeScript, inventory check, production audit and production build passed. Subsequent Story blocked-audio feedback passed TypeScript and production build. Existing large-chunk warnings remain.

Actual browser test imported a real 3-second MP4 and 8-second WAV into the actual Reel component, added both to the timeline and pressed Play. The audio element was paused=false, muted=false, currentTime=0.109883. At the visual endpoint it was paused=true, muted=false, currentTime=3; Replay was available. Screenshot: music-playback-fix.jpg. This verifies browser media playback state, not acoustic output measured on physical hardware.

No production account content was published during this hotfix test. A fresh catalog-backed Story/Post publication, multi-slide MP4 inspection and physical Android/Safari audio remain unverified. Browsers can still require a tap for audible playback. No schema, backend permissions or dependencies changed.

Rollback frontend: saved version appgprj_6ad9f8a7371481918bde729c8934a24d~appgver_c7b29596f1d0819193f20a4f7323bac0 (source 4f4ee4eceb6fc53a30c04baefefbe4cc95ceac16). Backend configuration is unaffected.
