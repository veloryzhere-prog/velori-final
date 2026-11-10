# VELORI route inventory

Audit date: 2026-11-03. This inventory is a high-level route map from `src/app/routes.tsx` and `src/app/admin-console/page-registry.ts`; consult those files for the complete generated CMS and nested admin route declarations. Runtime and authenticated acceptance are recorded separately in the progress tracker.

| Route group | Routes | Owner | Access / dependency |
|---|---|---|---|
| Feed and discovery | `/`, `/home`, `/feed`, `/explore`, `/search`, `/people`, `/hashtags/:tag` | React views | Public and signed-in states; Supabase social/profile reads |
| Posts | `/post/:id`, `/create`, `/saved`, `/archive`, `/trash`, `/drafts` | React views | Auth/ownership for write and library actions; posts/media tables and Storage |
| Profiles | `/profile`, `/profile/:username`, `/settings/follow-requests` | React views | Public profile policy plus signed-in relationship actions |
| Authentication | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/check-email`, `/verify-email`, `/auth/confirm`, `/auth/confirmed`, `/onboarding` | React auth views | Supabase Auth and configured confirmation links |
| Stories | `/stories`, `/stories/create`, `/stories/archive` | React story experience | Authenticated media upload and story data |
| Reels | `/reels`, `/reels/create` | React reel experience | Published media reads and authenticated creation/storage |
| Messaging | `/messages`, `/groups`, `/groups/create`, `/groups/:slug`, `/groups/:slug/members`, `/groups/:slug/requests` | React chat/group views | Authenticated participants, Supabase tables/RPCs/Realtime |
| Notifications/settings | `/notifications`, `/settings/notifications`, `/settings/privacy`, `/settings`, `/settings/appearance`, `/settings/account` | React views | Authenticated preferences and notification backends |
| Public information | `/us` and registered CMS slugs; `/help` and `/directory` aliases; `/forge` | React CMS/FORGE views | Public CMS reads; FORGE backend/feature configuration |
| Platform state | `/maintenance`, unknown paths | React route dispatcher | Runtime settings and public-page lookup |
| Admin | `/admin/login`, `/admin` and nested admin-console routes | Admin route tree | Admin authentication and server-side authorization/RLS |

## Native Android destinations currently implemented

The Compose launcher uses an internal destination state rather than browser URLs. Home reads the public feed; Explore reads public profiles and can start a direct conversation; Add publishes a text post; Messages reads the signed-in user's threads and sends text; Profile reads the signed-in user's profile and signs out. Public Reels open from Home and play available public video URLs. Authentication gates Messages, publishing, and Profile. These native screens do not establish parity with all website routes.
