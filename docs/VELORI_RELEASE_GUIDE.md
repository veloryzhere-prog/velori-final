# VELORI Release Guide & APK Distribution

## 1. Single-Source Architecture & Workflow
- **Source of Truth**: The React/TypeScript repository (`veloryzhere-prog/velori-final`) serves as the single source for both the web application and Capacitor Android wrapper.
- **Web Deployment**: Pushed code builds web assets on Netlify / static hosting.
- **Android APK Build**: Capacitor syncs web assets into `android/app/src/main/assets/public/` and Gradle builds signed APKs (`app-debug.apk` or release bundles).

## 2. APK Distribution for Testing
- Built APKs are copied to `public/velori.apk` and `public/velori-debug.apk`.
- Users and testers can download the Android APK directly from the application landing page or download link.

## 3. Release Checklist
1. Verify package ID (`veloryz.online.velori`).
2. Run `pnpm verify` (format check, typecheck, copyright check, security audit, test suite, and production build).
3. Build Android APK (`app:assembleDebug` or release signing).
4. Publish release artifacts and verify changelog.
