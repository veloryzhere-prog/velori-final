-- Account preferences and private message reporting. Authorized by the owner on 2026-10-24.
-- Applied through the connected Supabase migration workflow; see deployment audit.
-- AGENTS.md: "Never modify database schema without asking".
-- Client integration is in src/features/chat; verify with supabase/tests/chat_preferences.sql.
begin;
create table public.conversation_preferences (
 user_id uuid not null references public.profiles(id) on delete cascade,
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 theme text not null default 'rose' check(theme in ('rose','sunshine','lavender','ocean','paper')),
 nicknames jsonb not null default '{}'::jsonb check(jsonb_typeof(nicknames)='object' and octet_length(nicknames::text)<=8192),
 child_mode boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,conversation_id)
);
alter table public.conversation_preferences enable row level security;
create policy "Members manage own conversation preferences" on public.conversation_preferences for all to authenticated
 using(user_id=(select auth.uid()) and private.is_conversation_participant(conversation_id,(select auth.uid())))
 with check(user_id=(select auth.uid()) and private.is_conversation_participant(conversation_id,(select auth.uid())));
revoke all on public.conversation_preferences from public,anon;
grant select,insert,update,delete on public.conversation_preferences to authenticated;
grant all on public.conversation_preferences to service_role;
create index conversation_preferences_conversation_idx on public.conversation_preferences(conversation_id);
create table public.message_hides (
 user_id uuid not null references public.profiles(id) on delete cascade,
 message_id uuid not null references public.messages(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(user_id,message_id)
);
alter table public.message_hides enable row level security;
create policy "Own hidden message references" on public.message_hides for select to authenticated using(user_id=(select auth.uid()));
create policy "Hide readable messages only" on public.message_hides for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.messages m where m.id=message_id and private.is_conversation_participant(m.conversation_id,(select auth.uid()))));
create policy "Restore own hidden message references" on public.message_hides for delete to authenticated using(user_id=(select auth.uid()));
revoke all on public.message_hides from public,anon;
grant select,insert,delete on public.message_hides to authenticated;
grant all on public.message_hides to service_role;
create index message_hides_message_idx on public.message_hides(message_id);
create index content_reports_reporter_created_idx on public.content_reports(reporter_id,created_at desc);
-- Reporting uses the existing moderation table. It does not widen ordinary access to reports.
create function private.report_chat_message(p_message_id uuid,p_category text default 'other',p_reason text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=auth.uid();target public.messages;result uuid;
begin
 if viewer is null then raise exception 'Sign in to report a message.' using errcode='42501';end if;
 select m.* into target from public.messages m where m.id=p_message_id and private.is_conversation_participant(m.conversation_id,viewer);
 if not found or target.sender_id=viewer then raise exception 'Choose a readable message from another participant.' using errcode='42501';end if;
 if p_category is null or p_category not in ('spam','harassment','impersonation','hate','dangerous','copyright','privacy','scam','fake_account','other') or char_length(coalesce(p_reason,''))>2000 then raise exception 'Check report details.' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(viewer::text,0));
 select id into result from public.content_reports where reporter_id=viewer and target_type='message' and target_id=p_message_id limit 1;
 if result is not null then return result;end if;
 if (select count(*) from public.content_reports where reporter_id=viewer and created_at>now()-interval '1 hour')>=20 then raise exception 'Please wait before submitting more reports.' using errcode='P0001';end if;
 insert into public.content_reports(target_type,target_id,reporter_id,category,reason) values('message',p_message_id,viewer,p_category,coalesce(p_reason,'')) returning id into result;return result;
end $$;
revoke all on function private.report_chat_message(uuid,text,text) from public,anon;
grant execute on function private.report_chat_message(uuid,text,text) to authenticated;
create function public.report_chat_message(p_message_id uuid,p_category text default 'other',p_reason text default '') returns uuid
language sql security invoker set search_path='' as $$
 select private.report_chat_message(p_message_id,p_category,p_reason);
$$;
revoke all on function public.report_chat_message(uuid,text,text) from public,anon;
grant execute on function public.report_chat_message(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
-- Server-side Child Mode send/edit filtering is a separate follow-up: align normalization,
-- enforce on authorized message insert/update, cover recipient settings and race conditions,
-- and test bypass/permissions. This proposal alone does NOT enforce language on the server.
