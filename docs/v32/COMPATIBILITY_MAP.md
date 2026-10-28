# V32 source compatibility map

| Feature | Existing route | Source ownership | Backend boundary |
| --- | --- | --- | --- |
| Shell | social route tree | `src/app/shell.tsx`, `src/product/ProductFrame.tsx` | existing auth, nav flags, real unread counts |
| Feed/posts | `/home`, `/feed`, `/post/:id` | `src/app/views.tsx`, `src/product/FeedScreen.tsx` | posts/post_media, engagement RPCs and RLS |
| Explore/search | `/explore`, `/search`, `/people`, `/hashtags/:tag` | `src/app/views.tsx` | existing profile search, post/reel/group queries |
| Profiles | `/profile/:username` | `src/app/views.tsx`, `src/product/ProfileIdentity.tsx`, `src/components/social/ProfilePostGrid.tsx` | privacy/follow rules retained |
| Post editor | `/create` | `src/features/creator-studios/components`, `services/publishing.ts` | existing private post-media/draft tables |
| Reel editor | `/reels/create` | `src/components/reel-editor`, `src/lib/reel-editor` | original Reel publish pipeline |
| Story editor | `/stories/create` | `src/app/story-editor-page.tsx`, `src/components/story-editor` | story-publishing helper/private story-media |
| Story/Reel viewers | `/stories`, `/reels` | `src/features/stories`, `src/features/reels`, `social-media-pages.tsx` | existing audience/moderation/media signing |
| Music | three editor tool panels | `src/components/studio/MusicPicker.tsx`, `src/lib/studio-catalog.ts` | existing published studio-catalog endpoint |
| Messages/groups | `/messages`, `/groups` | `src/app/social-views.tsx`, `src/features/chat` | existing membership/RLS/realtime |
| Settings/notifications | `/settings/*`, `/notifications` | existing views/settings components | original preferences/auth contracts |
| FORGE | `/forge` | `src/features/artifacts` | existing protected velori-studio Edge Function |
| Admin | `/admin/*` | `src/app/admin-console` | existing admin sessions/permission checks |
| Manage Importants | `/admin/environment`, `/admin/manage-importants` | environment screen plus alias | existing velori-environment protected API |
| CMS/help | registry public routes | existing information/CMS registry | original drafts/publication contracts |

No production database migration, route deletion, new package dependency or replacement project was introduced. V32's violet/plum direction supersedes historical palette guidance for this task; historical documentation remains as prior evidence.

Feed comment sheets reuse `PostDetail({ postId, commentsOnly: true })` without changing the existing `/post/:id` contract. Shared `Dialog` still owns focus trapping/restoration. The private Saved page keeps its existing account-specific query. The four Twick declarations were removed because no runtime or tooling import consumes them; current custom editors and publish adapters were retained.
