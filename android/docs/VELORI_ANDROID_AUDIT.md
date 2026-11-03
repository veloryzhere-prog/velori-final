# VELORI Android application audit

## Project and architecture

- The repository is the existing VELORI React 19, TypeScript, Vite, and Supabase application. Capacitor 8 packages this same application for Android; this is a hybrid application, not a separate native Compose rewrite.
- The Android application ID for the new app is `online.veloryz.velori`. Kotlin source remains under namespace `veloryz.online.velori`; Android allows the namespace and application ID to differ.
- Android web assets are built from the existing app and staged by `pnpm run android:sync`, which excludes downloadable `.apk` and `.aab` files from the native bundle without changing the website build.
- Existing application routes and services provide authentication, feed/posts, stories, reels, profiles, search, messages/groups, notifications, settings, FORGE, and admin surfaces. The mobile app reuses these real routes and Supabase services rather than duplicating backend data or schemas.
- Native modules detected: Capacitor App, Camera, and the custom VeloriNotifications plugin. The shared media-picker bridge invokes Android Camera/Photo Picker flows for supported image and video controls.
- Existing Android back-button handling is in the React app shell. Its operation has not been revalidated on a physical Android device as part of this release build.

## Backend and security boundaries

- The application uses the repository's existing Supabase client, authentication, Storage, Realtime, and RLS-backed data access. No database schema, production records, or Supabase deployment were changed for this Android release.
- The local Supabase project reference is `mvvjyxfojxyuwsykfujf`; it was not remotely contacted. Confirm that this is the intended production backend before release distribution.
- Existing session persistence is managed by the Supabase client in the web application. A dedicated Android Keystore-backed session-storage adapter is not implemented or verified.
- No authenticated production account was used, so authentication restoration, social writes, media uploads, realtime messaging, FORGE requests, and administrator restrictions were not independently acceptance-tested in this task.

## Native feature status

| Area | Implementation evidence | Release verification |
|---|---|---|
| React/Capacitor application | Existing production web build and Android-only Capacitor asset sync | Android build and emulator launch verified |
| Navigation and back handling | Existing React routes, mobile shell, and back-handler | Emulator smoke test only; route-specific back-stack acceptance not rerun |
| Photo/video selection | Capacitor Camera plugin and shared Android media picker | Plugin compiles; physical photo/video selection and upload are unverified |
| Notification bridge | Custom plugin and OneSignal SDK bridge | Plugin compiles; push is blocked because Firebase has no client for the new application ID |
| Authentication | Existing Supabase auth routes/client | Not tested with a real or authorized test account |
| Social modules and FORGE | Existing React application and Supabase integrations | Not comprehensively runtime-tested in Android |
| Deep links and secure session storage | No complete verified native implementation established | Not release-verified |

## Release identity and limitations

- New application ID: `online.veloryz.velori`; app name: `VELORI`.
- This is a new application identity. The previous downloadable APK uses `veloryz.online.velori`, and the recent test build used `online.veloryz.chat`. Neither is upgrade-compatible with this new ID.
- The checked-in Firebase configuration has a client for `veloryz.online.velori`, not `online.veloryz.velori`. Firebase is not configured for the new application; the build warns and omits the Google Services plugin. Do not claim Android push delivery works until a matching Firebase app and OneSignal configuration are added and tested.
- A new release keystore is generated only for this explicitly requested new application. Keep the key and its local signing properties outside Git, maintain separate secure backups, and never regenerate this identity for updates.
- Emulator testing is not physical-device acceptance. Do not claim physical camera, gallery, uploads, push, production auth, or store readiness without the corresponding tests.
