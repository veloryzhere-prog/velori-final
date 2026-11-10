# VELORI architecture map

Audit date: 2026-11-03. This document records repository evidence; it does not claim that every integration has passed production acceptance.

## Website

- React 19 and TypeScript are built with Vite. `src/main.tsx` mounts `src/app/App.tsx`.
- `src/app/routes.tsx` owns route declarations. `src/app/shell.tsx` owns the shared web application shell; admin routes have a separate shell.
- The site and Android client are separate deliverables. `pnpm run build` remains the website build. The native Android module no longer starts Capacitor's `BridgeActivity` or packages the React asset directory.

## Backend and data

- The web client is configured in `src/lib/supabase.ts` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- PostgreSQL, Auth, Storage, Realtime, row-level security, SQL RPCs, and Edge Functions are provided by the configured Supabase project. The Android client uses the same URL and anonymous key, injected into generated build config from environment or the ignored `.env.local`; it sends the user session as the bearer token and relies on existing RLS.
- Native session refresh and password authentication use Supabase Auth HTTP endpoints. Social reads and writes use existing PostgREST tables and RPCs. Session fields are encrypted using an AES/GCM key generated in Android Keystore.
- No native server credential is embedded. The anonymous key is a public client key; it does not replace backend RLS.
- No database schema or production data was changed for this native implementation.

## Android

- `android/app` is the active Android Gradle module. Its package is `veloryz.online.velori`; the launcher is Kotlin `MainActivity` and the first-party UI is Jetpack Compose/Material 3.
- Compose screens currently cover sign-in/sign-up, feed, public profile discovery, text post publishing, public reel playback, inbox/thread send/receive, own profile summary, and sign-out.
- HTTP calls run on IO dispatchers; screen state is local Compose state. This first native slice does not yet have a complete ViewModel/repository module structure, offline cache, media creation/upload, stories, notifications, profile editing, admin, or complete deep-link callback support.
- Capacitor libraries/plugins remain build dependencies for existing native plugin code, but the launcher does not create a WebView and Android assets are excluded from the APK source set.
- The existing website, Capacitor configuration, and web build remain separate and unchanged by the Compose screen entry point.

## External services and deployment

- Supabase provides app backend services. OneSignal/Firebase libraries and old Capacitor plugins remain in the Android project, but push delivery was not exercised in this native implementation.
- The website has its own Vite and hosting configuration. GitHub Release hosting is a separate release action and requires authenticated GitHub access.
- No website hosting deployment or Supabase migration was performed as part of the native Android work.

## Known verification limits

- The Compose release build completed and its APK signature/package/version were inspected.
- Emulator update and launch validation is still pending due Android 17 emulator package-manager startup/install stalls.
- No isolated QA credentials were available for live native Auth, RLS, messaging, or media acceptance.
- The configured legacy signer is Android Debug. It can update manually installed builds signed with that exact certificate, but it is not a Google Play production signing identity.
