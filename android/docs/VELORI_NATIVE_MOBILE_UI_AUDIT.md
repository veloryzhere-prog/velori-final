# VELORI Android native/mobile UI audit

Date: 2026-11-02

## Scope and evidence

Inspected the Android manifest/activity/theme, Capacitor plugin registration, React router and authenticated product shell, native media/notification bridges, mobile CSS, route specifications, and the installed release build on the Android 17 emulator (1080 × 2400 at 420 dpi). Captured and visually inspected the signed-out landing screen before changing the implementation.

## Actual rendering and architecture

- Every VELORI screen and route in this Android build is rendered by the existing React application in one Capacitor WebView. Routing and screen transitions use React Router; there is no second Kotlin/Compose screen stack.
- Native Android APIs currently back Camera/Photo Picker through `@capacitor/camera`, Android system notification permission/settings and OneSignal events through `VeloriNotifications`, the Android app lifecycle/back event through `@capacitor/app`, and the Android file chooser. Authentication, feed, stories, reels, posts, profile, search, messages, settings, FORGE, and admin screens are React UI with the existing Supabase services.
- The signed-out Android landing was the full visitor marketing page. The emulator screenshot showed the website-style public header (brand, hamburger, FORGE shortcut, login and join actions), a large three-line desktop hero, extensive blank space, and the large marketing illustration. No signed-in account was available to verify the authenticated feed on this emulator.
- The authenticated shell already had responsive CSS and a fixed mobile dock. Its configured mobile destinations were Home, Explore, Messages, More, with Create in the center; Reels and Profile were not persistent dock destinations. This is a shared responsive product shell, not a separately composed Android screen architecture. Many feature screens are React screens with mobile rules, but exhaustive route-by-route emulator acceptance has not been performed.
- Existing navigation is entirely React Router/browser history inside the WebView, with a Capacitor back-button listener. There was no verified native Android route stack or `appUrlOpen` route bridge for auth/deep links.

## Native APIs, touch, system UI and loading

- Camera and native gallery selection are implemented through the Capacitor Camera plugin; the existing shared input bridge returns media as browser `File` objects to existing upload handlers. Physical-device permission/capture, large-video memory behavior, and real Supabase uploads are not verified.
- OneSignal's Kotlin bridge exposes permission, subscription/account linking, and notification-tap route persistence. Push delivery is not available for the current Android app unless Firebase has a matching client and is tested.
- No Android Keystore-backed Supabase auth storage adapter was found. Supabase session persistence uses the existing browser client storage. No native share or haptic bridge was found.
- No explicit StatusBar/Keyboard plugin or application-level integration was found. The manifest has no verified Android App Links intent filter. The default Capacitor WebView and responsive CSS handle most screen rendering; the screenshot showed visible Android status/navigation bars, but does not establish edge-to-edge, IME resize, cutout, or gesture-inset correctness.
- Existing route loading/errors are React/Router states. The shell reports route loading with a thin web progress indicator; there is no separate native splash-to-route state machine.
- The emulator had an Android System UI “not responding” dialog during the prior release cold start. After dismissing it, the app landing rendered. This was an emulator/System UI symptom and is recorded, not attributed to the app without evidence.

## Corrective implementation scope

1. Keep the existing React and Supabase feature implementation; do not make unsupported claims that all screens are native or feature-tested.
2. Replace the Android signed-out marketing landing with a compact Android-specific entry that preserves existing login/signup destinations and requested return paths.
3. Give the authenticated Android shell a stable five-destination dock—Home, Explore, Create, Reels, Profile—and retain Messages, Notifications, Settings, FORGE, and other features in the existing navigation/menu.
4. Add Android-specific screen-safe-area, touch-target, header/dock, keyboard and immersive-route styling without changing the website/tablet/desktop shell.
5. Add small native Android interaction bridges where they add actual platform behavior (haptics, system share, app-link routing); do not emulate OS functions with visual-only controls.
6. Re-test the actual emulator landing/auth shell, navigation, touch, keyboard and back behavior; record missing authenticated/device coverage instead of marking it passed.

## Explicitly not verified

No physical Android device was available. No authenticated account was used. Stories, feed writes, post publishing, camera/gallery capture, uploads, realtime messaging, FORGE, admin permissions, push delivery, deep-link auth, secure storage, and per-route loading/error states have not all received device-level acceptance. A UI implementation or successful build is not evidence that these end-to-end flows work.

## Implementation update

The Android-specific correction now adds a compact VELORI entry screen and authentication form sizing, safe-area-aware system bars and keyboard resizing, a fixed Home/Explore/Create/Reels/Profile dock (respecting the existing Reels feature flag), Android haptic feedback, the system share sheet for profile links, and allowlisted custom-scheme route/auth callbacks. React Router and the existing React/Supabase feature screens remain the app UI; no native Compose screens were introduced.

The Supabase session still uses the existing browser storage adapter; Android Keystore-backed session storage is not implemented. HTTPS App Links domain association is not configured, so verified `chat.veloryz.online` links require hosting a matching `assetlinks.json`. Supabase must also allow the two custom redirect URIs `online.veloryz.velori://auth/confirm` and `online.veloryz.velori://auth/reset-password` before email auth callbacks can work in a deployed build.

Emulator test results and screenshots are recorded in `VELORI_ANDROID_TEST_REPORT.md`. Authenticated social screens, privileged workflows, physical-device behavior, production media uploads, push, and the external link-configuration steps remain unverified; this audit is not production-release approval.
