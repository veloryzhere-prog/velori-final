# VELORI Android Implementation Plan

## Phased Execution Roadmap

### Phase 1 — Discovery & Audit
- Inspect Capacitor configuration, AndroidManifest.xml, Gradle scripts, routing, and backend models.
- Establish architectural boundaries between React frontend, Capacitor bridge, and Supabase backend.

### Phase 2 — Native Application Foundation
- Implement centralized Android Back-button handling (dialogs -> sheets -> video viewers -> keyboard -> route history -> root exit confirmation).
- Configure status bar, edge-to-edge system insets, and keyboard show/hide adjustment.
- Hide desktop website footer by default on mobile app screens while providing an accessible **Links & Resources** sheet containing all catalog destinations.

### Phase 3 — Messaging & Conversations Rebuild
- Build dedicated mobile inbox with unread counts and debounced search.
- Implement responsive chat screen with bubble alignment, delivery indicators, timestamp formatting, realtime subscriptions, and soft-keyboard-safe composer.

### Phase 4 — Social Media & Media Integration
- Implement full-screen vertical reels layout and efficient video player resource management.
- Build mobile home feed, story viewer, and camera/gallery media upload flow connected to Supabase Storage.

### Phase 5 — Permissions & Notifications
- Implement runtime permission flows for Camera, Photos, and Notifications.
- Create App Permissions settings center with direct Android Settings deep-links.
- Configure Android notification channels and push notification token lifecycle.

### Phase 6 — Release Automation & APK Distribution
- Build production web app bundle and assemble debug/release APKs (`app-debug.apk`).
- Publish downloadable APK artifacts (`/velori.apk` and `/velori-debug.apk`) for testing.
- Verify release guide, version consistency, and application identity.
