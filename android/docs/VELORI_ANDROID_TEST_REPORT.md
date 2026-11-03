# VELORI Android validation report

Date: 2026-11-02

## Release identity

- App name: `VELORI`; parent brand: `VELORYZ`.
- New Android application ID: `online.veloryz.velori`.
- Version: `1.0` / versionCode `1`.
- Architecture: React 19, TypeScript, Vite, Capacitor 8, and Kotlin native plugin bridge.
- Android toolchain: JBR 21.0.11; Gradle wrapper 8.14.3; Android Gradle Plugin 8.13.0; Kotlin Gradle plugin 2.4.21; min/compile/target SDK 24/36/36.
- Capacitor packages: core/android 8.6.0; App 8.1.2; Camera 8.2.6.
- Native plugins: Capacitor App, Capacitor Camera, and custom VeloriNotifications.
- Supabase backend/schema: existing client and configured project are reused; no schema or production data was changed.
- Release key: new PKCS12 key using alias `velori-release`, stored outside the repository at `C:\Users\aryan\.android\velori-release\velori-release.p12`. Local signing properties are also outside Git and ACL-restricted. Certificate SHA-256: `54f7ad81132e68330e14b2edd968ab6d0ca4ccb920d248dfb3ddb4c20e0c3b3d`. Keep secure backups of both the keystore and local properties; do not regenerate the identity.

## Build and test results

| Check | Result | Evidence |
|---|---|---|
| `pnpm test` | PASS | 378 passed, 0 failed |
| `pnpm typecheck` | PASS | TypeScript no-emit check |
| `pnpm run build` | PASS | Ran as part of `pnpm run android:sync`; existing large-chunk and Node deprecation warnings remain |
| `pnpm run android:sync` | PASS | 140 Android web assets; no APK/AAB archives embedded; Capacitor App and Camera registered |
| `oxfmt --check capacitor.config.ts` | PASS | Changed TypeScript config |
| `:app:assembleRelease :app:bundleRelease` | PASS | Clean Java 21 release build; Firebase mismatch is a warning, not hidden |
| Release APK signature | PASS | `apksigner verify`; package and release certificate verified |
| Release AAB signature | PASS | `jarsigner -verify`: `jar verified`; its new signer is self-signed, as expected for this locally generated upload key |
| Emulator install and launch | PASS, limited | APK installed with `adb`; VELORI landing screen visually rendered on Android 17 emulator |
| Physical Android device | NOT TESTED | No physical-device test was performed |
| Real-account/backend acceptance | NOT TESTED | No authorized test account or connected production session was used |
| Camera/gallery/uploads | NOT TESTED | Plugin compiles, but physical capture, picker, and upload flows were not exercised |
| Push notifications | BLOCKED | No Firebase client matches `online.veloryz.velori`; FCM/OneSignal delivery is unavailable |
| Public download URL | NOT PUBLISHED | No deployment/upload credentials were available |

## Release artifacts

| Artifact | Size | SHA-256 |
|---|---:|---|
| `android/app/build/outputs/apk/release/app-release.apk` | 13,786,281 bytes | `4c6de5f952991749e45d205361ada04c56344d01eda1d69a2d9b5f9f6337c95b` |
| `android/app/build/outputs/bundle/release/app-release.aab` | 12,868,936 bytes | `bf32be2e36cf988dc27b19bf3be601dfaad86dcfe85cafde703405462a65ddbf` |

The APK reports package `online.veloryz.velori`, version `1.0`, versionCode `1`. The AAB contains the base manifest, bundle config, and signature entries. Both artifacts use the certificate above.

## Known limitations and compatibility

- This is a new application ID. Existing APKs with IDs `veloryz.online.velori` or `online.veloryz.chat` remain separate apps and cannot be upgraded by this package.
- The app reuses the existing VELORI React routes and Supabase integrations; an Android build is not proof every feature has been accepted end-to-end.
- Matching Firebase configuration for the new ID is missing, so native push is not available.
- Android Keystore-backed Supabase session persistence, verified authentication/deep-link callbacks, production-account workflows, physical-device media tests, and public distribution remain unverified.
- Emulator startup briefly showed an Android System UI “not responding” dialog. The dialog was dismissed, the VELORI landing screen rendered, and the launcher activity remained resumed. This emulator issue is recorded rather than hidden.
- No APK URL was fabricated or published. The local artifacts are available for download from the current task.
