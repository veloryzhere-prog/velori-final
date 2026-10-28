-- Deterministic post-migration contract check.
-- Run with psql -v ON_ERROR_STOP=1 -f scripts/validate-velori-schema.sql.
\set ON_ERROR_STOP on

do $$
declare
  missing text[];
  item text;
  stranded record;
  rel regclass;
  function_signature text;
  function_oid regprocedure;
begin
  select array_agg(expected.table_name || '.' || expected.column_name order by expected.table_name, expected.column_name)
    into missing
    from (values
      ('profiles','id'),('profiles','username'),('profiles','is_private'),('profiles','website_url'),('profiles','account_type'),
      ('posts','id'),('posts','author_id'),('posts','visibility'),('posts','is_published'),('posts','deleted_at'),('posts','delete_expires_at'),
      ('likes','user_id'),('likes','post_id'),('saves','user_id'),('saves','post_id'),
      ('comments','id'),('comments','post_id'),('comments','author_id'),('comments','is_hidden'),('post_tags','post_id'),('post_tags','tag'),
      ('story_likes','story_id'),('story_likes','user_id'),
      ('comment_likes','id'),('comment_likes','user_id'),('comment_likes','post_comment_id'),('comment_likes','reel_comment_id'),
      ('follows','follower_id'),('follows','following_id'),('follows','status'),('follows','created_at'),('follows','responded_at'),('follows','updated_at'),
      ('profile_links','profile_id'),('account_modes','profile_id'),('account_settings','profile_id'),
      ('post_drafts','id'),('post_drafts','author_id'),('post_media','id'),('post_media','post_id'),('post_media','object_path'),
      ('post_draft_media','id'),('post_draft_media','draft_id'),('post_draft_media','object_path'),
      ('site_settings','id'),('site_settings','maintenance_mode'),('site_settings','error_404_enabled'),('site_settings','maintenance_scope'),('site_settings','maintenance_route'),('site_settings','maintenance_animation_url'),
      ('admin_profiles','user_id'),('admin_profiles','role_key'),('admin_audit_logs','action'),('admin_sessions','admin_user_id'),('admin_sessions','session_token_hash'),
      ('admin_accounts','user_id'),('admin_accounts','username'),('admin_accounts','password_hash'),('admin_accounts','role_key'),('admin_accounts','enabled'),('admin_accounts','must_change_password'),('admin_accounts','failed_attempts'),('admin_accounts','locked_until'),
      ('admin_roles','key'),('admin_permissions','key'),('admin_role_permissions','role_key'),('admin_bootstrap_claims','id'),('admin_access_code','code_hash'),
      ('content_reports','target_type'),('cms_pages','status'),('cms_page_versions','page_id'),
      ('navigation_items','navigation_scope'),('feature_flags','key'),('system_announcements','active'),('admin_error_pages','code'),
      ('branding_assets','slot'),('branding_asset_versions','asset_id'),('animation_configs','key'),('theme_settings','primary_color'),
      ('advertisements','status'),('advertisements','audience'),('advertisements','impression_count'),
      ('system_notifications','audience'),('system_notifications','audience_account_types'),('system_notifications','audience_role_keys'),('system_notification_receipts','read_at'),('platform_settings','registration_enabled'),
      ('email_template_configs','key'),('email_template_versions','template_key'),('app_routes','path'),
      ('reels','author_id'),('reels','status'),('reels','visibility'),('reels','is_deleted'),('reels','moderation_state'),('reel_media','reel_id'),('reel_media','object_path'),('reel_media','mime_type'),('reel_media','byte_size'),
      ('reel_drafts','author_id'),('reel_likes','user_id'),('reel_saves','user_id'),('reel_comments','reel_id'),('reel_reports','status'),('reel_settings','audience'),('reel_media','duration_seconds'),('reel_media','processing_state'),('reel_media','width'),('reel_media','height'),('reel_views','reel_id'),('reel_views','viewer_id'),('reel_views','viewed_on'),
      ('stories','author_id'),('stories','audience'),('stories','status'),('stories','moderation_state'),('stories','expires_at'),('stories','published_at'),('stories','archived_at'),('story_media','story_id'),('story_media','object_path'),('story_media','mime_type'),('story_media','byte_size'),('story_views','viewer_id'),
      ('story_replies','story_id'),('story_reports','status'),('story_settings','audience'),('story_settings','save_to_archive'),
      ('notifications','recipient_id'),('notifications','read_at'),('notifications','system_notification_id'),('notifications','expires_at'),('notification_preferences','profile_id'),('notification_preferences','system'),
      ('motion_configuration','id'),('motion_configuration','draft_config'),('motion_configuration','published_config'),
      ('motion_versions','version'),('motion_versions','snapshot'),
      ('motion_presets','id'),('motion_presets','label'),('motion_presets','parameters'),('motion_presets','enabled'),
      ('motion_publication_events','id'),
      ('animation_configs','media_url'),('animation_configs','media_mime_type'),('animation_configs','media_byte_size'),
      ('conversations','id'),('conversations','kind'),('conversations','direct_key'),('conversations','group_id'),
      ('conversation_participants','conversation_id'),('conversation_participants','user_id'),('conversation_participants','last_read_at'),
      ('messages','id'),('messages','conversation_id'),('messages','sender_id'),('messages','client_nonce'),('messages','deleted_at'),
      ('message_attachments','id'),('message_attachments','message_id'),('message_attachments','object_path'),
      ('groups','id'),('groups','slug'),('groups','privacy'),('groups','owner_id'),('groups','member_count'),
      ('group_members','group_id'),('group_members','user_id'),('group_members','role'),('group_members','status'),
      ('group_settings','group_id'),('group_settings','join_policy'),
      ('storage_cleanup_queue','id'),('storage_cleanup_queue','bucket_id'),('storage_cleanup_queue','object_path'),
      ('storage_cleanup_queue','queued_at'),('storage_cleanup_queue','claimed_until'),('storage_cleanup_queue','attempts'),('storage_cleanup_queue','last_error')
    ) as expected(table_name, column_name)
    left join information_schema.columns actual
      on actual.table_schema = 'public'
     and actual.table_name = expected.table_name
     and actual.column_name = expected.column_name
   where actual.column_name is null;
  if missing is not null then
    raise exception 'Missing required VELORI columns: %', array_to_string(missing, ', ');
  end if;

  foreach item in array array[
    'profiles','posts','likes','saves','comments','post_tags','follows','profile_links','account_modes','reserved_usernames',
    'blocks','mutes','restrictions','hidden_authors','story_hides','close_friends','account_settings',
    'post_drafts','post_media','post_draft_media','site_settings','admin_profiles','admin_audit_logs','admin_login_attempts',
    'admin_sessions','admin_credential_migrations','admin_roles','admin_permissions','admin_role_permissions','admin_bootstrap_claims','admin_access_code','admin_accounts',
    'content_reports','cms_pages','cms_page_versions','navigation_items','feature_flags','system_announcements','admin_error_pages',
    'branding_assets','branding_asset_versions','animation_configs','theme_settings','advertisements','system_notifications',
    'system_notification_receipts','platform_settings','email_template_configs','email_template_versions','app_routes',
    'reels','reel_media','reel_drafts','reel_likes','reel_saves','reel_comments','reel_reports','reel_settings','reel_views',
    'stories','story_media','story_views','story_replies','story_reports','story_settings','notifications','notification_preferences',
    'motion_configuration','motion_versions','motion_presets','motion_publication_events',
    'conversations','conversation_participants','messages','message_attachments',
    'groups','group_members','group_settings','ad_events','story_likes','comment_likes','storage_cleanup_queue'
  ] loop
    rel := to_regclass('public.' || item);
    if rel is null then
      raise exception 'Required VELORI table public.% is missing.', item;
    end if;
    if not (select relrowsecurity from pg_class where oid = rel) then
      raise exception 'RLS is not enabled for public.%', item;
    end if;
  end loop;

  foreach function_signature in array array[
    'public.username_available(text)', 'public.profile_follow_counts(uuid)', 'public.viewer_can_see(uuid,uuid)',
    'private.viewer_not_blocked(uuid)', 'private.viewer_follows_profile(uuid)', 'public.viewer_is_close_friend(uuid,uuid)',
    'private.comment_parent_matches_post(uuid,uuid)',
    'private.viewer_can_read_story(uuid)', 'private.viewer_can_read_story_media_path(text)',
    'private.viewer_can_read_reel_media_path(text)',
    'public.conversation_unread_counts()', 'public.conversation_unread_total()',
    'public.prepare_story_lifecycle()', 'public.archive_my_expired_stories()', 'public.delete_own_story(uuid)',
    'public.record_reel_view(uuid)', 'public.delete_own_reel(uuid)', 'public.guard_reel_publication()',
    'public.cleanup_expired_stories()', 'public.cleanup_expired_posts()',
    'public.claim_storage_cleanup_batch(integer)', 'public.ack_storage_cleanup_batch(bigint[])',
    'public.release_storage_cleanup_item(bigint,text)',
    'public.admin_dispatch_system_notification(uuid)',
    'public.sync_notification_campaign_receipt_read_at()',
    'public.admin_user_totals()', 'public.admin_user_list(text,integer,integer)', 'public.admin_user_count(text)',
    'public.admin_table_health()', 'public.admin_prune_login_attempts(integer)', 'public.admin_bootstrap_claim()',
    'public.admin_bootstrap_settle(boolean,uuid)', 'public.admin_access_code_status()',
    'public.admin_set_access_code(text,integer,uuid,boolean)',
    'public.admin_permissions_for_role(text)', 'public.admin_effective_permissions(uuid)',
    'public.enqueue_social_notification(uuid,uuid,text,text,text,text,text,uuid)',
    'public.get_post_engagement_counts(uuid[])', 'public.get_social_comment_counts(uuid[],uuid[])',
    'public.get_published_motion_config()',
    'public.create_group(text,text,text,text)','public.accept_group_invite(uuid)','public.invite_group_member(uuid,uuid)',
    'private.group_role_rank(text)','private.viewer_is_group_member(uuid,uuid)',
    'private.viewer_outranks_group_member(uuid,uuid,uuid)','private.is_conversation_participant(uuid,uuid)'
  ] loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Required VELORI function % is missing.', function_signature;
    end if;
    if (select prosecdef from pg_proc where oid = function_oid)
       and not exists (
         select 1
           from pg_proc p
           cross join lateral unnest(coalesce(p.proconfig, array[]::text[])) as settings(setting)
          where p.oid = function_oid and settings.setting like 'search_path=%'
       ) then
      raise exception 'SECURITY DEFINER function % has no pinned search_path.', function_signature;
    end if;
  end loop;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'messages'
     ) then
    raise exception 'The messages table is not included in the Supabase Realtime publication.';
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'conversation_participants'
     ) then
    raise exception 'The conversation_participants table is not included in the Supabase Realtime publication.';
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'notifications'
     ) then
    raise exception 'The notifications table is not included in the Supabase Realtime publication.';
  end if;
if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
         from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'motion_publication_events'
     ) then
    raise exception 'The motion_publication_events table is not included in the Supabase Realtime publication.';
  end if;

  -- The public motion document is a singleton row, not a table of documents:
  -- get_published_motion_config() is `... from motion_configuration where id = true`.
  -- With the row absent that function returns SQL NULL instead of erroring, so
  -- every visitor silently kept the compiled-in defaults, the realtime channel
  -- still fired, and publish_motion_config() refused with SQLSTATE 55000. The
  -- site looked healthy while the entire admin-to-site motion chain was inert.
  if not exists (select 1 from public.motion_configuration where id = true) then
    raise exception 'public.motion_configuration has no row with id = true, so the published motion document is NULL.';
  end if;
  if exists (select 1 from public.motion_configuration where id = true)
     and (select jsonb_typeof(mc.published_config) from public.motion_configuration mc where mc.id = true) is distinct from 'object' then
    raise exception 'The published motion document is not a JSON object.';
  end if;
  if exists (select 1 from public.motion_configuration where id = true)
     and (select jsonb_typeof(mc.draft_config) from public.motion_configuration mc where mc.id = true) is distinct from 'object' then
    raise exception 'The motion draft is not a JSON object.';
  end if;

  -- The settings row is broadcast to every subscribed tab so an administrator
  -- save converges on all of them. Without this the public shell keeps rendering
  -- stale maintenance mode, branding and animation settings until a reload.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
         from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'site_settings'
     ) then
    raise exception 'The site_settings table is not included in the Supabase Realtime publication.';
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'theme_settings'
     ) then
    raise exception 'The theme_settings table is not included in the Supabase Realtime publication.';
  end if;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and exists (
       select 1 from unnest(array['story_likes', 'comment_likes']) as expected(tablename)
        where not exists (
          select 1 from pg_publication_tables publication
           where publication.pubname = 'supabase_realtime'
             and publication.schemaname = 'public'
             and publication.tablename = expected.tablename
        )
     ) then
    raise exception 'Story and comment reactions are not included in the Supabase Realtime publication.';
  end if;
  -- Every real signup must have a public profile. `profiles(id)` is what the whole
  -- content graph references, so a user without one signs in successfully and then
  -- fails every write with 23503 "Key is not present in table profiles". There was
  -- no trigger on auth.users and no provisioning path anywhere, so this went
  -- unnoticed until a real signup was exercised.
  if not exists (
    select 1
      from pg_trigger
     where tgrelid = 'auth.users'::regclass
       and not tgisinternal
       and tgname = 'on_auth_user_created'
  ) then
    raise exception 'auth.users has no profile provisioning trigger, so a new signup will have no public profile.';
  end if;

  for stranded in
    select stranded_row.email as email
      from auth.users stranded_row
     where not exists (select 1 from public.profiles p where p.id = stranded_row.id)
       and coalesce(stranded_row.raw_user_meta_data ->> 'administrator_identity', '') <> 'true'
  loop
    raise exception 'The identity % has no public profile, so every write it attempts will fail with a foreign key error.', stranded.email;
  end loop;

  -- The motion provider subscribes to this table, so the browser needs a read
  -- grant and the Edge Function's service role owns every write. An anon or
  -- authenticated INSERT/UPDATE/DELETE grant here would let a visitor publish
  -- configuration invalidations.
  if not has_table_privilege('anon', 'public.motion_publication_events', 'select')
     or not has_table_privilege('authenticated', 'public.motion_publication_events', 'select') then
    raise exception 'A browser role cannot read motion_publication_events, so live config invalidation is broken.';
  end if;
  if has_table_privilege('anon', 'public.motion_publication_events', 'insert')
     or has_table_privilege('anon', 'public.motion_publication_events', 'update')
     or has_table_privilege('anon', 'public.motion_publication_events', 'delete')
     or has_table_privilege('authenticated', 'public.motion_publication_events', 'insert')
     or has_table_privilege('authenticated', 'public.motion_publication_events', 'update')
     or has_table_privilege('authenticated', 'public.motion_publication_events', 'delete') then
    raise exception 'A browser role can write motion_publication_events; only service_role may publish invalidations.';
  end if;

  -- site_settings is broadcast through supabase_realtime, so its row reaches every
  -- subscribed tab. RLS denies anonymous writes today only because no write policy
  -- exists; that is one policy away from handing every visitor the site name, logo,
  -- contact details and maintenance mode. Assert the privilege itself is absent.
  if not has_table_privilege('anon', 'public.site_settings', 'select')
     or not has_table_privilege('authenticated', 'public.site_settings', 'select') then
    raise exception 'A browser role cannot read site_settings, so the public shell loses its configuration.';
  end if;
  if has_table_privilege('anon', 'public.site_settings', 'insert')
     or has_table_privilege('anon', 'public.site_settings', 'update')
     or has_table_privilege('anon', 'public.site_settings', 'delete')
     or has_table_privilege('anon', 'public.site_settings', 'truncate')
     or has_table_privilege('authenticated', 'public.site_settings', 'insert')
     or has_table_privilege('authenticated', 'public.site_settings', 'update')
     or has_table_privilege('authenticated', 'public.site_settings', 'delete')
     or has_table_privilege('authenticated', 'public.site_settings', 'truncate') then
    raise exception 'A browser role can write site_settings; only service_role may change public site configuration.';
  end if;
  if not has_table_privilege('anon', 'public.theme_settings', 'select')
     or not has_table_privilege('authenticated', 'public.theme_settings', 'select')
     or has_table_privilege('anon', 'public.theme_settings', 'insert')
     or has_table_privilege('anon', 'public.theme_settings', 'update')
     or has_table_privilege('anon', 'public.theme_settings', 'delete')
     or has_table_privilege('anon', 'public.theme_settings', 'truncate')
     or has_table_privilege('authenticated', 'public.theme_settings', 'insert')
     or has_table_privilege('authenticated', 'public.theme_settings', 'update')
     or has_table_privilege('authenticated', 'public.theme_settings', 'delete')
     or has_table_privilege('authenticated', 'public.theme_settings', 'truncate')
     or not exists (
       select 1 from pg_policies
        where schemaname = 'public' and tablename = 'theme_settings'
          and cmd = 'SELECT' and 'anon'::name = any(roles) and qual = 'true'
     ) then
    raise exception 'Public theme settings must be readable by visitors and writable only by the server.';
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.animation_configs'::regclass
       and conname = 'animation_configs_media_byte_size_check'
       and pg_get_constraintdef(oid) like '%10485760%'
  ) then
    raise exception 'The animation library media byte-size ceiling is missing or was widened.';
  end if;

  foreach item in array array['startup_intro','error_artwork'] loop
    if not exists (select 1 from public.animation_configs a where a.key = item) then
      raise exception 'The required animation library preset public.animation_configs.% is missing.', item;
    end if;
  end loop;

  if has_table_privilege('anon', 'public.admin_accounts', 'select')
     or has_table_privilege('authenticated', 'public.admin_accounts', 'select')
     or not has_table_privilege('service_role', 'public.admin_accounts', 'select') then
    raise exception 'The admin_accounts credential table has an unsafe or missing access grant.';
  end if;

  if has_function_privilege('anon', 'public.create_group(text,text,text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.create_group(text,text,text,text)', 'execute')
     or has_function_privilege('anon', 'public.accept_group_invite(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.accept_group_invite(uuid)', 'execute')
     or has_function_privilege('anon', 'public.invite_group_member(uuid,uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.invite_group_member(uuid,uuid)', 'execute') then
    raise exception 'Group creation or invitation RPCs have an incorrect execute grant.';
  end if;
  if has_function_privilege('anon', 'public.conversation_unread_counts()', 'execute')
     or not has_function_privilege('authenticated', 'public.conversation_unread_counts()', 'execute')
     or has_function_privilege('anon', 'public.conversation_unread_total()', 'execute')
     or not has_function_privilege('authenticated', 'public.conversation_unread_total()', 'execute') then
    raise exception 'Messaging unread RPCs must be executable by authenticated users only.';
  end if;
  if has_function_privilege('anon', 'private.group_role_rank(text)', 'execute')
     or has_function_privilege('anon', 'private.viewer_is_group_member(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'private.viewer_outranks_group_member(uuid,uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'private.is_conversation_participant(uuid,uuid)', 'execute')
     or not has_function_privilege('authenticated', 'private.group_role_rank(text)', 'execute')
     or not has_function_privilege('authenticated', 'private.viewer_is_group_member(uuid,uuid)', 'execute')
     or not has_function_privilege('authenticated', 'private.viewer_outranks_group_member(uuid,uuid,uuid)', 'execute')
     or not has_function_privilege('authenticated', 'private.is_conversation_participant(uuid,uuid)', 'execute') then
    raise exception 'Social RLS helpers must be executable by authenticated, never anonymous, users.';
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'group_members'
       and policyname = 'Users request membership or admins invite'
       and with_check ~ 'viewer_outranks_group_member'
  ) then
    raise exception 'Group membership inserts must be constrained by the manager policy and join RPC.';
  end if;

  foreach function_signature in array array[
    'public.admin_user_totals()','public.admin_user_list(text,integer,integer)',
    'public.admin_user_count(text)','public.admin_table_health()',
    'public.admin_prune_login_attempts(integer)','public.admin_bootstrap_claim()',
    'public.admin_bootstrap_settle(boolean,uuid)','public.admin_access_code_status()',
    'public.admin_set_access_code(text,integer,uuid,boolean)',
    'public.admin_permissions_for_role(text)','public.admin_effective_permissions(uuid)'
  ] loop
    if has_function_privilege('anon', function_signature, 'execute')
       or has_function_privilege('authenticated', function_signature, 'execute')
       or not has_function_privilege('service_role', function_signature, 'execute') then
      raise exception 'Admin RPC % has an incorrect execute grant.', function_signature;
    end if;
  end loop;
  if not has_function_privilege('anon', 'public.profile_follow_counts(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.profile_follow_counts(uuid)', 'execute')
     or has_function_privilege('anon', 'public.viewer_can_see(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.viewer_is_close_friend(uuid,uuid)', 'execute') then
    raise exception 'Social RPC execute grants do not match the public/private contract.';
  end if;
  if not has_function_privilege('anon', 'private.viewer_can_read_story(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'private.viewer_can_read_story(uuid)', 'execute')
     or not has_function_privilege('anon', 'private.viewer_can_read_story_media_path(text)', 'execute')
     or not has_function_privilege('authenticated', 'private.viewer_can_read_story_media_path(text)', 'execute')
     or not has_function_privilege('anon', 'private.viewer_can_read_reel_media_path(text)', 'execute')
     or not has_function_privilege('authenticated', 'private.viewer_can_read_reel_media_path(text)', 'execute') then
    raise exception 'Story/reel visibility helpers must be executable by both reader roles for RLS evaluation.';
  end if;
  foreach function_signature in array array[
    'public.cleanup_expired_stories()', 'public.cleanup_expired_posts()',
    'public.claim_storage_cleanup_batch(integer)', 'public.ack_storage_cleanup_batch(bigint[])',
    'public.release_storage_cleanup_item(bigint,text)',
    'public.admin_dispatch_system_notification(uuid)'
  ] loop
    if has_function_privilege('anon', function_signature, 'execute')
       or has_function_privilege('authenticated', function_signature, 'execute')
       or not has_function_privilege('service_role', function_signature, 'execute') then
      raise exception 'Storage cleanup RPC % must be service_role-only.', function_signature;
    end if;
  end loop;
  if has_table_privilege('anon', 'public.storage_cleanup_queue', 'select')
     or has_table_privilege('anon', 'public.storage_cleanup_queue', 'insert')
     or has_table_privilege('anon', 'public.storage_cleanup_queue', 'update')
     or has_table_privilege('anon', 'public.storage_cleanup_queue', 'delete')
     or has_table_privilege('authenticated', 'public.storage_cleanup_queue', 'select')
     or has_table_privilege('authenticated', 'public.storage_cleanup_queue', 'insert')
     or has_table_privilege('authenticated', 'public.storage_cleanup_queue', 'update')
     or has_table_privilege('authenticated', 'public.storage_cleanup_queue', 'delete')
     or not has_table_privilege('service_role', 'public.storage_cleanup_queue', 'select')
     or not has_table_privilege('service_role', 'public.storage_cleanup_queue', 'insert')
     or not has_table_privilege('service_role', 'public.storage_cleanup_queue', 'update')
     or not has_table_privilege('service_role', 'public.storage_cleanup_queue', 'delete') then
    raise exception 'Storage cleanup queue grants must deny browser roles and permit service_role.';
  end if;
  if not has_function_privilege('anon', 'public.get_post_engagement_counts(uuid[])', 'execute')
     or not has_function_privilege('authenticated', 'public.get_post_engagement_counts(uuid[])', 'execute')
     or has_function_privilege('anon', 'public.get_social_comment_counts(uuid[],uuid[])', 'execute')
     or not has_function_privilege('authenticated', 'public.get_social_comment_counts(uuid[],uuid[])', 'execute') then
    raise exception 'Social engagement RPC execute grants do not match the public/private contract.';
  end if;

  foreach item in array array[
    'profiles:Public profiles or self','posts:Visible posts','follows:Read relevant follow relationships',
    'follows:Accept incoming follow requests','reels:Readers see visible reels','reel_media:Readers see media for visible reels',
    'stories:Readers see active stories','story_media:Readers see media for visible stories',
    'notifications:Users read own notifications','notifications:Users mark own notifications read',
    'groups:Members read private groups','group_members:Users request membership or admins invite',
    'reel_likes:Readers see likes for visible reels','story_likes:Readers see reactions for visible stories',
    'story_likes:Users react to enabled visible stories','story_likes:Users remove own story reactions',
    'comment_likes:Readers see likes for visible comments','comment_likes:Users like visible comments',
    'comment_likes:Users remove own comment likes',
    'advertisements:Public reads active untargeted advertisements'
  ] loop
    if not exists (
      select 1 from pg_policies p
       where p.schemaname = 'public'
         and p.tablename = split_part(item, ':', 1)
         and p.policyname = split_part(item, ':', 2)
    ) then
      raise exception 'Required RLS policy % is missing.', item;
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'stories'
       and policyname = 'Readers see active stories'
       and qual ~* 'status = ''active'''
       and qual !~* 'status = ''published'''
       and qual ~* 'moderation_state = ''clean'''
  ) then
    raise exception 'Story reader policy must admit active stories and enforce moderation.';
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'story_media'
       and policyname = 'Readers see media for visible stories'
       and qual like '%private.viewer_can_read_story%'
  ) or not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'reel_media'
       and policyname = 'Readers see media for visible reels'
       and qual like '%private.viewer_can_read_reel_media_path%'
  ) then
    raise exception 'Story/reel media metadata policies must call the viewer visibility helpers.';
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reel_media'
      and policyname = 'Authors read own reel media' and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reel_media'
      and policyname = 'Authors insert reel media' and cmd = 'INSERT'
      and with_check like '%processing_state%uploading%'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reel_media'
      and policyname = 'Authors update unready reel media' and cmd = 'UPDATE'
      and with_check like '%processing_state%'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reel_media'
      and policyname = 'Authors delete own reel media' and cmd = 'DELETE'
  ) then
    raise exception 'Reel media author policies must separate reads, staging writes, and deletion.';
  end if;

  if position(
       'viewer_is_close_friend' in pg_get_functiondef('private.viewer_can_read_story(uuid)'::regprocedure)
     ) = 0 then
    raise exception 'Story media visibility helper must honor close-friends access.';
  end if;

  foreach item in array array[
    'posts_author_idx','posts_public_feed_idx','follows_follower_idx','follows_following_idx','follows_incoming_request_idx',
    'reels_author_idx','reels_status_idx','reel_views_owner_day_idx','stories_author_idx','stories_status_idx',
    'notifications_recipient_idx','notifications_read_idx','notifications_campaign_recipient_unique','notifications_unexpired_recipient_idx','content_reports_status_idx','advertisements_status_idx',
    'storage_cleanup_claim_idx'
  ] loop
    if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = item) then
      raise exception 'Required VELORI index % is missing.', item;
    end if;
  end loop;

  foreach item in array array[
    'posts:sync_post_tags','profiles:provision_profile_extras','profiles:sync_private_account_flag',
    'profiles:enforce_profile_username_before_write','posts:maintain_post_lifecycle_before_write',
    'follows:protect_follow_relationship_before_write','admin_profiles:admin_profiles_protect_last_super',
    'likes:notify_post_like','comments:notify_post_comment','follows:notify_follow_event',
    'reel_likes:notify_reel_like','reel_comments:notify_reel_comment','reels:reels_guard_publication',
    'notifications:sync_notification_campaign_receipt_read_at'
  ] loop
    if not exists (
      select 1 from pg_trigger t
       where not t.tgisinternal
         and t.tgrelid = to_regclass('public.' || split_part(item, ':', 1))
         and t.tgname = split_part(item, ':', 2)
    ) then
      raise exception 'Required VELORI trigger % is missing.', item;
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'comments'
       and policyname = 'Comment on visible posts'
       and with_check like '%private.comment_parent_matches_post%'
       and with_check !~* 'from comments'
  ) then
    raise exception 'Comment insert policy must validate reply parents without recursively reading public.comments.';
  end if;

  if not has_column_privilege('anon', 'public.advertisements', 'title', 'select')
     or not has_column_privilege('authenticated', 'public.advertisements', 'priority', 'select')
      or not has_table_privilege('service_role', 'public.advertisements', 'select')
      or not has_table_privilege('service_role', 'public.advertisements', 'insert')
     or has_table_privilege('anon', 'public.advertisements', 'insert')
      or has_table_privilege('authenticated', 'public.advertisements', 'update')
     or has_table_privilege('authenticated', 'public.advertisements', 'delete') then
    raise exception 'Advertisement read/write grants do not match the public-renderer contract.';
  end if;
  if not has_table_privilege('authenticated', 'public.notifications', 'select')
     or not has_column_privilege('authenticated', 'public.notifications', 'read_at', 'update')
     or has_table_privilege('authenticated', 'public.notifications', 'insert')
     or has_column_privilege('authenticated', 'public.notifications', 'recipient_id', 'update') then
    raise exception 'Notification grants permit an invalid browser operation.';
  end if;
  if has_table_privilege('anon', 'public.admin_roles', 'select')
     or has_table_privilege('authenticated', 'public.admin_sessions', 'select') then
    raise exception 'An administrative relation is directly readable by a browser role.';
  end if;
  if not has_function_privilege('anon', 'public.get_published_motion_config()', 'execute')
     or not has_function_privilege('authenticated', 'public.get_published_motion_config()', 'execute')
     or has_function_privilege('anon', 'public.publish_motion_config(jsonb,text,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.publish_motion_config(jsonb,text,uuid,text)', 'execute')
     or has_table_privilege('anon', 'public.motion_configuration', 'select')
     or has_table_privilege('authenticated', 'public.motion_versions', 'select') then
    raise exception 'Motion configuration public/admin privileges do not match the CMS boundary.';
  end if;

  if not exists (select 1 from storage.buckets where id = 'site-assets' and public)
     or not exists (select 1 from storage.buckets where id = 'profile-avatars' and public)
     or not exists (select 1 from storage.buckets where id = 'post-media' and not public)
     or not exists (select 1 from storage.buckets where id = 'story-media' and not public)
     or not exists (select 1 from storage.buckets where id = 'reel-media' and not public) then
    raise exception 'A required VELORI Storage bucket is missing or has incorrect visibility.';
  end if;
  if not exists (
    select 1 from storage.buckets
     where id = 'message-media'
       and not public
       and allowed_mime_types @> array['audio/mp4', 'audio/webm', 'audio/ogg']::text[]
  ) then
    raise exception 'The private message-media bucket must allow supported audio recordings.';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = to_regclass('public.messages')
       and conname = 'messages_kind_check'
       and pg_get_constraintdef(oid) like '%audio%'
  ) or not exists (
    select 1 from pg_constraint
     where conrelid = to_regclass('public.message_attachments')
       and conname = 'message_attachments_media_type_check'
       and pg_get_constraintdef(oid) like '%audio%'
  ) then
    raise exception 'Message and attachment constraints must allow audio recordings.';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = to_regclass('public.messages')
       and conname = 'messages_body_present'
       and convalidated
       and strpos(lower(pg_get_constraintdef(oid)), 'deleted_at is not null') > 0
  ) then
    raise exception 'Deleted text messages must be allowed to have an empty body.';
  end if;
  if not exists (select 1 from storage.buckets where id = 'group-media' and not public)
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Readers download visible group avatars')
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Group owners upload avatars') then
    raise exception 'The private group-media bucket or its access policies are missing.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Read media attached to visible posts')
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Upload media to own post drafts') then
    raise exception 'Required post-media Storage policies are missing.';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Story authors upload own media')
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Readers download visible story media')
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Reel authors upload own media')
     or not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Readers download visible reel media') then
    raise exception 'Required story/reel Storage policies are missing.';
  end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'Readers download visible story media'
       and qual like '%private.viewer_can_read_story_media_path%'
  ) or not exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname = 'Readers download visible reel media'
       and qual like '%private.viewer_can_read_reel_media_path%'
  ) then
    raise exception 'Story/reel Storage read policies must enforce parent visibility before media download.';
  end if;
  if exists (select 1 from cron.job where jobname = 'velori-purge-expired-posts') is false then
    raise exception 'The expired-post database cleanup job is missing.';
  end if;
  if not exists (
    select 1 from cron.job
     where jobname = 'velori-purge-expired-posts'
       and command like '%public.cleanup_expired_posts()%'
  ) or not exists (
    select 1 from cron.job
     where jobname = 'velori-cleanup-expired-stories'
       and command like '%public.cleanup_expired_stories()%'
  ) then
    raise exception 'Expired post/story row cleanup jobs must preserve media paths through the cleanup queue.';
  end if;
end;
$$;

\echo PASS VELORI schema, RLS, grant, function, trigger, index, and storage contract
