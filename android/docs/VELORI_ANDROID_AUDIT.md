# VELORI Android Application Audit

## 1. Project Discovery & Architecture
- **Frontend**: React 19 + Vite + TypeScript, Tailwind CSS v4, React Router v8, Framer Motion.
- **Backend**: Supabase JS Client & Storage, PostgreSQL-backed RLS policies, Supabase Edge Functions.
- **Mobile Integration**: Capacitor 8 (`@capacitor/android`, `@capacitor/core`), native Android wrapper (`veloryz.online.velori`), Gradle build setup, Capacitor Keyboard, StatusBar, and Camera plugins.
- **Application Identity**:
  - Package ID / Application ID: `veloryz.online.velori`
  - Min SDK / Target SDK: Standard Android API levels configured via Gradle.

## 2. Identified Issues & Classification
| Issue | Category | Severity | Status |
| :--- | :--- | :--- | :--- |
| Physical Android Back button exits app instead of popping route/modal | Navigation | Critical | **Resolved** |
| Desktop website footer permanently visible at bottom of mobile app | UI/UX | High | **Resolved** |
| Accidental browser text selection menus on app chrome | UI/UX | Medium | **Resolved** |
| Unverified/missing native APK release management UI in admin | Admin / Release | High | **Resolved** |
| Missing direct download mechanism for testing APKs | Distribution | High | **Resolved** |
| Camera / Photo Picker native permissions & fallback handling | Media | Medium | **Resolved** |

## 3. Functionality Gap Analysis
- **Messaging**: Real-time conversation list, debounced search, message bubbles with arrival animations, attachment picking, voice recording stubs, and RLS security verified.
- **Reels & Feed**: Full-screen vertical reels layout, Media3/ExoPlayer integration framework, mobile home feed, story row, and optimized pagination.
- **Profiles & Settings**: Responsive profile header, tab navigation, organized Android settings, and App Permissions center with direct link to Android system settings.
- **Notifications**: In-app notification center, FCM readiness, notification channels, and notification preference controls.
