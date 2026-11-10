-- Behavior regression test for the privacy migration. Run with:
-- supabase db query --linked --file supabase/tests/privacy_permissions.sql
-- All fixture rows are rolled back at the end of the test.

begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('f1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'privacy-owner@invalid.example', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('f1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'privacy-visitor@invalid.example', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('f1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'privacy-public@invalid.example', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, username, display_name, bio, is_private)
values
  ('f1000000-0000-4000-8000-000000000001', 'privacy_test_owner', 'Privacy Owner', 'private bio', true),
  ('f1000000-0000-4000-8000-000000000002', 'privacy_test_visitor', 'Privacy Visitor', '', false),
  ('f1000000-0000-4000-8000-000000000003', 'privacy_test_public', 'Public Profile', 'public bio', false)
on conflict (id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  bio = excluded.bio,
  is_private = excluded.is_private;

update public.account_settings
   set show_bio = false,
       show_avatar = false,
       followers_visibility = 'followers',
       like_permission = 'followers',
       like_list_visibility = 'followers',
       mention_permission = 'followers',
       reshare_permission = 'followers',
       message_permission = 'mutuals'
 where profile_id = 'f1000000-0000-4000-8000-000000000001';
update public.account_settings
   set message_permission = 'existing'
 where profile_id = 'f1000000-0000-4000-8000-000000000003';

insert into public.posts (id, author_id, body, visibility, allow_comments, allow_likes, is_published)
values (
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'A private test post',
  'public',
  true,
  true,
  true
)
on conflict (id) do nothing;

insert into public.posts (id, author_id, body, visibility, allow_comments, allow_likes, is_published)
values (
  'f2000000-0000-4000-8000-000000000003',
  'f1000000-0000-4000-8000-000000000003',
  'Public restriction test post', 'public', true, true, true
)
on conflict (id) do nothing;
insert into public.comments (id, post_id, author_id, body)
values ('f4000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000003',
  'f1000000-0000-4000-8000-000000000002', 'Restricted test comment')
on conflict (id) do nothing;
insert into public.restrictions (restrictor_id, restricted_id)
values ('f1000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000002')
on conflict do nothing;
insert into public.stories (id, author_id, caption, media_type, audience, status, expires_at, moderation_state)
values ('f5000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000003',
  'Muted story fixture', 'text', 'public', 'active', now() + interval '1 hour', 'clean')
on conflict (id) do nothing;
insert into public.notifications (id, recipient_id, actor_id, kind, title, body)
values ('f6000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000003', 'follow', 'Muted actor notification', '')
on conflict (id) do nothing;
insert into public.mutes (muter_id, muted_id)
values ('f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003')
on conflict do nothing;

insert into public.conversations (id, kind, direct_key)
values (
  'f3000000-0000-4000-8000-000000000001',
  'direct',
  'f1000000-0000-4000-8000-000000000001:f1000000-0000-4000-8000-000000000002'
)
on conflict (id) do nothing;
insert into public.conversation_participants (conversation_id, user_id, role)
values
  ('f3000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'owner'),
  ('f3000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'member')
on conflict do nothing;
insert into public.messages (conversation_id, sender_id, kind, body)
values (
  'f3000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'text',
  'Existing conversation privacy fixture'
);

-- The private owner follows the visitor. That reverse relationship alone must
-- never grant access to the owner's private profile.
insert into public.follows (follower_id, following_id, status)
values ('f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'accepted')
on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);

do $$
declare
  visible_profile uuid;
  owner_private boolean;
  preview_bio text;
  preview_avatar text;
  connection_id uuid;
begin
  if has_column_privilege('authenticated', 'public.profiles', 'bio', 'select')
     or has_column_privilege('authenticated', 'public.profiles', 'website_url', 'select') then
    raise exception 'Sensitive profile columns are directly selectable.';
  end if;
  select p.is_private into owner_private from public.profiles p
   where p.id = 'f1000000-0000-4000-8000-000000000001';
  if public.viewer_can_see(auth.uid(), 'f1000000-0000-4000-8000-000000000001') then
    raise exception 'Reverse follow case: viewer %, owner_private %, approved %.', auth.uid(), owner_private,
      private.viewer_is_approved_follower('f1000000-0000-4000-8000-000000000001');
  end if;
  select p.id into visible_profile from public.profiles p
   where p.id = 'f1000000-0000-4000-8000-000000000001';
  if visible_profile is not null then
    raise exception 'An unapproved visitor can read a private profile row.';
  end if;
  select p.id into visible_profile from public.posts p
   where p.id = 'f2000000-0000-4000-8000-000000000001';
  if visible_profile is not null then
    raise exception 'An unapproved visitor can read a private account post.';
  end if;
  select d.bio, d.avatar_url into preview_bio, preview_avatar
    from public.profile_discovery_by_username('privacy_test_owner') d;
  if preview_bio is distinct from '' or preview_avatar is not null then
    raise exception 'Profile discovery returned fields hidden by privacy settings.';
  end if;
  select c.id into connection_id
    from public.profile_connections('f1000000-0000-4000-8000-000000000001', 'followers', 20, 0) c;
  if connection_id is not null then
    raise exception 'An unapproved visitor can read a protected follower list.';
  end if;
  if private.viewer_meets_permission('f1000000-0000-4000-8000-000000000001', 'followers') then
    raise exception 'An unapproved visitor satisfies the followers interaction setting.';
  end if;
  if not private.viewer_meets_permission('f1000000-0000-4000-8000-000000000001', 'following') then
    raise exception 'The people-I-follow setting ignored the actual outgoing follow direction.';
  end if;
  if private.viewer_can_see_like_list('f1000000-0000-4000-8000-000000000001') then
    raise exception 'An unapproved visitor can see a followers-only like list.';
  end if;
  if not exists (select 1 from public.comments where id = 'f4000000-0000-4000-8000-000000000003') then
    raise exception 'A restricted user cannot see their own comment.';
  end if;
  if not exists (select 1 from public.my_safety_lists() where list_name = 'mutes'
    and target_id = 'f1000000-0000-4000-8000-000000000003' and username = 'privacy_test_public') then
    raise exception 'The owner-scoped safety list did not return its blocked account.';
  end if;
  if private.viewer_can_read_story('f5000000-0000-4000-8000-000000000003') then
    raise exception 'A story from an account muted with hide_stories enabled remained visible.';
  end if;
  if exists (select 1 from public.notifications where id = 'f6000000-0000-4000-8000-000000000003') then
    raise exception 'A notification from an account muted with hide_notifications enabled remained visible.';
  end if;
  if private.viewer_can_reshare_content('f1000000-0000-4000-8000-000000000001') then
    raise exception 'An unapproved visitor can reshare followers-only content.';
  end if;
  if public.can_message_profile('f1000000-0000-4000-8000-000000000001')
     or public.can_message_profile('f1000000-0000-4000-8000-000000000003') then
    raise exception 'The profile message capability exposed a denied action.';
  end if;
  begin
    perform public.open_direct_conversation('f1000000-0000-4000-8000-000000000001');
    raise exception 'A non-mutual opened a conversation with a mutuals-only account.';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.open_direct_conversation('f1000000-0000-4000-8000-000000000003');
    raise exception 'A new conversation was opened for an existing-conversations-only account.';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.likes (user_id, post_id)
    values ('f1000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001');
    raise exception 'An unapproved visitor liked content restricted to approved followers.';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.comments (post_id, author_id, body)
    values ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'Unauthorized comment');
    raise exception 'An unapproved visitor commented where follower access is required.';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into public.posts (author_id, body)
    values ('f1000000-0000-4000-8000-000000000002', 'Hello @privacy_test_owner');
    raise exception 'An unapproved visitor mentioned an account that permits followers only.';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000003', true);
do $$
begin
  if exists (select 1 from public.comments where id = 'f4000000-0000-4000-8000-000000000003') then
    raise exception 'A restricted comment is visible to the content owner.';
  end if;
  if exists (select 1 from public.my_safety_lists() where list_name = 'mutes'
    and target_id = 'f1000000-0000-4000-8000-000000000003') then
    raise exception 'A user read another account safety lists.';
  end if;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);

reset role;
update public.account_settings
   set message_permission = 'existing'
 where profile_id = 'f1000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
begin
  if public.open_direct_conversation('f1000000-0000-4000-8000-000000000001')
     is distinct from 'f3000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'An existing conversation was unavailable in existing-only mode.';
  end if;
  if not private.can_send_direct_message(
    'f3000000-0000-4000-8000-000000000001', auth.uid()
  ) then
    raise exception 'An existing conversation cannot send messages in existing-only mode.';
  end if;
  if not public.can_message_profile('f1000000-0000-4000-8000-000000000001') then
    raise exception 'The profile hid a permitted existing conversation action.';
  end if;
end;
$$;

reset role;
insert into public.follows (follower_id, following_id, status)
values ('f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'accepted')
on conflict do nothing;
update public.account_settings
   set message_permission = 'mutuals'
 where profile_id = 'f1000000-0000-4000-8000-000000000001';
set local role authenticated;

do $$
declare
  visible_profile uuid;
begin
  if not public.viewer_can_see(auth.uid(), 'f1000000-0000-4000-8000-000000000001') then
    raise exception 'An approved follower cannot access a private profile.';
  end if;
  select p.id into visible_profile from public.profiles p
   where p.id = 'f1000000-0000-4000-8000-000000000001';
  if visible_profile is distinct from 'f1000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'An approved follower cannot read the private profile row.';
  end if;
  select p.id into visible_profile from public.posts p
   where p.id = 'f2000000-0000-4000-8000-000000000001';
  if visible_profile is distinct from 'f2000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'An approved follower cannot read the private account post.';
  end if;
  select c.id into visible_profile
    from public.profile_connections('f1000000-0000-4000-8000-000000000001', 'followers', 20, 0) c;
  if visible_profile is distinct from 'f1000000-0000-4000-8000-000000000002'::uuid then
    raise exception 'An approved follower cannot read a permitted follower list.';
  end if;
  if not private.viewer_meets_permission('f1000000-0000-4000-8000-000000000001', 'followers')
     or not private.viewer_can_see_like_list('f1000000-0000-4000-8000-000000000001')
     or not private.viewer_can_reshare_content('f1000000-0000-4000-8000-000000000001') then
    raise exception 'An approved follower failed the interaction or like-list check.';
  end if;
  if public.open_direct_conversation('f1000000-0000-4000-8000-000000000001')
     is distinct from 'f3000000-0000-4000-8000-000000000001'::uuid
     or not private.can_send_direct_message('f3000000-0000-4000-8000-000000000001', auth.uid()) then
    raise exception 'Mutual connections cannot message after mutual approval.';
  end if;
  if not public.can_message_profile('f1000000-0000-4000-8000-000000000001') then
    raise exception 'The profile hid messaging from an approved mutual connection.';
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body, client_nonce)
  values (
    'f3000000-0000-4000-8000-000000000001',
    auth.uid(),
    'text',
    'Message from an approved mutual connection',
    gen_random_uuid()::text
  );
  insert into public.likes (user_id, post_id)
  values ('f1000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001');
  insert into public.comments (post_id, author_id, body)
  values ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', 'Approved follower comment');
  insert into public.posts (author_id, body)
  values ('f1000000-0000-4000-8000-000000000002', 'Hello @privacy_test_owner');
end;
$$;

reset role;
update public.account_settings
   set like_list_visibility = 'nobody'
 where profile_id = 'f1000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
declare
  visible_likes bigint;
begin
  select count(*) into visible_likes from public.likes
   where post_id = 'f2000000-0000-4000-8000-000000000001';
  if visible_likes <> 0 then
    raise exception 'A hidden like list is available to another account.';
  end if;
end;
$$;

reset role;
insert into public.blocks (blocker_id, blocked_id)
values ('f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002')
on conflict do nothing;
set local role authenticated;

do $$
declare
  visible_profile uuid;
begin
  if public.viewer_can_see(auth.uid(), 'f1000000-0000-4000-8000-000000000001') then
    raise exception 'A block failed to revoke profile visibility.';
  end if;
  if public.can_message_profile('f1000000-0000-4000-8000-000000000001') then
    raise exception 'The profile message capability failed to respect a block.';
  end if;
  select p.id into visible_profile from public.profiles p
   where p.id = 'f1000000-0000-4000-8000-000000000001';
  if visible_profile is not null then
    raise exception 'A blocked visitor can read the private profile row.';
  end if;
  if exists (
    select 1 from public.follows f
     where (f.follower_id = 'f1000000-0000-4000-8000-000000000001'
        and f.following_id = 'f1000000-0000-4000-8000-000000000002')
        or (f.follower_id = 'f1000000-0000-4000-8000-000000000002'
        and f.following_id = 'f1000000-0000-4000-8000-000000000001')
  ) then
    raise exception 'Blocking did not remove the old follow or request relationship.';
  end if;
  begin
    perform public.open_direct_conversation('f1000000-0000-4000-8000-000000000001');
    raise exception 'A blocked user can continue an existing conversation.';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
delete from public.blocks
 where blocker_id = 'f1000000-0000-4000-8000-000000000001'
   and blocked_id = 'f1000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$
begin
  if exists (
    select 1 from public.follows f
     where (f.follower_id = 'f1000000-0000-4000-8000-000000000001'
        and f.following_id = 'f1000000-0000-4000-8000-000000000002')
        or (f.follower_id = 'f1000000-0000-4000-8000-000000000002'
        and f.following_id = 'f1000000-0000-4000-8000-000000000001')
  ) then
    raise exception 'Unblocking restored an old follow relationship.';
  end if;
end;
$$;

rollback;
