-- Copyright © 2026 VELORYZ. All rights reserved.
-- STAGING ONLY, AFTER applying the reviewed proposal to a nonproduction database.
-- Temporary LIKE tables copy defaults/checks, not production data or foreign keys.
-- This verifies constraints; it does NOT replace owner/outsider/anonymous RLS tests.
begin;
create temporary table v32_story_check (like public.stories including defaults including constraints);
create temporary table v32_story_media_check (like public.story_media including defaults including constraints);
create temporary table v32_post_media_check (like public.post_media including defaults including constraints);
create temporary table v32_reel_media_check (like public.reel_media including defaults including constraints);

do $$
declare
  recorded_duration numeric;
  target_table text;
  invalid_json jsonb;
begin
  insert into v32_story_check (author_id, caption)
  values ('00000000-0000-4000-8000-000000000032', 'staging constraint fixture')
  returning visual_duration_seconds into recorded_duration;
  if recorded_duration <> 7 then raise exception 'Legacy Story duration changed'; end if;
  update v32_story_check set visual_duration_seconds = 20;
  begin
    update v32_story_check set visual_duration_seconds = 0;
    raise exception 'Zero duration was accepted';
  exception when check_violation then null;
  end;
  begin
    update v32_story_check set visual_duration_seconds = 601;
    raise exception 'Out-of-range duration was accepted';
  exception when check_violation then null;
  end;

  insert into v32_story_media_check (story_id, object_path)
  values ('00000000-0000-4000-8000-000000000032', 'staging/fixture.png');
  insert into v32_post_media_check (post_id, author_id, object_path, media_type)
  values ('00000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000032', 'staging/fixture.webp', 'image');
  insert into v32_reel_media_check (reel_id)
  values ('00000000-0000-4000-8000-000000000032');
  foreach target_table in array array['v32_story_media_check', 'v32_post_media_check', 'v32_reel_media_check'] loop
    execute format('update %I set composition_metadata = $1', target_table)
      using '{"schemaVersion":1,"soundtrack":{"trackId":"staging-fixture","startSeconds":5,"durationSeconds":20,"volume":0.8}}'::jsonb;
    foreach invalid_json in array array[
      '[]'::jsonb,
      'null'::jsonb,
      '{"schemaVersion":2}'::jsonb,
      '{"unknown":true}'::jsonb,
      '{"schemaVersion":"1"}'::jsonb,
      jsonb_build_object('schemaVersion', 1, 'oversized', repeat('x', 33000))
    ] loop
      begin
        execute format('update %I set composition_metadata = $1', target_table) using invalid_json;
        raise exception 'Invalid metadata accepted in %', target_table;
      exception when check_violation then null;
      end;
    end loop;
  end loop;
end $$;
rollback;
