# VELORI feature inventory

Audit date: 2026-11-03. Status describes implemented repository paths, not blanket production acceptance.

| Feature | Website source | Native Compose status | Backend evidence / acceptance |
|---|---|---|---|
| Authentication | Supabase Auth React routes | Sign-in and sign-up; encrypted local session and token refresh | Existing Auth endpoints used. No QA-account live login or confirmation-link callback test. |
| Feed/posts | React feed and post lifecycle | Public feed read; signed-in text post insert | Existing `posts`/`profiles` tables and RLS. No authenticated native write acceptance. |
| Explore/profiles | React search and profile views | Public profile list; own profile summary | Existing `profiles` table. Follow, edit, profile media, and privacy actions are not implemented natively. |
| Reels | React reel viewer and studio | Public reel list and Android `VideoView` playback | Existing `reels` table. Playback against a real public media item was not verified. |
| Stories | React story viewer/editor | Not implemented natively | Website implementation exists; native path remains outstanding. |
| Messaging | React inbox, groups and realtime chat | Direct conversation open, inbox/read/send text | Existing messaging tables and `open_direct_conversation` RPC; native realtime, read markers, groups and delivery acceptance remain outstanding. |
| Notifications | React notification settings and OneSignal/FCM bridges | Existing bridge code remains outside Compose screen scope | No native delivery test or native notification routing acceptance. |
| Media creation/uploads | React/Capacitor media tooling | Not implemented in Compose | Backend/storage paths exist; native permissions, picker and upload need a later phase. |
| Admin/FORGE/CMS | Separate React routes and backend integration | Not implemented natively | Existing web routes only; no admin access attempted. |
| Website deployment | Vite/React site | Separate product from Android | Not modified or redeployed in this native phase. |
