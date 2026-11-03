# VELORI Android application audit

## Project and architecture

- The repository is the existing VELORI React 19, TypeScript, Vite, and Supabase application. Capacitor 8 packages this same application for Android; this is a hybrid application, not a separate native Compose rewrite.
- The Android application ID is `veloryz.online.velori`, matching the downloadable VELORI APK. Kotlin uses the same namespace.
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
| React/Capacitor application | Existing production web build and Android-only Capacitor asset sync | Release build verified; current device install not available |
| Navigation and back handling | Existing React routes, mobile shell, and back-handler | Emulator smoke test only; route-specific back-stack acceptance not rerun |
| Photo/video selection | Capacitor Camera plugin and shared Android media picker | Plugin compiles; physical photo/video selection and upload are unverified |
| Notification bridge | Custom plugin and OneSignal SDK bridge | Plugin compiles; push delivery is not verified |
| Authentication | Existing Supabase auth routes/client | Not tested with a real or authorized test account |
| Social modules and FORGE | Existing React application and Supabase integrations | Not comprehensively runtime-tested in Android |
| Deep links and secure session storage | No complete verified native implementation established | Not release-verified |

## Release identity and limitations

- Application ID: `veloryz.online.velori`; app name: `VELORI`.
- The new release preserves the downloaded APK's package and signing certificate. The local `online.veloryz.velori` and prior `online.veloryz.chat` test packages are different applications.
- Firebase configuration now matches this application ID. FCM/OneSignal delivery still requires end-to-end verification with the configured service credentials.
- The distributed APK is signed with the Android debug certificate. The local update uses the existing debug keystore only because its certificate matches the downloaded APK; this is not a Play Store signing identity. Obtain the original Play signing configuration before store distribution.
- Emulator testing is not physical-device acceptance. Do not claim physical camera, gallery, uploads, push, production auth, or store readiness without the corresponding tests.
