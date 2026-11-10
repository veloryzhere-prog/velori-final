# VELORI Android release guide

## Application identity

- App name: `VELORI`
- Parent brand: `VELORYZ`
- Application ID: `veloryz.online.velori`
- Kotlin namespace: `veloryz.online.velori`
- Existing APK signing alias: `androiddebugkey` (local debug keystore)

The downloadable APK uses `veloryz.online.velori` and the local Android debug certificate. A compatible manually installed update must preserve both. The `online.veloryz.velori` and `online.veloryz.chat` test packages are separate applications. The debug key is not suitable for Google Play distribution; use the original Play signing setup if that is the release channel.

## Build toolchain and asset staging

Use the repository-pinned pnpm version and Java 21. Android web assets must be staged with the dedicated script so downloadable APK/AAB archives are not embedded into the app:

```powershell
pnpm run android:sync
$env:JAVA_HOME = 'C:\Users\<user>\.jdks\jbr-21.0.11'
# Configure VELORI_ANDROID_SIGNING_PROPERTIES to an external properties file for the existing matching key.
Set-Location android
.\gradlew.bat clean :app:assembleRelease :app:bundleRelease
```

The signing-properties file contains `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`; keep it outside the repository and never print or commit signing credentials. Preserve the existing keystore. Do not replace the debug certificate for updates to the manually distributed APK.

## Firebase and push status

The checked-in `android/app/google-services.json` contains a client for `veloryz.online.velori`. Confirm the active Firebase project and OneSignal credentials before claiming push delivery works. Do not copy or fabricate a client credential.

## Release checks

1. Verify the app ID, version name/code, signing certificate, and Firebase configuration before each release.
2. Increment `versionCode` for every published update; never change the package ID or release signing key after distribution.
3. Verify the APK with `apksigner verify --print-certs`, inspect its manifest with `aapt dump badging`, and install/launch it on a supported test device.
4. Verify the AAB signature and package identity before uploading it to Google Play.
5. Test authentication, camera, gallery, uploads, navigation, and backend flows with authorized test accounts; test push only after Firebase/OneSignal setup.
6. Publish only verified artifacts to the authorized HTTPS download host. Record the actual URL and checksum after upload. Local artifacts alone do not prove a website or store deployment.

The current emulator evidence is a launch smoke test only. Physical-device testing, authenticated backend acceptance, and verified public distribution remain separate release steps.
