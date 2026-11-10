# VELORI Settings Persistence Audit

## 1. Audit Findings
- **Theme & Appearance**: Persists to `localStorage` (`velori-theme`) and updates `document.documentElement.dataset.theme` instantly.
- **Account Settings**: Email changes, password updates, and profile edits interact directly with Supabase Auth and PostgreSQL profiles table.
- **Notification Settings**: Saved to account preferences and synchronized across devices.
- **App Permissions**: Dedicated settings section displays permission status for Camera, Photos/Media, and Notifications with direct links to Android system settings.
