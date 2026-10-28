-- Read-only twin of scripts/validate-velori-schema.sql, for environments that
-- have a Supabase Management API token but no psql, Docker or Supabase CLI.
--
-- Why two files: the plpgsql gate raises an exception, and `do` blocks are
-- refused by the read-only classifier in scripts/lib/guards.mjs, which is
-- deliberate â€” a `do` block can run anything. This file therefore contains
-- nothing but `with ... select` queries over the catalog, so it is accepted as
-- provably read-only and can run without `--write`.
--
-- Contract: zero rows means the catalog matches. Any row is one failed
-- assertion, and the `assertion` column names the rule that broke. Keep this
-- file's assertions in step with the plpgsql gate; a rule present in one and
-- not the other is a drift bug in the gate itself.
with required_columns(table_name, column_name) as (
  values
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
    ('site_settings','id'),('site_settings','maintenance_mode'),('site_settings','error_404_enabled'),
    ('site_settings','maintenance_scope'),('site_settings','maintenance_route'),('site_settings','maintenance_animation_url'),
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
),
required_tables(table_name) as (
  values
    ('profiles'),('posts'),('likes'),('saves'),('comments'),('post_tags'),('follows'),('profile_links'),('account_modes'),('reserved_usernames'),
    ('blocks'),('mutes'),('restrictions'),('hidden_authors'),('story_hides'),('close_friends'),('account_settings'),
    ('post_drafts'),('post_media'),('post_draft_media'),('site_settings'),('admin_profiles'),('admin_audit_logs'),('admin_login_attempts'),
    ('admin_sessions'),('admin_credential_migrations'),('admin_roles'),('admin_permissions'),('admin_role_permissions'),('admin_bootstrap_claims'),('admin_access_code'),('admin_accounts'),
    ('content_reports'),('cms_pages'),('cms_page_versions'),('navigation_items'),('feature_flags'),('system_announcements'),('admin_error_pages'),
    ('branding_assets'),('branding_asset_versions'),('animation_configs'),('theme_settings'),('advertisements'),('system_notifications'),
    ('system_notification_receipts'),('platform_settings'),('email_template_configs'),('email_template_versions'),('app_routes'),
    ('reels'),('reel_media'),('reel_drafts'),('reel_likes'),('reel_saves'),('reel_comments'),('reel_reports'),('reel_settings'),('reel_views'),
    ('stories'),('story_media'),('story_views'),('story_replies'),('story_reports'),('story_settings'),('notifications'),('notification_preferences'),
    ('motion_configuration'),('motion_versions'),('motion_presets'),('motion_publication_events'),
    ('conversations'),('conversation_participants'),('messages'),('message_attachments'),
    ('groups'),('group_members'),('group_settings'),('ad_events'),('story_likes'),('comment_likes'),('storage_cleanup_queue')
),
required_functions(signature) as (
  values
    ('public.username_available(text)'),('public.profile_follow_counts(uuid)'),('public.viewer_can_see(uuid,uuid)'),
    ('private.viewer_not_blocked(uuid)'),('private.viewer_follows_profile(uuid)'),('public.viewer_is_close_friend(uuid,uuid)'),
    ('private.group_role_rank(text)'),('private.viewer_is_group_member(uuid,uuid)'),
    ('private.viewer_outranks_group_member(uuid,uuid,uuid)'),('private.is_conversation_participant(uuid,uuid)'),
    ('private.comment_parent_matches_post(uuid,uuid)'),
    ('private.viewer_can_read_story(uuid)'),('private.viewer_can_read_story_media_path(text)'),
    ('private.viewer_can_read_reel_media_path(text)'),
    ('public.conversation_unread_counts()'),('public.conversation_unread_total()'),
    ('public.prepare_story_lifecycle()'),('public.archive_my_expired_stories()'),('public.delete_own_story(uuid)'),
    ('public.record_reel_view(uuid)'),('public.delete_own_reel(uuid)'),('public.guard_reel_publication()'),
    ('public.cleanup_expired_stories()'),('public.cleanup_expired_posts()'),
    ('public.claim_storage_cleanup_batch(integer)'),('public.ack_storage_cleanup_batch(bigint[])'),
    ('public.release_storage_cleanup_item(bigint,text)'),
    ('public.admin_dispatch_system_notification(uuid)'),
    ('public.sync_notification_campaign_receipt_read_at()'),
    ('public.admin_user_totals()'),('public.admin_user_list(text,integer,integer)'),('public.admin_user_count(text)'),
    ('public.admin_table_health()'),('public.admin_prune_login_attempts(integer)'),('public.admin_bootstrap_claim()'),
    ('public.admin_bootstrap_settle(boolean,uuid)'),('public.admin_access_code_status()'),
    ('public.admin_set_access_code(text,integer,uuid,boolean)'),
    ('public.admin_permissions_for_role(text)'),('public.admin_effective_permissions(uuid)'),
    ('public.enqueue_social_notification(uuid,uuid,text,text,text,text,text,uuid)'),
    ('public.get_post_engagement_counts(uuid[])'),('public.get_social_comment_counts(uuid[],uuid[])'),
    ('public.get_published_motion_config()'),
('public.create_group(text,text,text,text)'),('public.accept_group_invite(uuid)'),('public.invite_group_member(uuid,uuid)')
),
required_policies(tablename, policyname) as (
  values
    ('profiles','Public profiles or self'),('posts','Visible posts'),('comments','Comment on visible posts'),('follows','Read relevant follow relationships'),
    ('follows','Accept incoming follow requests'),('reels','Readers see visible reels'),('reel_media','Readers see media for visible reels'),
    ('reel_media','Authors read own reel media'),('reel_media','Authors insert reel media'),('reel_media','Authors update unready reel media'),('reel_media','Authors delete own reel media'),
    ('stories','Readers see active stories'),('story_media','Readers see media for visible stories'),
    ('notifications','Users read own notifications'),('notifications','Users mark own notifications read'),
    ('groups','Members read private groups'),('group_members','Users request membership or admins invite'),
    ('reel_likes','Readers see likes for visible reels'),('story_likes','Readers see reactions for visible stories'),
    ('story_likes','Users react to enabled visible stories'),('story_likes','Users remove own story reactions'),
    ('comment_likes','Readers see likes for visible comments'),('comment_likes','Users like visible comments'),
    ('comment_likes','Users remove own comment likes'),
    ('advertisements','Public reads active untargeted advertisements')
),
required_indexes(indexname) as (
  values
    ('posts_author_idx'),('posts_public_feed_idx'),('follows_follower_idx'),('follows_following_idx'),('follows_incoming_request_idx'),
    ('reels_author_idx'),('reels_status_idx'),('reel_views_owner_day_idx'),('stories_author_idx'),('stories_status_idx'),
    ('notifications_recipient_idx'),('notifications_read_idx'),('notifications_campaign_recipient_unique'),('notifications_unexpired_recipient_idx'),('content_reports_status_idx'),('advertisements_status_idx'),
    ('storage_cleanup_claim_idx')
),
required_triggers(tablename, trigger_name) as (
  values
    ('posts','sync_post_tags'),('profiles','provision_profile_extras'),('profiles','sync_private_account_flag'),
    ('profiles','enforce_profile_username_before_write'),('posts','maintain_post_lifecycle_before_write'),
    ('follows','protect_follow_relationship_before_write'),('admin_profiles','admin_profiles_protect_last_super'),
    ('likes','notify_post_like'),('comments','notify_post_comment'),('follows','notify_follow_event'),
    ('reel_likes','notify_reel_like'),('reel_comments','notify_reel_comment'),
    ('reels','reels_guard_publication'),
    ('notifications','sync_notification_campaign_receipt_read_at')
),
library_presets(preset_key) as (values ('startup_intro'),('error_artwork'))
select failures.assertion, failures.detail
from (
  select 'missing_column' as assertion,
         'public.' || required_columns.table_name || '.' || required_columns.column_name as detail
  from required_columns
  where not exists (
    select 1 from information_schema.columns actual
     where actual.table_schema = 'public'
       and actual.table_name = required_columns.table_name
       and actual.column_name = required_columns.column_name
  )

  union all
  select 'missing_table', 'public.' || required_tables.table_name
  from required_tables
  where to_regclass('public.' || required_tables.table_name) is null

  union all
  select 'rls_disabled', 'public.' || required_tables.table_name
  from required_tables
  where to_regclass('public.' || required_tables.table_name) is not null
    and not (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.' || required_tables.table_name))

  union all
  select 'missing_function', required_functions.signature
  from required_functions
  where to_regprocedure(required_functions.signature) is null

  union all
  select 'wrong_execute_grant', helper.signature
  from (values
    ('private.viewer_can_read_story(uuid)'),
    ('private.viewer_can_read_story_media_path(text)'),
    ('private.viewer_can_read_reel_media_path(text)')
  ) as helper(signature)
  cross join lateral (select to_regprocedure(helper.signature) as function_oid) resolved
  where resolved.function_oid is not null
    and (
      not has_function_privilege('anon', resolved.function_oid::oid, 'execute')
      or not has_function_privilege('authenticated', resolved.function_oid::oid, 'execute')
    )

  union all
  select 'wrong_execute_grant', helper.signature
  from (values
    ('public.cleanup_expired_stories()'),
    ('public.cleanup_expired_posts()'),
    ('public.claim_storage_cleanup_batch(integer)'),
    ('public.ack_storage_cleanup_batch(bigint[])'),
    ('public.release_storage_cleanup_item(bigint,text)'),
    ('public.admin_dispatch_system_notification(uuid)')
  ) as helper(signature)
  cross join lateral (select to_regprocedure(helper.signature) as function_oid) resolved
  where resolved.function_oid is not null
    and (
      has_function_privilege('anon', resolved.function_oid::oid, 'execute')
      or has_function_privilege('authenticated', resolved.function_oid::oid, 'execute')
      or not has_function_privilege('service_role', resolved.function_oid::oid, 'execute')
    )

  union all
  select 'unsafe_storage_cleanup_queue_grant', role_name
  from (values ('anon'),('authenticated')) as browser_role(role_name)
  where to_regclass('public.storage_cleanup_queue') is not null
    and (has_table_privilege(browser_role.role_name, 'public.storage_cleanup_queue', 'select')
     or has_table_privilege(browser_role.role_name, 'public.storage_cleanup_queue', 'insert')
     or has_table_privilege(browser_role.role_name, 'public.storage_cleanup_queue', 'update')
     or has_table_privilege(browser_role.role_name, 'public.storage_cleanup_queue', 'delete'))

  union all
  select 'missing_storage_cleanup_queue_grant', operation
  from (values ('select'),('insert'),('update'),('delete')) as operation_name(operation)
  where to_regclass('public.storage_cleanup_queue') is not null
    and not has_table_privilege('service_role', 'public.storage_cleanup_queue', operation_name.operation)

  union all
  select 'unpinned_search_path', required_functions.signature
  from required_functions
  where to_regprocedure(required_functions.signature) is not null
    and (select p.prosecdef from pg_proc p where p.oid = to_regprocedure(required_functions.signature))
    and not exists (
      select 1 from pg_proc p
      cross join lateral unnest(coalesce(p.proconfig, array[]::text[])) as settings(setting)
       where p.oid = to_regprocedure(required_functions.signature)
         and settings.setting like 'search_path=%'
    )

  union all
  select 'missing_policy', 'public.' || required_policies.tablename || ' / ' || required_policies.policyname
  from required_policies
  where not exists (
    select 1 from pg_policies p
     where p.schemaname = 'public'
       and p.tablename = required_policies.tablename
       and p.policyname = required_policies.policyname
  )

  union all
  select 'unsafe_comment_insert_policy', 'public.comments / Comment on visible posts'
  where not exists (
    select 1 from pg_policies p
     where p.schemaname = 'public'
       and p.tablename = 'comments'
       and p.policyname = 'Comment on visible posts'
       and p.with_check like '%private.comment_parent_matches_post%'
       and p.with_check !~* 'from comments'
  )

  union all
  select 'story_media_close_friend_visibility_missing', 'private.viewer_can_read_story(uuid) must check close-friends membership'
  where not exists (
    select 1
      from pg_proc p
     where p.oid = 'private.viewer_can_read_story(uuid)'::regprocedure
       and p.prosrc ilike '%viewer_is_close_friend%'
  )

  union all
  select 'unsafe_social_media_policy', 'public.story_media / Readers see media for visible stories'
  where not exists (
    select 1 from pg_policies p
     where p.schemaname = 'public' and p.tablename = 'story_media'
       and p.policyname = 'Readers see media for visible stories'
       and p.qual like '%private.viewer_can_read_story%'
  )

  union all
  select 'unsafe_social_media_policy', 'public.reel_media / Readers see media for visible reels'
  where not exists (
    select 1 from pg_policies p
     where p.schemaname = 'public' and p.tablename = 'reel_media'
       and p.policyname = 'Readers see media for visible reels'
       and p.qual like '%private.viewer_can_read_reel_media_path%'
  )

  union all
  select 'unsafe_social_media_policy', 'storage.objects / Readers download visible story media'
  where not exists (
    select 1 from pg_policies p
     where p.schemaname = 'storage' and p.tablename = 'objects'
       and p.policyname = 'Readers download visible story media'
       and p.qual like '%private.viewer_can_read_story_media_path%'
  )

  union all
  select 'unsafe_social_media_policy', 'storage.objects / Readers download visible reel media'
  where not exists (
    select 1 from pg_policies p
     where p.schemaname = 'storage' and p.tablename = 'objects'
       and p.policyname = 'Readers download visible reel media'
       and p.qual like '%private.viewer_can_read_reel_media_path%'
  )

  union all
  select 'unsafe_public_theme_policy', 'public.theme_settings / Public reads theme settings'
  where not exists (
    select 1 from pg_policies p
     where p.schemaname = 'public' and p.tablename = 'theme_settings'
       and p.policyname = 'Public reads theme settings'
       and p.cmd = 'SELECT' and 'anon'::name = any(p.roles) and p.qual = 'true'
  )

  union all
  select 'wrong_theme_settings_grant', role_name
  from (values ('anon'),('authenticated')) as browser_role(role_name)
  where to_regclass('public.theme_settings') is not null
    and (not has_table_privilege(browser_role.role_name, 'public.theme_settings', 'select')
      or has_table_privilege(browser_role.role_name, 'public.theme_settings', 'insert')
      or has_table_privilege(browser_role.role_name, 'public.theme_settings', 'update')
      or has_table_privilege(browser_role.role_name, 'public.theme_settings', 'delete')
      or has_table_privilege(browser_role.role_name, 'public.theme_settings', 'truncate'))

  union all
  select 'missing_index', required_indexes.indexname
  from required_indexes
  where not exists (
    select 1 from pg_indexes i
     where i.schemaname = 'public' and i.indexname = required_indexes.indexname
  )

  union all
  select 'missing_trigger', 'public.' || required_triggers.tablename || '.' || required_triggers.trigger_name
  from required_triggers
  where not exists (
    select 1 from pg_trigger t
     where not t.tgisinternal
       and t.tgrelid = to_regclass('public.' || required_triggers.tablename)
       and t.tgname = required_triggers.trigger_name
  )

  union all
  select 'missing_library_preset', preset_key
  from library_presets
  where not exists (select 1 from animation_configs a where a.key = library_presets.preset_key)

  union all
  select 'missing_media_byte_size_ceiling', 'public.animation_configs'
  where not exists (
    select 1 from pg_constraint
     where conrelid = to_regclass('public.animation_configs')
       and conname = 'animation_configs_media_byte_size_check'
       and pg_get_constraintdef(oid) like '%10485760%'
  )

  union all
  select 'realtime_publication_missing', 'public.' || publication_target.tablename
  from (values ('messages'),('conversation_participants'),('notifications'),('motion_publication_events'),('site_settings'),('theme_settings'),('story_likes'),('comment_likes')) as publication_target(tablename)
  where exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = publication_target.tablename
    )

  union all
  select 'unsafe_grant', 'anon or authenticated may read public.admin_accounts'
  where has_table_privilege('anon','public.admin_accounts','select')
     or has_table_privilege('authenticated','public.admin_accounts','select')

  union all
  select 'missing_grant', 'service_role may not read public.admin_accounts'
  where not has_table_privilege('service_role','public.admin_accounts','select')

  union all
  select 'unsafe_grant', 'a browser role may write motion publication events'
  where has_table_privilege('anon','public.motion_publication_events','insert')
     or has_table_privilege('anon','public.motion_publication_events','update')
     or has_table_privilege('anon','public.motion_publication_events','delete')
     or has_table_privilege('authenticated','public.motion_publication_events','insert')
     or has_table_privilege('authenticated','public.motion_publication_events','update')
     or has_table_privilege('authenticated','public.motion_publication_events','delete')

  union all
  select 'missing_singleton', 'public.motion_configuration has no row with id = true'
  where not exists (select 1 from public.motion_configuration where id = true)

  union all
  select 'empty_document', 'the published motion document is not a JSON object'
  where exists (select 1 from public.motion_configuration where id = true)
    and (select jsonb_typeof(mc.published_config) from public.motion_configuration mc where mc.id = true) is distinct from 'object'

  union all
  select 'empty_document', 'the motion draft is not a JSON object'
  where exists (select 1 from public.motion_configuration where id = true)
    and (select jsonb_typeof(mc.draft_config) from public.motion_configuration mc where mc.id = true) is distinct from 'object'

  union all
  -- Every real signup must have a public profile. `profiles(id)` is what the whole
  -- content graph references, so a user without one signs in successfully and then
  -- fails every write with 23503 "Key is not present in table profiles". Administrator
  -- identities are excluded: they hold a console credential, not a membership.
  select 'orphaned_identity', stranded.email
  from auth.users stranded
  where not exists (select 1 from public.profiles p where p.id = stranded.id)
    and coalesce(stranded.raw_user_meta_data ->> 'administrator_identity', '') <> 'true'

  union all
  select 'missing_trigger', 'auth.users has no profile provisioning trigger'
  where not exists (
    select 1
      from pg_trigger
     where tgrelid = 'auth.users'::regclass
       and not tgisinternal
       and tgname = 'on_auth_user_created'
  )

  union all
  select 'missing_grant', 'anon or authenticated may not read motion publication events'
  where not has_table_privilege('anon','public.motion_publication_events','select')
     or not has_table_privilege('authenticated','public.motion_publication_events','select')

  union all
  select 'missing_grant', 'anon or authenticated may not read public.site_settings'
  where not has_table_privilege('anon','public.site_settings','select')
     or not has_table_privilege('authenticated','public.site_settings','select')

  union all
  select 'missing_grant', 'authenticated may not interact with public.' || interaction.tablename
  from (values ('story_likes'),('comment_likes')) as interaction(tablename)
  where to_regclass('public.' || interaction.tablename) is not null
    and (
      not has_table_privilege('authenticated', 'public.' || interaction.tablename, 'select')
      or not has_table_privilege('authenticated', 'public.' || interaction.tablename, 'insert')
      or not has_table_privilege('authenticated', 'public.' || interaction.tablename, 'delete')
    )

  union all
  select 'wrong_execute_grant', required_functions.signature
  from required_functions
  where required_functions.signature in ('public.conversation_unread_counts()', 'public.conversation_unread_total()')
    and to_regprocedure(required_functions.signature) is not null
    and (
      has_function_privilege('anon', to_regprocedure(required_functions.signature)::oid, 'execute')
      or not has_function_privilege('authenticated', to_regprocedure(required_functions.signature)::oid, 'execute')
    )

  union all
  select 'wrong_execute_grant', required_functions.signature
  from required_functions
  where required_functions.signature = 'public.get_post_engagement_counts(uuid[])'
    and to_regprocedure(required_functions.signature) is not null
    and (
      not has_function_privilege('anon', to_regprocedure(required_functions.signature)::oid, 'execute')
      or not has_function_privilege('authenticated', to_regprocedure(required_functions.signature)::oid, 'execute')
    )

  union all
  select 'wrong_execute_grant', required_functions.signature
  from required_functions
  where required_functions.signature = 'public.get_social_comment_counts(uuid[],uuid[])'
    and to_regprocedure(required_functions.signature) is not null
    and (
      has_function_privilege('anon', to_regprocedure(required_functions.signature)::oid, 'execute')
      or not has_function_privilege('authenticated', to_regprocedure(required_functions.signature)::oid, 'execute')
    )

  union all
  select 'missing_grant', 'authenticated may not execute private.' || helper.name
  from (values
    ('group_role_rank(text)', 'private.group_role_rank(text)'),
    ('viewer_is_group_member(uuid,uuid)', 'private.viewer_is_group_member(uuid,uuid)'),
    ('viewer_outranks_group_member(uuid,uuid,uuid)', 'private.viewer_outranks_group_member(uuid,uuid,uuid)'),
    ('is_conversation_participant(uuid,uuid)', 'private.is_conversation_participant(uuid,uuid)')
  ) as helper(name, signature)
  where not has_function_privilege('authenticated', helper.signature, 'execute')

  union all
  select 'unsafe_grant', 'anon may execute private.' || helper.name
  from (values
    ('group_role_rank(text)', 'private.group_role_rank(text)'),
    ('viewer_is_group_member(uuid,uuid)', 'private.viewer_is_group_member(uuid,uuid)'),
    ('viewer_outranks_group_member(uuid,uuid,uuid)', 'private.viewer_outranks_group_member(uuid,uuid,uuid)'),
    ('is_conversation_participant(uuid,uuid)', 'private.is_conversation_participant(uuid,uuid)')
  ) as helper(name, signature)
  where has_function_privilege('anon', helper.signature, 'execute')

  -- site_settings is now broadcast through supabase_realtime, so its rows reach
  -- every subscribed tab. RLS already denies anonymous writes because no write
  -- policy exists, but relying on a missing policy leaves the whole site's
  -- branding and maintenance mode one policy away from being visitor-controlled.
  union all
  select 'unsafe_grant', 'a browser role may write public.site_settings'
  where has_table_privilege('anon','public.site_settings','insert')
     or has_table_privilege('anon','public.site_settings','update')
     or has_table_privilege('anon','public.site_settings','delete')
     or has_table_privilege('anon','public.site_settings','truncate')
     or has_table_privilege('authenticated','public.site_settings','insert')
     or has_table_privilege('authenticated','public.site_settings','update')
     or has_table_privilege('authenticated','public.site_settings','delete')
     or has_table_privilege('authenticated','public.site_settings','truncate')

  union all
  select 'wrong_execute_grant', required_functions.signature
  from required_functions
  where required_functions.signature in (
    'public.admin_user_totals()','public.admin_user_list(text,integer,integer)',
    'public.admin_user_count(text)','public.admin_table_health()',
    'public.admin_prune_login_attempts(integer)','public.admin_bootstrap_claim()',
    'public.admin_bootstrap_settle(boolean,uuid)','public.admin_access_code_status()',
    'public.admin_set_access_code(text,integer,uuid,boolean)',
    'public.admin_permissions_for_role(text)','public.admin_effective_permissions(uuid)'
  )
    and (
      has_function_privilege('anon', to_regprocedure(required_functions.signature)::oid, 'execute')
      or has_function_privilege('authenticated', to_regprocedure(required_functions.signature)::oid, 'execute')
      or not has_function_privilege('service_role', to_regprocedure(required_functions.signature)::oid, 'execute')
    )

  union all
  select 'wrong_execute_grant', required_functions.signature
  from required_functions
  where required_functions.signature in ('public.create_group(text,text,text,text)','public.accept_group_invite(uuid)','public.invite_group_member(uuid,uuid)')
    and (
      has_function_privilege('anon', to_regprocedure(required_functions.signature)::oid, 'execute')
      or not has_function_privilege('authenticated', to_regprocedure(required_functions.signature)::oid, 'execute')
    )

  union all
  select 'wrong_execute_grant', required_functions.signature
  from required_functions
  where required_functions.signature in ('public.get_published_motion_config()')
    and not has_function_privilege('anon', to_regprocedure(required_functions.signature)::oid, 'execute')

  union all
  select 'missing_bucket', bucket_expectation.bucket || ' expected public=' || bucket_expectation.should_be_public
  from (values ('site-assets', true),('profile-avatars', true),('post-media', false),
               ('story-media', false),('reel-media', false),('group-media', false),
               ('message-media', false)) as bucket_expectation(bucket, should_be_public)
  where not exists (
    select 1 from storage.buckets b
     where b.id = bucket_expectation.bucket and b.public = bucket_expectation.should_be_public
  )

  union all
  select 'missing_audio_message_media_types', 'message-media bucket must allow recorded audio'
  where not exists (
    select 1
      from storage.buckets b
     where b.id = 'message-media'
       and b.allowed_mime_types @> array['audio/mp4', 'audio/webm', 'audio/ogg']::text[]
  )

  union all
  select 'missing_audio_message_constraints', 'messages and message_attachments must allow audio'
  where not exists (
    select 1 from pg_constraint c
     where c.conrelid = to_regclass('public.messages')
       and c.conname = 'messages_kind_check'
       and pg_get_constraintdef(c.oid) like '%audio%'
  )
     or not exists (
    select 1 from pg_constraint c
     where c.conrelid = to_regclass('public.message_attachments')
       and c.conname = 'message_attachments_media_type_check'
       and pg_get_constraintdef(c.oid) like '%audio%'
  )

  union all
  select 'invalid_message_soft_delete_constraint', 'deleted text messages must be allowed to have an empty body'
  where not exists (
    select 1 from pg_constraint c
     where c.conrelid = to_regclass('public.messages')
       and c.conname = 'messages_body_present'
       and c.convalidated
       and strpos(lower(pg_get_constraintdef(c.oid)), 'deleted_at is not null') > 0
  )

  union all
  select 'missing_storage_policy', p.schemaname || '.' || p.tablename || ' / ' || p.policyname
  from (values ('storage','objects','Readers download visible group avatars'),
               ('storage','objects','Group owners upload avatars'),
               ('storage','objects','Read media attached to visible posts'),
               ('storage','objects','Upload media to own post drafts'),
               ('storage','objects','Story authors upload own media'),
               ('storage','objects','Readers download visible story media'),
               ('storage','objects','Reel authors upload own media'),
               ('storage','objects','Readers download visible reel media')) as p(schemaname, tablename, policyname)
  where not exists (
    select 1 from pg_policies existing
     where existing.schemaname = p.schemaname
       and existing.tablename = p.tablename
       and existing.policyname = p.policyname
  )

  union all
  select 'missing_cron_job', 'velori-purge-expired-posts'
  where not exists (select 1 from cron.job where jobname = 'velori-purge-expired-posts')

  union all
  select 'wrong_cron_command', 'velori-purge-expired-posts must enqueue before deleting expired posts'
  where not exists (
    select 1 from cron.job
     where jobname = 'velori-purge-expired-posts'
       and command like '%public.cleanup_expired_posts()%'
  )

  union all
  select 'missing_cron_job', 'velori-cleanup-expired-stories'
  where not exists (
    select 1 from cron.job where jobname = 'velori-cleanup-expired-stories'
  )

  union all
  select 'wrong_cron_command', 'velori-cleanup-expired-stories must enqueue before deleting expired stories'
  where not exists (
    select 1 from cron.job
     where jobname = 'velori-cleanup-expired-stories'
       and command like '%public.cleanup_expired_stories()%'
  )
) as failures
order by failures.assertion, failures.detail
