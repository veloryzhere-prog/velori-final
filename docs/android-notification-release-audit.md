# Android, notification, and release audit

Date: 2026-11-02

## Scope and evidence

This is a source audit of the Android, notification, admin-campaign, and release paths relevant to the supplied execution brief. It is not a full audit of every social feature and is not a production-readiness sign-off. Both Android project copies were inspected and kept aligned for the earlier package/notification changes; the native-media integration and generated Capacitor plugin registration target the primary `android/` project only. No Supabase deployment, OneSignal dashboard access, Android device test, or release signing was performed. Credential values were not inspected or copied.

The worktree already contained extensive staged, modified, and untracked changes before this task. Those unrelated changes were preserved.

## Findings and changes

1. **Android architecture** — The app is a Capacitor `BridgeActivity` hosting the React application, not a fully native Compose application. This is Path A from the supplied brief; native camera, share, deep-link, and lifecycle coverage is not established.

2. **Application ID** — The Android Gradle `applicationId` and Capacitor app IDs previously used `veloryz.online.velori`, while the supplied target is `online.veloryz.chat`. The Gradle application ID and Capacitor configurations were updated to the supplied target in both Android copies. The source `namespace` remains `veloryz.online.velori` for the existing Kotlin package.

3. **Firebase project configuration** — `google-services.json` exists in both copies, but neither contains a client matching `online.veloryz.chat`. The normal Android build stops at `:app:processDebugGoogleServices` with “No matching client found”. These files were not edited. A matching Firebase app configuration is required before building the requested package.

4. **Firebase service-account configuration** — No Firebase service-account file was found in the repository. A `google-services.json` file is not a service-account credential. The OneSignal dashboard's FCM credential state cannot be verified locally.

5. **OneSignal Android SDK** — The app already initialized the supplied public OneSignal App ID, but the dependency range ended before currently documented 5.x versions. The Gradle range now follows the official SDK setup range (`[5.6.1, 5.99.99]`). Initialization remains in the existing `ApplicationClass`.

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
17. **Build results — BLOCKED BY EXTERNAL CONFIGURATION.** Web production build passed. Android Gradle configuration ran under Java 21 but the Android build stopped because Firebase configuration has no client for the requested package.
18. **Runtime test results — IMPLEMENTED AND TESTED.** `pnpm test` passed 368/368; `pnpm typecheck` passed; `pnpm build` passed. Android runtime, install, notification delivery, and visual acceptance were not run.
19. **APK status — NOT IMPLEMENTED.** No APK was built or delivered.
20. **Existing APK update compatibility — BLOCKED BY EXTERNAL CONFIGURATION.** The source previously used a different package ID. The prior release package name and signing certificate are not available here, so upgrade compatibility cannot be asserted.
21. **Remaining external requirements — BLOCKED BY EXTERNAL CONFIGURATION.** Provide a matching Firebase Android app configuration for `online.veloryz.chat`; configure the FCM service-account credential in OneSignal; configure OneSignal identity verification and a server-only signing secret; confirm the target Supabase project; and provide/verify Android release signing credentials and the prior APK identity.
22. **Source ZIP and deliverables — NOT IMPLEMENTED.** The audit report and source changes are in the workspace, but a release APK/source ZIP was not produced. Packaging the current dirty worktree as a production deliverable would be misleading and could include user-managed configuration.

## Validation record

- `pnpm test`: passed, 368 tests after the native picker follow-up.
- `pnpm test:native-media-picker`: passed, 3 focused policy tests.
- `pnpm typecheck`: passed.
- `pnpm build`: passed; Vite reported existing large-chunk warnings.
- Android manifest XML parsing: passed for the tracked Android project.
- `git diff --check`: passed.
- Android `:app:assembleDebug`: blocked at Firebase processing because `google-services.json` has no matching client for the requested application ID.
- `pnpm exec cap sync android`: registered the installed `@capacitor/app` and `@capacitor/camera` plugins and copied the latest production web assets.
- Android `:capacitor-camera:compileDebugJavaWithJavac :capacitor-camera:compileDebugKotlin`: passed under Java 21.
- Android `:app:assembleDebug`: blocked at Firebase processing because `google-services.json` has no matching client for the requested application ID.
- Android runtime and device install: not performed.

## External references

- [OneSignal Android SDK setup](https://documentation.onesignal.com/docs/en/android-sdk-setup)
- [OneSignal identity verification](https://documentation.onesignal.com/docs/en/identity-verification)

## OneSignal notification implementation follow-up (2026-11-02)

This follow-up supersedes the earlier "not implemented" status for OneSignal identity, campaign delivery, and backend integration; the preceding sections remain the source-audit snapshot from before this implementation.

- Added a Capacitor Android bridge for permission/subscription status, permission requests, subscription opt-in/out, verified OneSignal account login/logout, Android notification settings, and persisted notification-tap routes. The UI requests permission after sign-in, synchronizes identity using a short-lived authenticated ES256 token, and validates internal destinations before navigation.
- Added authenticated chat push and administrator campaign push through the existing server function. Campaign delivery reuses the existing in-app dispatch and preference model, persists an idempotency key and provider status, and now exposes paginated, searchable, push-status-filtered history. Chat push verifies persisted message ownership and excludes the sender, muted recipients, and recipients without enabled preferences. Push errors do not undo a sent message.
- Added `supabase/migrations/20261102000000_velori_onesignal_campaign_delivery.sql`; it is not applied remotely. No Supabase function was deployed and no OneSignal/Firebase secret was set. The supplied project reference still differs from the locally configured reference; confirm the target before any remote operation.
- Validation: `pnpm test` passed (368/368); `pnpm typecheck`, `pnpm build`, server `deno check`, five focused OneSignal Deno tests, focused formatting, and `git diff --check` passed. Repository-wide `pnpm run format:check` still reports pre-existing formatting drift across 472 source files; changed UI files pass focused formatting.
- Android app assembly is still blocked at `processDebugGoogleServices` because the local Firebase configuration has no client for `online.veloryz.chat`. The custom notification bridge has not been compiled or run on a device. No authenticated admin campaign, live notification, account-switch, foreground/background/terminated tap, or chat push acceptance was performed.
- Remaining release requirements: confirm the Supabase project, configure matching Firebase and OneSignal credentials, apply the migration and deploy only after authorization, then test permission, identity, campaign/chat delivery, and tap routing on supported Android devices.
