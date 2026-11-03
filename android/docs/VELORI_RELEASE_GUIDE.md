# VELORI Android release guide

## Application identity

- App name: `VELORI`
- Parent brand: `VELORYZ`
- New application ID: `online.veloryz.velori`
- Kotlin namespace: `veloryz.online.velori`
- Release signing alias: `velori-release`

This is a new application identity, not an update to the old APK. The old download uses `veloryz.online.velori`; the previous development build used `online.veloryz.chat`. Android treats all three IDs as separate installed apps.

## Build toolchain and asset staging

Use the repository-pinned pnpm version and Java 21. Android web assets must be staged with the dedicated script so downloadable APK/AAB archives are not embedded into the app:

```powershell
pnpm run android:sync
$env:JAVA_HOME = 'C:\Users\<user>\.jdks\jbr-21.0.11'
$env:VELORI_ANDROID_SIGNING_PROPERTIES = 'C:\Users\<user>\.android\velori-release\signing.properties'
Set-Location android
.\gradlew.bat clean :app:assembleRelease :app:bundleRelease
```

The signing-properties file contains `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`; it is protected by a user-only Windows ACL and remains outside the repository. The PKCS12 keystore is `C:\Users\<user>\.android\velori-release\velori-release.p12`. Back up both files to separately protected, encrypted offline storage and verify the backup before distributing the app; losing either means future updates cannot be signed with this identity. Never print or commit signing credentials.

## Firebase and push status

The checked-in `android/app/google-services.json` does not contain a client for `online.veloryz.velori`. The release build is allowed to proceed without Firebase, but it emits a warning and OneSignal/FCM push is not available. Add the real Firebase Android configuration for this exact ID and configure OneSignal before claiming push works. Do not copy or fabricate a client credential.

## Release checks

1. Verify the app ID, version name/code, signing certificate, and Firebase configuration before each release.
2. Increment `versionCode` for every published update; never change the package ID or release signing key after distribution.
3. Verify the APK with `apksigner verify --print-certs`, inspect its manifest with `aapt dump badging`, and install/launch it on a supported test device.
4. Verify the AAB signature and package identity before uploading it to Google Play.
5. Test authentication, camera, gallery, uploads, navigation, and backend flows with authorized test accounts; test push only after Firebase/OneSignal setup.
6. Publish only verified artifacts to the authorized HTTPS download host. Record the actual URL and checksum after upload. Local artifacts alone do not prove a website or store deployment.

The current emulator evidence is a launch smoke test only. Physical-device testing, authenticated backend acceptance, and verified public distribution remain separate release steps.
