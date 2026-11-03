# Android, notification, and release audit

Date: 2026-11-02

## Scope and evidence

This is a source audit of the Android, notification, admin-campaign, and release paths relevant to the supplied execution brief. It is not a full audit of every social feature and is not a production-readiness sign-off. The initial findings and status report below are a snapshot from before the later implementation follow-ups; those dated follow-ups supersede any conflicting build, device, and deliverable status. The native-media integration and generated Capacitor plugin registration target the primary `android/` project only. No Supabase deployment, OneSignal dashboard access, or release signing was performed. Credential values were not inspected or copied.

The worktree already contained extensive staged, modified, and untracked changes before this task. Those unrelated changes were preserved.

## Findings and changes

1. **Android architecture** — The app is a Capacitor `BridgeActivity` hosting the React application, not a fully native Compose application. This is Path A from the supplied brief; native camera, share, deep-link, and lifecycle coverage is not established.

2. **Application ID** — The Android Gradle `applicationId` and Capacitor app IDs previously used `veloryz.online.velori`, while the supplied target is `online.veloryz.chat`. The Gradle application ID and Capacitor configurations were updated to the supplied target in both Android copies. The source `namespace` remains `veloryz.online.velori` for the existing Kotlin package.

3. **Firebase project configuration** — `google-services.json` exists in both copies, but neither contains a client matching `online.veloryz.chat`. The normal Android build stops at `:app:processDebugGoogleServices` with “No matching client found”. These files were not edited. A matching Firebase app configuration is required before building the requested package.

4. **Firebase service-account configuration** — No Firebase service-account file was found in the repository. A `google-services.json` file is not a service-account credential. The OneSignal dashboard's FCM credential state cannot be verified locally.

5. **OneSignal Android SDK** — The app already initialized the supplied public OneSignal App ID, but the dependency range ended before currently documented 5.x versions. The Gradle range now follows the official SDK setup range (`[5.9.0, 5.99.99]`); the validated build resolved SDK 5.11.0. Initialization remains in the existing `ApplicationClass`.

6. **Permission prompt and logging** — OneSignal verbose logging and a notification permission prompt launched during `Application.onCreate` were removed in both copies. No replacement in-context permission action has been implemented; permission should not be requested until that UX is connected to real native delivery.

7. **Competing Firebase handler** — The custom `FirebaseMessagingService` created a generic root-screen notification, performed an unbounded network fetch for an icon, and exposed reply/mark-read actions that had no backend behavior. Its manifest declarations and source were removed from both Android copies so it cannot compete with OneSignal's notification handling.

8. **Native media picker** — The existing Capacitor Camera dependency was not registered in the generated Android project (`capacitor.plugins.json` was empty), so native plugin calls could not work. `pnpm exec cap sync android` registered the existing App and Camera plugins. A shared file-input bridge now uses the Android photo picker/camera/video capture for supported media inputs and preserves the existing browser file chooser for documents and other mixed attachments.

9. **Identity association** — No `OneSignal.login` or logout/account-switch integration exists. The app does not contain a server-issued OneSignal identity-verification token flow. Do not associate a client-supplied profile ID with OneSignal until the server can sign and validate the required identity token.

10. **Native subscription storage** — The frontend's `push_subscriptions` writes `endpoint`, `p256dh`, and `auth` for browser Web Push. It is not an Android OneSignal subscription table. No native association table or migration was added.

11. **Existing notification backend** — The repository already has notification preferences, in-app notifications, system campaigns, receipts, and an admin-only dispatch RPC. That dispatch materializes internal recipient notifications; it does not call OneSignal. No OneSignal REST sender, native registration endpoint, or delivery-status integration was found in the server function source.

12. **Admin authorization** — The existing `requireAdmin` middleware validates the custom admin session token/cookie, session hash, expiration/revocation, and administrator state. It was not replaced or weakened.

13. **Web notification UX** — The current settings page controls browser notifications and Web Push. Its `push_subscriptions` flow is separate from Android OneSignal registration. The notification-center and settings routes were not visually or behaviorally retested in an authenticated browser during this task.

14. **Backend target mismatch** — The supplied brief names Supabase project `gmgobchwnfkwfuekhpkr`, while local `supabase/config.toml` targets `mvvjyxfojxyuwsykfujf`. No remote operation was attempted. Confirm the intended project before any migration, secret update, or deployment.

## Final report

Statuses describe this task's work, not the existence of prior code elsewhere in the repository.

1. **Original project audit — IMPLEMENTED, NOT RUNTIME VERIFIED.** The relevant Android, push, notification-campaign, admin-auth, and local Supabase-target paths were inspected. The full application-wide feature audit requested in the brief was not completed.
2. **Problems discovered — IMPLEMENTED AND TESTED.** The package-ID mismatch, mismatched Firebase clients, startup permission prompt, nonfunctional custom notification actions, absent identity flow, missing OneSignal sender, browser/native subscription mismatch, and local-vs-supplied Supabase project mismatch were confirmed from source/configuration.
3. **Android architecture changes — IMPLEMENTED, NOT RUNTIME VERIFIED.** Package/app IDs were aligned to the requested value. The app remains a Capacitor WebView shell; it is not represented as a full native app.
4. **Native Android functionality — IMPLEMENTED, NOT RUNTIME VERIFIED.** Existing App/Camera Capacitor plugins are registered and their Android modules compile. Media file inputs now have a native Android selection path. Native routing, connectivity/offline states, share, and notification-tap routing remain incomplete.
5. **Camera and gallery — IMPLEMENTED, NOT RUNTIME VERIFIED.** Supported Android photo/video file inputs use the Capacitor native picker/camera, and other attachments retain the system file chooser. Device-level URI conversion, camera permission, upload, and process-restoration behavior were not runtime-tested.
6. **OneSignal integration — IMPLEMENTED, NOT RUNTIME VERIFIED.** SDK initialization and the dependency range are present; startup prompting and verbose logging were removed. Account linking, explicit permission UX, notification click routing, and end-to-end delivery remain absent.
7. **Firebase configuration — BLOCKED BY EXTERNAL CONFIGURATION.** Neither local `google-services.json` matches the requested package. The Firebase service-account credential and OneSignal dashboard configuration are unavailable for verification.
8. **Identity verification — BLOCKED BY EXTERNAL CONFIGURATION.** A server-held OneSignal identity-verification signing key and a backend token-signing flow are not present. The required ES256 verification flow was not fabricated.
9. **Backend and Edge Functions — NOT IMPLEMENTED.** Existing functions do not send OneSignal notifications or register native subscriptions. No deployed function was changed.
10. **Database migrations — NOT IMPLEMENTED.** No schema or RLS change was made; the project instructions prohibit schema changes without authorization, and the intended Supabase project is inconsistent across the brief and local config.
11. **Admin notification system — IMPLEMENTED, NOT RUNTIME VERIFIED.** Existing campaign authorization and internal in-app dispatch remain present. OneSignal delivery, live admin workflow, and external provider response handling were not tested.
12. **Notification center — NOT IMPLEMENTED.** Existing web notification UI was not redesigned or verified as an Android-native notification center.
13. **Chat and inbox redesign — NOT IMPLEMENTED.** No chat UI or message behavior was changed in this task.
14. **Other application features — NOT IMPLEMENTED.** Feed, stories, reels, profiles, search, groups, settings, and moderation were not re-audited or changed here. The shared picker applies across compatible upload controls without replacing their existing upload handlers.
15. **UI and animation upgrades — NOT IMPLEMENTED.** No visual redesign was made or claimed verified.
16. **Security improvements — IMPLEMENTED, NOT RUNTIME VERIFIED.** Production-unsafe verbose SDK logging and the misleading custom FCM action handler were removed. Admin session authorization and database policies were left unchanged.
17. **Build results — PARTIALLY VERIFIED.** Web production build passed. The debug APK now builds under Java 21 with a warning that Firebase does not match the requested package. Release packaging remains blocked by the Firebase mismatch and missing release keystore.
18. **Runtime test results — PARTIALLY VERIFIED.** The later validation run passed `pnpm test` (378/378), `pnpm test:native-media-picker` (3/3), `pnpm typecheck`, and `pnpm build`. Debug APK installation and a public landing-page smoke test passed on an Android 17 emulator. Authenticated flows, uploads, actual picker use, push delivery, and production-backend operations were not tested.
19. **APK status — DEBUG APK BUILT AND EMULATOR-TESTED; NOT A RELEASE DELIVERABLE.** The debug APK was installed on the emulator, but is debug-signed and not suitable for production distribution.
20. **Existing APK update compatibility — BLOCKED BY PACKAGE-ID MISMATCH.** The pre-existing downloadable APK uses package `veloryz.online.velori`; the current configured application ID is `online.veloryz.chat`. Package names differ, so the current APK cannot update that older installation.
21. **Remaining external requirements — BLOCKED BY EXTERNAL CONFIGURATION.** Decide whether `online.veloryz.chat` is the permanent package despite the old download using `veloryz.online.velori`; provide matching Firebase configuration; configure the FCM credential in OneSignal; configure OneSignal identity verification and a server-only signing secret; confirm the target Supabase project; and provide a production signing key compatible with any existing production installation.
22. **Source ZIP and deliverables — NOT IMPLEMENTED.** The audit report and source changes are in the workspace, but a release APK/source ZIP was not produced. Packaging the current dirty worktree as a production deliverable would be misleading and could include user-managed configuration.

## Validation record

- `pnpm test`: passed, 368 tests after the native picker follow-up; a later run passed 378 tests.
- `pnpm test:native-media-picker`: passed, 3 focused policy tests.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; Vite reported existing large-chunk warnings.
- Android manifest XML parsing: passed for the tracked Android project.
- `git diff --check`: passed.
- `pnpm exec cap sync android`: registered the installed `@capacitor/app` and `@capacitor/camera` plugins and copied the latest production web assets.
- Android `:capacitor-camera:compileDebugJavaWithJavac :capacitor-camera:compileDebugKotlin`: passed under Java 21.
- `pnpm run android:sync`: passed; Android staging excluded `.apk`/`.aab` archives while the website build retained its downloads.
- Android `:app:assembleDebug`: passed under Java 21 after OneSignal observer fixes. The 17,252,282-byte debug APK was installed on an Android 17 emulator and the public landing page rendered.
- Android `:app:bundleRelease`: intentionally blocked by the release guard because matching Firebase configuration and a valid release keystore are absent.
- Android authenticated/device feature tests and production push: not performed.
- A final rebuild attempt in the current shell could not run because only Java 25 was available; Gradle failed during script compilation with `Unsupported class file major version 69`. This is a local JDK compatibility issue; it does not replace the earlier successful Java 21 debug-build and emulator evidence.

## External references

- [OneSignal Android SDK setup](https://documentation.onesignal.com/docs/en/android-sdk-setup)
- [OneSignal identity verification](https://documentation.onesignal.com/docs/en/identity-verification)

## OneSignal notification implementation follow-up (2026-11-02)

This follow-up supersedes the earlier "not implemented" status for OneSignal identity, campaign delivery, and backend integration; the preceding sections remain the source-audit snapshot from before this implementation.

- Added a Capacitor Android bridge for permission/subscription status, permission requests, subscription opt-in/out, verified OneSignal account login/logout, Android notification settings, and persisted notification-tap routes. The UI requests permission after sign-in, synchronizes identity using a short-lived authenticated ES256 token, and validates internal destinations before navigation.
- Added authenticated chat push and administrator campaign push through the existing server function. Campaign delivery reuses the existing in-app dispatch and preference model, persists an idempotency key and provider status, and now exposes paginated, searchable, push-status-filtered history. Chat push verifies persisted message ownership and excludes the sender, muted recipients, and recipients without enabled preferences. Push errors do not undo a sent message.
- Added `supabase/migrations/20261102000000_velori_onesignal_campaign_delivery.sql`; it is not applied remotely. No Supabase function was deployed and no OneSignal/Firebase secret was set. The supplied project reference still differs from the locally configured reference; confirm the target before any remote operation.
- Validation: `pnpm test` passed (368/368); `pnpm typecheck`, `pnpm build`, server `deno check`, five focused OneSignal Deno tests, focused formatting, and `git diff --check` passed. Repository-wide `pnpm run format:check` still reports pre-existing formatting drift across 472 source files; changed UI files pass focused formatting.
- Android debug assembly was subsequently unblocked for validation only; the custom notification bridge compiled and the app installed on an Android 17 emulator. This does not verify push: FCM registration reported `SERVICE_NOT_AVAILABLE` with the missing matching Firebase configuration. No authenticated admin campaign, live notification, account-switch, foreground/background/terminated tap, or chat push acceptance was performed.
- Remaining release requirements: confirm the Supabase project, configure matching Firebase and OneSignal credentials, apply the migration and deploy only after authorization, then test permission, identity, campaign/chat delivery, and tap routing on supported Android devices.

## Android build and emulator validation follow-up (2026-11-02)

This follow-up supersedes the earlier statement that Android source compilation and installation had not been performed.

- Added `pnpm run android:sync`: the normal production web build remains unchanged, while an Android-only staging copy excludes `.apk` and `.aab` downloads before Capacitor sync. The website continues to serve its existing download paths. This prevents recursive embedding of old APK downloads; the pre-existing ignored APKs were approximately 843 MiB and contained older APKs inside the package.
- Updated OneSignal observer registration to implement the interfaces exposed by the resolved 5.11.0 SDK. The Kotlin Android bridge now compiles.
- Gradle checks `google-services.json` against the configured application ID. Debug validation can proceed without a matching Firebase client, with an explicit warning that push is unavailable. Release tasks fail closed when matching Firebase configuration or a release keystore is missing. Release key material is loaded only from the ignored `android/keystore.properties`; no key was generated.
- `pnpm run android:sync` passed. The staged Android web assets contained 140 files and no APK/AAB files; the public website build still includes the existing download files.
- `pnpm test` passed (378/378); `pnpm test:native-media-picker` passed (3/3); `pnpm typecheck` and the production web build passed.
- Android `:app:assembleDebug` passed under Java 21. The resulting `android/app/build/outputs/apk/debug/app-debug.apk` is 17,252,282 bytes, package ID `online.veloryz.chat`, version `1.0` / versionCode `1`, and signed with the Android debug certificate. Android 17 emulator installation succeeded. After first-run emulator startup, the public landing page rendered; Capacitor reported Camera, App, and VeloriNotifications plugins available. Authenticated flows, uploads, actual camera/gallery selections, push delivery, and production-backend operations were not tested.
- The emulator had no working FCM registration (`SERVICE_NOT_AVAILABLE`), consistent with the missing matching Firebase client. No push functionality is claimed as verified.
- `:app:bundleRelease` was deliberately blocked and produced no AAB: the checked-in Firebase config has no client for `online.veloryz.chat`, and no release keystore exists. No production-signed APK, AAB, GitHub Release, or public download URL was created.
- The existing downloadable APK was independently identified as package `veloryz.online.velori`, version `1.0` / versionCode `1`, Android-debug-signed, and approximately 843 MiB. It is not update-compatible with the current configured ID `online.veloryz.chat`; the signing identity needed for any prior production installation was not found. The requested package-ID change therefore still requires an explicit product decision before publishing an update.

### Release and update procedure

1. Confirm the permanent application ID and obtain the corresponding Firebase Android configuration. Keep the Firebase project and OneSignal FCM setup aligned.
2. Obtain the existing production signing keystore if the app must update an existing production installation. If no compatible release key exists, obtain explicit authorization before generating a new one; securely back up that key and keep it outside version control.
3. Store the keystore path, alias, and passwords in the ignored `android/keystore.properties`; do not commit signing values.
4. Preserve both the application ID and signing certificate for upgrades. Increment `versionCode` for every published update and update `versionName`.
5. Run `pnpm run android:sync`, then from `android/` run `gradlew clean assembleRelease bundleRelease`. Install and test the signed APK on supported Android devices; verify the APK/AAB package identity and signer before publishing.
6. Publish only verified release artifacts through the authorized VELORI download or store channel, then record the actual URLs and tested update path. None of these release steps after configuration is complete in this task.

## New Android application release follow-up (2026-11-02)

This section supersedes earlier release-blocked statements above. The user explicitly selected the new application ID `online.veloryz.velori` and authorized creation of a new permanent signing identity; the old IDs are intentionally not reused.

- Updated the Capacitor app ID, Android Gradle application ID, and custom URL-scheme/package strings to `online.veloryz.velori`. The Kotlin namespace remains `veloryz.online.velori`. This package is a separate install from both the old `veloryz.online.velori` download and prior `online.veloryz.chat` test build.
- Created a new PKCS12 release key (`velori-release`) outside the repository at `%USERPROFILE%\.android\velori-release\velori-release.p12`. Its signing-properties file is also outside the repository; the containing directory's Windows ACL grants access only to the current user and SYSTEM. The key/password values were not logged or committed. Certificate SHA-256: `54f7ad81132e68330e14b2edd968ab6d0ca4ccb920d248dfb3ddb4c20e0c3b3d`. Securely back up both files; never regenerate the key for app updates.
- Gradle now allows signed release packaging without Firebase, while warning that push is unavailable for this package. This follows the brief's instruction to continue without push rather than fabricate Firebase credentials. The config has a Firebase client for `veloryz.online.velori`, not `online.veloryz.velori`.
- Validation passed: `pnpm test` (378/378), `pnpm typecheck`, `pnpm run android:sync` (140 native web assets, zero nested APK/AAB files), and `oxfmt --check capacitor.config.ts`. Android `clean :app:assembleRelease :app:bundleRelease` succeeded with JBR 21.0.11 / Gradle 8.14.3. APK `apksigner verify` and AAB `jarsigner -verify` passed.
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`; 13,786,281 bytes; SHA-256 `4c6de5f952991749e45d205361ada04c56344d01eda1d69a2d9b5f9f6337c95b`. It reports ID `online.veloryz.velori`, version `1.0`, versionCode `1`, and the new release signer.
- Release AAB: `android/app/build/outputs/bundle/release/app-release.aab`; 12,868,936 bytes; SHA-256 `bf32be2e36cf988dc27b19bf3be601dfaad86dcfe85cafde703405462a65ddbf`. It contains base manifest and bundle config entries and has a verified JAR signature from the same self-signed release certificate.
- The signed APK installed and launched on the connected Android 17 emulator. After a temporary Android System UI “not responding” dialog was dismissed, an emulator screenshot showed the VELORI visitor landing page. The emulator had no network connection, so no remote backend action was tested.
- Native plugins in the app: Capacitor App, Capacitor Camera, and custom VeloriNotifications. Plugin compilation is covered by the Android release build, but physical camera/gallery selection, uploads, push, authenticated flows, route/deep-link callbacks, and real-device behavior remain unverified. A dedicated Android Keystore-backed Supabase session-storage adapter is not implemented.
- No APK URL was fabricated or deployed. Public hosting/upload credentials were unavailable. The verified local release APK/AAB are deliverable files, not proof of a published download or Play Store deployment.

## Existing-package update correction (2026-11-03)

The downloadable `public/velori.apk` identifies as `veloryz.online.velori` and is signed with the Android debug certificate (`629027be40d247c1c9ca0eccaaa1434d0e2eb002e503d5b029bd733a83e4a765`). The compatible `1.0.1`/versionCode `2` APK is rebuilt with that same application ID and certificate. Earlier `online.veloryz.velori` release artifacts are separate apps and cannot update this download. This matching local debug key is not a Play Store signing identity; the APK was not installed because `adb` is unavailable.
- Git remains on branch `native-android-bootstrap`, based on `258ffe01a3f388e889cb7d1e99899569fa4b4106`; the task changes remain uncommitted. No database or production backend was modified.
