-- Post editor collaboration: scoped collaborators, version history, review
-- state, comments, suggestions, share links and realtime access.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.post_drafts
  add column if not exists collaboration_status text not null default 'draft',
  add column if not exists scheduled_at timestamptz,
  add column if not exists version_number integer not null default 0;

alter table public.post_drafts drop constraint if exists post_drafts_collaboration_status_check;
alter table public.post_drafts add constraint post_drafts_collaboration_status_check
  check (collaboration_status in ('draft', 'in_review', 'approved', 'scheduled', 'published'));

create table if not exists public.post_draft_collaborators (
  draft_id uuid not null references public.post_drafts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'reviewer', 'approver', 'viewer', 'client')),
  invited_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (draft_id, user_id)
);

create table if not exists public.post_draft_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.post_drafts(id) on delete cascade,
  version_number integer not null,
  author_id uuid references public.profiles(id) on delete set null,
  name text not null default '',
  body text not null default '',
  media_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (draft_id, version_number)
);

create table if not exists public.post_draft_comments (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.post_drafts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  anchor jsonb not null default '{"type":"canvas"}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.post_draft_suggestions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.post_drafts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  proposed_body text not null check (char_length(proposed_body) <= 2000),
  reason text not null default '' check (char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.post_draft_activity (
  id bigint generated always as identity primary key,
  draft_id uuid not null references public.post_drafts(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.post_draft_share_links (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.post_drafts(id) on delete cascade,
  token_hash text not null unique,
  role text not null check (role in ('viewer', 'editor', 'client')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.post_draft_notifications (
  id bigint generated always as identity primary key,
  draft_id uuid not null references public.post_drafts(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  message text not null check (char_length(message) <= 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists post_draft_versions_recent_idx on public.post_draft_versions(draft_id, version_number desc);
create index if not exists post_draft_comments_recent_idx on public.post_draft_comments(draft_id, created_at);
create index if not exists post_draft_suggestions_pending_idx on public.post_draft_suggestions(draft_id, created_at) where status = 'pending';
create index if not exists post_draft_activity_recent_idx on public.post_draft_activity(draft_id, created_at desc);
create index if not exists post_draft_notifications_recipient_idx on public.post_draft_notifications(recipient_id, read_at, created_at desc);

create or replace function public.can_access_post_draft(target_draft uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.post_drafts d where d.id = target_draft and d.author_id = auth.uid()
    union all
    select 1 from public.post_draft_collaborators c where c.draft_id = target_draft and c.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_post_draft(target_draft uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.post_drafts d where d.id = target_draft and d.author_id = auth.uid())
    or exists (select 1 from public.post_draft_collaborators c where c.draft_id = target_draft and c.user_id = auth.uid() and c.role in ('admin', 'editor'))
  );
$$;

create or replace function public.can_review_post_draft(target_draft uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.post_drafts d where d.id = target_draft and d.author_id = auth.uid())
    or exists (select 1 from public.post_draft_collaborators c where c.draft_id = target_draft and c.user_id = auth.uid() and c.role in ('admin', 'editor', 'reviewer', 'approver'))
  );
$$;

create or replace function public.can_approve_post_draft(target_draft uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.post_drafts d where d.id = target_draft and d.author_id = auth.uid())
    or exists (select 1 from public.post_draft_collaborators c where c.draft_id = target_draft and c.user_id = auth.uid() and c.role in ('admin', 'approver'))
  );
$$;

create or replace function public.can_manage_post_draft_collaborators(target_draft uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.post_drafts d where d.id = target_draft and d.author_id = auth.uid())
    or exists (select 1 from public.post_draft_collaborators c where c.draft_id = target_draft and c.user_id = auth.uid() and c.role = 'admin')
  );
$$;

create or replace function public.post_draft_owner(target_draft uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select d.author_id from public.post_drafts d where d.id = target_draft and public.can_access_post_draft(d.id);
$$;

revoke all on function public.can_access_post_draft(uuid) from public, anon;
revoke all on function public.can_edit_post_draft(uuid) from public, anon;
revoke all on function public.can_review_post_draft(uuid) from public, anon;
revoke all on function public.can_approve_post_draft(uuid) from public, anon;
grant execute on function public.can_access_post_draft(uuid) to authenticated;
grant execute on function public.can_edit_post_draft(uuid) to authenticated;
grant execute on function public.can_review_post_draft(uuid) to authenticated;
grant execute on function public.can_approve_post_draft(uuid) to authenticated;
revoke all on function public.can_manage_post_draft_collaborators(uuid) from public, anon;
grant execute on function public.can_manage_post_draft_collaborators(uuid) to authenticated;
revoke all on function public.post_draft_owner(uuid) from public, anon;
grant execute on function public.post_draft_owner(uuid) to authenticated;

-- Invite redemption is authenticated and stores only a SHA-256 token digest.
create or replace function public.create_post_draft_share(target_draft uuid, share_role text default 'viewer')
returns text language plpgsql security definer set search_path = '' as $$
declare raw_token text; owner_id uuid;
begin
  if share_role not in ('viewer', 'editor', 'client') then raise exception 'Invalid share role'; end if;
  select author_id into owner_id from public.post_drafts where id = target_draft;
  if owner_id is null or (owner_id <> auth.uid() and not exists (
    select 1 from public.post_draft_collaborators where draft_id = target_draft and user_id = auth.uid() and role = 'admin'
  )) then raise exception 'Only a draft owner or admin can create share links'; end if;
  raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.post_draft_share_links(draft_id, token_hash, role, created_by)
    values (target_draft, encode(extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'), 'hex'), share_role, auth.uid());
  return raw_token;
end;
$$;

create or replace function public.redeem_post_draft_share(raw_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare share_row public.post_draft_share_links%rowtype;
begin
  if auth.uid() is null or raw_token is null or length(raw_token) < 32 then raise exception 'Sign in to use this collaboration link'; end if;
  select * into share_row from public.post_draft_share_links
   where token_hash = encode(extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256'), 'hex')
     and revoked_at is null and expires_at > now();
  if share_row.id is null then raise exception 'This collaboration link is invalid or expired'; end if;
  insert into public.post_draft_collaborators(draft_id, user_id, role, invited_by)
    values (share_row.draft_id, auth.uid(), share_row.role, share_row.created_by)
    on conflict (draft_id, user_id) do update set role = excluded.role;
  insert into public.post_draft_activity(draft_id, actor_id, action, detail)
    values (share_row.draft_id, auth.uid(), 'share_link_redeemed', jsonb_build_object('role', share_row.role));
  return share_row.draft_id;
end;
$$;

revoke all on function public.create_post_draft_share(uuid, text) from public, anon;
revoke all on function public.redeem_post_draft_share(text) from public, anon;
grant execute on function public.create_post_draft_share(uuid, text) to authenticated;
grant execute on function public.redeem_post_draft_share(text) to authenticated;

create or replace function public.set_post_draft_collaboration_status(target_draft uuid, next_status text, schedule_for timestamptz default null)
returns text language plpgsql security definer set search_path = '' as $$
declare current_status text; allowed boolean := false;
begin
  if next_status not in ('draft', 'in_review', 'approved', 'scheduled', 'published') then raise exception 'Invalid workflow status'; end if;
  if next_status = 'scheduled' and (schedule_for is null or schedule_for <= now()) then raise exception 'Choose a future scheduled time'; end if;
  select collaboration_status into current_status from public.post_drafts where id = target_draft and public.can_access_post_draft(id) for update;
  if current_status is null then raise exception 'Draft not found or access denied'; end if;
  if current_status = next_status then return current_status; end if;
  if current_status = 'draft' and next_status = 'in_review' then allowed := public.can_edit_post_draft(target_draft); end if;
  if current_status = 'in_review' and next_status = 'draft' then allowed := public.can_review_post_draft(target_draft); end if;
  if current_status = 'in_review' and next_status = 'approved' then allowed := public.can_approve_post_draft(target_draft); end if;
  if current_status = 'approved' and next_status = 'in_review' then allowed := public.can_review_post_draft(target_draft); end if;
  if current_status = 'approved' and next_status = 'scheduled' then allowed := public.can_approve_post_draft(target_draft); end if;
  if current_status = 'scheduled' and next_status = 'approved' then allowed := public.can_approve_post_draft(target_draft); end if;
  if current_status in ('approved', 'scheduled') and next_status = 'published' then
    allowed := exists (select 1 from public.post_drafts d where d.id = target_draft and d.author_id = auth.uid());
  end if;
  if not allowed then raise exception 'Your role cannot make this workflow transition'; end if;
  perform set_config('velori.allow_collab_status_change', 'on', true);
  update public.post_drafts set collaboration_status = next_status, scheduled_at = case when next_status = 'scheduled' then schedule_for else null end where id = target_draft;
  insert into public.post_draft_activity(draft_id, actor_id, action, detail)
    values (target_draft, auth.uid(), 'workflow_changed', jsonb_build_object('from', current_status, 'to', next_status));
  insert into public.post_draft_notifications(draft_id, recipient_id, actor_id, kind, message)
    select target_draft, recipient, auth.uid(), 'workflow', 'Workflow moved to ' || replace(next_status, '_', ' ')
      from (select author_id as recipient from public.post_drafts where id = target_draft union select user_id from public.post_draft_collaborators where draft_id = target_draft) recipients
     where recipient <> auth.uid();
  return next_status;
end;
$$;
revoke all on function public.set_post_draft_collaboration_status(uuid, text, timestamptz) from public, anon;
grant execute on function public.set_post_draft_collaboration_status(uuid, text, timestamptz) to authenticated;

create or replace function public.log_post_draft_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare draft_owner uuid; mentioned_handle text; mentioned_user uuid;
begin
  select author_id into draft_owner from public.post_drafts where id = new.draft_id;
  insert into public.post_draft_activity(draft_id, actor_id, action, detail)
    values (new.draft_id, new.author_id, 'comment_added', jsonb_build_object('comment_id', new.id, 'anchor', new.anchor));
  insert into public.post_draft_notifications(draft_id, recipient_id, actor_id, kind, message)
    select new.draft_id, recipient, new.author_id, 'comment', left(new.body, 500)
      from (select draft_owner as recipient union select user_id from public.post_draft_collaborators where draft_id = new.draft_id) recipients
     where recipient <> new.author_id;
  for mentioned_handle in
    select distinct lower((matches.match)[1]) from regexp_matches(new.body, '@([A-Za-z0-9_]{3,24})', 'g') as matches(match)
  loop
    select id into mentioned_user from public.profiles where lower(username) = mentioned_handle;
    if mentioned_user is not null and mentioned_user <> new.author_id
      and (mentioned_user = draft_owner or exists (select 1 from public.post_draft_collaborators where draft_id = new.draft_id and user_id = mentioned_user)) then
      insert into public.post_draft_notifications(draft_id, recipient_id, actor_id, kind, message)
        values (new.draft_id, mentioned_user, new.author_id, 'mention', 'You were mentioned in a draft comment.');
    end if;
    mentioned_user := null;
  end loop;
  return new;
end;
$$;
drop trigger if exists log_post_draft_comment_after_insert on public.post_draft_comments;
create trigger log_post_draft_comment_after_insert after insert on public.post_draft_comments
  for each row execute function public.log_post_draft_comment();

create or replace function public.log_post_draft_suggestion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.post_draft_activity(draft_id, actor_id, action, detail)
    values (new.draft_id, coalesce(new.reviewed_by, new.author_id),
      case when tg_op = 'INSERT' then 'suggestion_added' else 'suggestion_' || new.status end,
      jsonb_build_object('suggestion_id', new.id, 'status', new.status));
  return new;
end;
$$;
drop trigger if exists log_post_draft_suggestion_after_write on public.post_draft_suggestions;
create trigger log_post_draft_suggestion_after_write after insert or update on public.post_draft_suggestions
  for each row execute function public.log_post_draft_suggestion();

create or replace function public.log_post_draft_collaboration_action()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_draft uuid; target_actor uuid; event_name text; event_detail jsonb;
begin
  target_draft := coalesce(new.draft_id, old.draft_id);
  if tg_table_name = 'post_draft_collaborators' then
    target_actor := case when tg_op = 'INSERT' then new.invited_by else auth.uid() end;
    event_name := case when tg_op = 'DELETE' then 'collaborator_removed' when tg_op = 'INSERT' then 'collaborator_added' else 'collaborator_role_changed' end;
    event_detail := jsonb_build_object('user_id', coalesce(new.user_id, old.user_id), 'role', coalesce(new.role, old.role));
    if tg_op = 'INSERT' then
      insert into public.post_draft_notifications(draft_id, recipient_id, actor_id, kind, message)
        values (target_draft, new.user_id, target_actor, 'invite', 'You were added to a shared post draft.');
    end if;
  else
    target_actor := auth.uid();
    event_name := case when tg_op = 'DELETE' then 'share_link_revoked' when tg_op = 'INSERT' then 'share_link_created' else 'share_link_updated' end;
    event_detail := jsonb_build_object('share_id', coalesce(new.id, old.id), 'role', coalesce(new.role, old.role));
  end if;
  insert into public.post_draft_activity(draft_id, actor_id, action, detail)
    values (target_draft, target_actor, event_name, event_detail);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists log_post_draft_membership_after_write on public.post_draft_collaborators;
create trigger log_post_draft_membership_after_write after insert or update or delete on public.post_draft_collaborators
  for each row execute function public.log_post_draft_collaboration_action();
drop trigger if exists log_post_draft_share_after_write on public.post_draft_share_links;
create trigger log_post_draft_share_after_write after insert or update or delete on public.post_draft_share_links
  for each row execute function public.log_post_draft_collaboration_action();

-- A version is captured whenever the persisted text or settings change.
create or replace function public.prepare_post_draft_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.version_number := greatest(new.version_number, 1);
  elsif row(new.body, new.visibility, new.allow_comments, new.allow_likes, new.hide_like_count, new.allow_sharing)
        is distinct from row(old.body, old.visibility, old.allow_comments, old.allow_likes, old.hide_like_count, old.allow_sharing)
        or new.updated_at is distinct from old.updated_at then
    new.version_number := old.version_number + 1;
  else
    new.version_number := old.version_number;
  end if;
  return new;
end;
$$;

create or replace function public.capture_post_draft_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.version_number = old.version_number then return new; end if;
  insert into public.post_draft_versions(draft_id, version_number, author_id, body, media_snapshot)
    values (new.id, new.version_number, auth.uid(), new.body,
      coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'object_path', m.object_path, 'media_type', m.media_type, 'position', m.position, 'alt_text', m.alt_text) order by m.position) from public.post_draft_media m where m.draft_id = new.id), '[]'::jsonb))
    on conflict (draft_id, version_number) do nothing;
  insert into public.post_draft_activity(draft_id, actor_id, action, detail)
    values (new.id, auth.uid(), case when tg_op = 'INSERT' then 'draft_created' else 'draft_saved' end,
            jsonb_build_object('version', new.version_number));
  return new;
end;
$$;
drop trigger if exists prepare_post_draft_version_before_write on public.post_drafts;
create trigger prepare_post_draft_version_before_write before insert or update on public.post_drafts
  for each row execute function public.prepare_post_draft_version();
drop trigger if exists capture_post_draft_version_after_write on public.post_drafts;
create trigger capture_post_draft_version_after_write after insert or update on public.post_drafts
  for each row execute function public.capture_post_draft_version();

create or replace function public.guard_post_draft_collaboration_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.collaboration_status is distinct from old.collaboration_status or new.scheduled_at is distinct from old.scheduled_at)
    and current_setting('velori.allow_collab_status_change', true) is distinct from 'on' then
    raise exception 'Use the collaboration workflow action to change review status';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_post_draft_collaboration_status_before_write on public.post_drafts;
create trigger guard_post_draft_collaboration_status_before_write before update on public.post_drafts
  for each row execute function public.guard_post_draft_collaboration_status();

create or replace function public.bump_post_draft_version_on_media()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.post_drafts set updated_at = now() where id = coalesce(new.draft_id, old.draft_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists bump_post_draft_version_after_media_change on public.post_draft_media;
create trigger bump_post_draft_version_after_media_change after insert or update or delete on public.post_draft_media
  for each row execute function public.bump_post_draft_version_on_media();

alter table public.post_draft_collaborators enable row level security;
alter table public.post_draft_versions enable row level security;
alter table public.post_draft_comments enable row level security;
alter table public.post_draft_suggestions enable row level security;
alter table public.post_draft_activity enable row level security;
alter table public.post_draft_share_links enable row level security;
alter table public.post_draft_notifications enable row level security;

grant select, insert, update, delete on public.post_draft_collaborators to authenticated;
grant select, insert, update, delete on public.post_draft_versions to authenticated;
grant select, insert, update, delete on public.post_draft_comments to authenticated;
grant select, insert, update, delete on public.post_draft_suggestions to authenticated;
grant select on public.post_draft_activity to authenticated;
grant select, update, insert on public.post_draft_share_links to authenticated;
grant select, update on public.post_draft_notifications to authenticated;
grant usage, select on sequence public.post_draft_activity_id_seq, public.post_draft_notifications_id_seq to authenticated;
grant all on public.post_draft_collaborators, public.post_draft_versions, public.post_draft_comments,
  public.post_draft_suggestions, public.post_draft_activity, public.post_draft_share_links,
  public.post_draft_notifications to service_role;

drop policy if exists "Users manage own post drafts" on public.post_drafts;
create policy "Collaborators read shared post drafts" on public.post_drafts for select to authenticated
  using (public.can_access_post_draft(id));
create policy "Owners create post drafts" on public.post_drafts for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "Editors update shared post drafts" on public.post_drafts for update to authenticated
  using (public.can_edit_post_draft(id))
  with check (public.can_edit_post_draft(id) and author_id = public.post_draft_owner(id));
create policy "Owners delete post drafts" on public.post_drafts for delete to authenticated
  using (author_id = (select auth.uid()));

create policy "Collaborators read membership" on public.post_draft_collaborators for select to authenticated
  using (public.can_access_post_draft(draft_id));
create policy "Owners manage membership" on public.post_draft_collaborators for all to authenticated
  using (public.can_manage_post_draft_collaborators(draft_id))
  with check (public.can_manage_post_draft_collaborators(draft_id));

create policy "Collaborators read versions" on public.post_draft_versions for select to authenticated using (public.can_access_post_draft(draft_id));
create policy "Editors restore versions" on public.post_draft_versions for insert to authenticated with check (public.can_edit_post_draft(draft_id));
create policy "Editors rename versions" on public.post_draft_versions for update to authenticated using (public.can_edit_post_draft(draft_id)) with check (public.can_edit_post_draft(draft_id));
create policy "Collaborators read comments" on public.post_draft_comments for select to authenticated using (public.can_access_post_draft(draft_id));
create policy "Collaborators comment" on public.post_draft_comments for insert to authenticated with check (public.can_review_post_draft(draft_id) and author_id = auth.uid());
create policy "Reviewers resolve comments" on public.post_draft_comments for update to authenticated using (public.can_review_post_draft(draft_id)) with check (public.can_review_post_draft(draft_id));
create policy "Reviewers suggest edits" on public.post_draft_suggestions for select to authenticated using (public.can_access_post_draft(draft_id));
create policy "Reviewers add suggestions" on public.post_draft_suggestions for insert to authenticated with check (public.can_review_post_draft(draft_id) and author_id = auth.uid());
create policy "Editors decide suggestions" on public.post_draft_suggestions for update to authenticated using (public.can_edit_post_draft(draft_id)) with check (public.can_edit_post_draft(draft_id));
create policy "Collaborators read activity" on public.post_draft_activity for select to authenticated using (public.can_access_post_draft(draft_id));
create policy "Owners read share links" on public.post_draft_share_links for select to authenticated using (public.can_manage_post_draft_collaborators(draft_id));
create policy "Owners revoke share links" on public.post_draft_share_links for update to authenticated using (public.can_manage_post_draft_collaborators(draft_id)) with check (public.can_manage_post_draft_collaborators(draft_id));
create policy "Users read collaboration notifications" on public.post_draft_notifications for select to authenticated using (recipient_id = auth.uid());
create policy "Users mark collaboration notifications read" on public.post_draft_notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Collaborators may read or edit media records for drafts they can access.
drop policy if exists "Users manage media on own drafts" on public.post_draft_media;
create policy "Collaborators read draft media" on public.post_draft_media for select to authenticated using (public.can_access_post_draft(draft_id));
create policy "Editors add draft media" on public.post_draft_media for insert to authenticated
  with check (public.can_edit_post_draft(draft_id)
    and author_id = (select auth.uid())
    and split_part(object_path, '/', 1) = (select auth.uid())::text
    and split_part(object_path, '/', 2) = draft_id::text);
create policy "Editors update draft media" on public.post_draft_media for update to authenticated
  using (public.can_edit_post_draft(draft_id)) with check (
    public.can_edit_post_draft(draft_id)
    and (author_id = (select auth.uid()) or author_id = public.post_draft_owner(draft_id))
    and split_part(object_path, '/', 2) = draft_id::text
    and (split_part(object_path, '/', 1) = (select auth.uid())::text or split_part(object_path, '/', 1) = public.post_draft_owner(draft_id)::text)
  );
create policy "Editors delete draft media" on public.post_draft_media for delete to authenticated
  using (public.can_edit_post_draft(draft_id));

drop policy if exists "Read media in own post drafts" on storage.objects;
create policy "Collaborators read draft media objects" on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and exists (
    select 1 from public.post_draft_media m where m.object_path = name and public.can_access_post_draft(m.draft_id)
  ));
drop policy if exists "Upload media to own post drafts" on storage.objects;
create policy "Editors upload draft media objects" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.can_edit_post_draft(((storage.foldername(name))[2])::uuid));
drop policy if exists "Delete media attached to own posts or drafts" on storage.objects;
create policy "Users delete their draft media objects" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media'
    and exists (select 1 from public.post_draft_media m where m.object_path = name and public.can_edit_post_draft(m.draft_id)));

-- Realtime presence and broadcast stay scoped to authorized members.
drop policy if exists "Post draft collaborators read realtime" on realtime.messages;
create policy "Post draft collaborators read realtime" on realtime.messages for select to authenticated
  using (case when topic ~ '^post-draft:[0-9a-fA-F-]{36}$' then public.can_access_post_draft(split_part(topic, ':', 2)::uuid) else false end);
drop policy if exists "Post draft collaborators write realtime" on realtime.messages;
create policy "Post draft collaborators write realtime" on realtime.messages for insert to authenticated
  with check (case when topic ~ '^post-draft:[0-9a-fA-F-]{36}$' then public.can_access_post_draft(split_part(topic, ':', 2)::uuid) else false end);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_drafts') then alter publication supabase_realtime add table public.post_drafts; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_draft_comments') then alter publication supabase_realtime add table public.post_draft_comments; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_draft_suggestions') then alter publication supabase_realtime add table public.post_draft_suggestions; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_draft_activity') then alter publication supabase_realtime add table public.post_draft_activity; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_draft_notifications') then alter publication supabase_realtime add table public.post_draft_notifications; end if;
  end if;
end;
$$;
