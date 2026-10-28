-- V33.1 additive audit trail. Apply only after staging RLS tests and backup.
begin;
create table if not exists public.velori_studio_run_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  kind text not null check (kind in ('received','reserved','provider_started','provider_response','revision_ready','failed','quota_blocked')),
  message text not null check(length(message) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists velori_studio_run_events_owner_request
  on public.velori_studio_run_events (user_id,request_id,id);
alter table public.velori_studio_run_events enable row level security;
revoke all on public.velori_studio_run_events from public, anon, authenticated;
grant select on public.velori_studio_run_events to authenticated;
grant insert, select, delete on public.velori_studio_run_events to service_role;
create policy "studio_run_events_owner_read" on public.velori_studio_run_events
  for select to authenticated
  using ((select auth.uid()) = user_id and not coalesce(((select auth.jwt())->>'is_anonymous')::boolean,false));
-- No client insert/update/delete policy. The server is the only event writer.
comment on table public.velori_studio_run_events is 'Real, sanitized provider and orchestration events; never prompts, source code or secrets.';
commit;
