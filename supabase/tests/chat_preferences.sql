-- Read-only catalog acceptance after applying 20261024062302_chat_preferences_and_private_reporting.sql.
-- Run: node scripts/db-query.mjs --file supabase/tests/chat_preferences.sql --expect-no-rows
select 'missing or disabled RLS: ' || name as failure
from (values ('conversation_preferences'),('message_hides')) expected(name)
left join pg_class c on c.oid=to_regclass('public.' || name)
where c.oid is null or not c.relrowsecurity
union all
select 'private reporter RPC missing or exposed to anonymous callers'
where to_regprocedure('public.report_chat_message(uuid,text,text)') is null
or has_function_privilege('anon',to_regprocedure('public.report_chat_message(uuid,text,text)'),'EXECUTE')
union all
select 'private reporter RPC does not use a fixed search path'
where not exists(select 1 from pg_proc where oid=to_regprocedure('private.report_chat_message(uuid,text,text)') and prosecdef and proconfig @> array['search_path=""'])
or exists(select 1 from pg_proc where oid=to_regprocedure('public.report_chat_message(uuid,text,text)') and prosecdef);
