# VELORI Media Access & Camera Audit

## 1. Audit Findings
- **Previous Implementation**: Used standard HTML file inputs (`type="file"`) which on Android webviews occasionally opened generic document/file pickers rather than the native Android Photo Picker.
- **Improvements**: Installed `@capacitor/camera` (`v8.2.6`) to provide direct native access to the Android photo gallery and camera capture interface, ensuring seamless media selection for posts, stories, reels, profiles, and chat attachments.

## 2. Media Services Architecture
- **Gallery Selection**: Uses native Android photo picker / gallery without requiring broad storage permissions.
- **Camera Capture**: Integrates native camera capture for photos and videos with permission management and error fallbacks.
- **Storage & Upload**: Integrates with Supabase Storage buckets (`profile-avatars`, media posts) with upload progress and error handling.
