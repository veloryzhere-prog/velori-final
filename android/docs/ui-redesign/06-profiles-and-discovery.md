# 06 — Profiles and discovery

Status: IN PROGRESS ? profile/discovery UI implemented; authenticated acceptance pending.

## Routes and implementation

- `/profile` → `OwnProfileRedirect`; `/profile/:username` → `ProfilePage`.
- `/settings/follow-requests` → `FollowRequests`.
- `/search`, `/people`, `/hashtags/:tag` → shared `Search`; `/explore` → `Explore`.
- Profile links use shared `ProfileLink`/profile path helpers in `src/app/social-engagement.tsx`.
- Profile and content visibility depend on Supabase auth/RLS, private-account settings, follows, blocks, mutes, restrictions, hidden authors and discovery RPCs. Feature flag `profile_qr_enabled` is off by default; do not represent it as available unless runtime flag enables it.

## Phase 6 plan

- Preserve profile identity, avatar, bio/links, posts and media, private-account prompts, follow/request state, follower/following views and report/block controls that exist in the current page.
- Keep search tabs/results, people discovery, hashtags, trending tags, empty/loading/failure handling and query parameters.
- Keep profile navigation consistent from posts, comments, groups, reels and search.
- Preserve privacy-setting visibility and safety-list effects. A redesign must not reveal a private profile's content/counts or make a hidden/blocked relationship observable where existing rules prevent it.
- Document all current profile actions and modal states from source before changing component contracts.

## Acceptance

Test own profile vs other profile, public vs private, approved/requested follow, blocked/muted/hidden users, empty content, search people/posts/hashtags, profile link routes, long names/bios, avatar failure and phone/desktop layouts. Run relevant auth/navigation and privacy verification tools when changes affect them.
