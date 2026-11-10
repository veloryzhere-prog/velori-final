-- Create group records, group ownership, and group chats in one authorized
-- transaction. Membership changes mirror into the chat participant table so the
-- existing conversation/message RLS rules enforce group access.

alter table public.conversations
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

-- New membership must pass through the database join/invite functions, which
-- enforce privacy and join_policy. This closes the old direct-insert path that
-- let a caller add themselves as active in a private or invite-only group.
drop policy if exists "Users request membership or admins invite" on public.group_members;
create policy "Users request membership or admins invite" on public.group_members
  for insert to authenticated
  with check (
    private.viewer_outranks_group_member(group_id, auth.uid(), user_id)
    and role in ('member', 'moderator')
    and status in ('requested', 'invited', 'active')
  );

drop policy if exists "Members read private groups" on public.groups;
create policy "Members read private groups" on public.groups
  for select to authenticated
  using (
    privacy = 'public'
    or private.viewer_is_group_member(id, auth.uid())
    or private.viewer_outranks_group_member(id, auth.uid(), owner_id)
    or exists (
      select 1 from public.group_members invited
       where invited.group_id = groups.id
         and invited.user_id = auth.uid()
         and invited.status in ('requested', 'invited')
    )
  );

create unique index if not exists conversations_group_id_key
  on public.conversations (group_id)
  where group_id is not null;

-- The group chat identity fields are service-created. Group owners may edit only
-- its display title and avatar through the existing owner policy.
revoke update on public.conversations from authenticated;
grant update (title, avatar_url) on public.conversations to authenticated;

create or replace function private.sync_group_chat_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_conversation_id uuid;
  new_conversation_id uuid;
begin
  if tg_op <> 'INSERT' and old.status = 'active' then
    if tg_op = 'DELETE' then
      select c.id into old_conversation_id
        from public.conversations c where c.group_id = old.group_id;
      if old_conversation_id is not null then
        delete from public.conversation_participants
         where conversation_id = old_conversation_id and user_id = old.user_id;
      end if;
    elsif new.status <> 'active'
       or old.group_id is distinct from new.group_id
       or old.user_id is distinct from new.user_id then
      select c.id into old_conversation_id
        from public.conversations c where c.group_id = old.group_id;
      if old_conversation_id is not null then
        delete from public.conversation_participants
         where conversation_id = old_conversation_id and user_id = old.user_id;
      end if;
    end if;
  end if;

  if tg_op <> 'DELETE' and new.status = 'active' then
    select c.id into new_conversation_id
      from public.conversations c where c.group_id = new.group_id;
    if new_conversation_id is not null then
      insert into public.conversation_participants (conversation_id, user_id, role)
      values (
        new_conversation_id,
        new.user_id,
        case when new.role in ('owner', 'admin') then new.role else 'member' end
      )
      on conflict (conversation_id, user_id) do update
        set role = excluded.role;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.sync_group_chat_participant() from public, anon, authenticated;

drop trigger if exists group_chat_participants_sync on public.group_members;
create trigger group_chat_participants_sync
  after insert or update or delete on public.group_members
  for each row execute function private.sync_group_chat_participant();

-- Backfill one chat per existing group and ensure its declared owner is an
-- active owner member before syncing the active roster into chat access.
insert into public.conversations (kind, title, owner_id, group_id)
select 'group', g.name, g.owner_id, g.id
  from public.groups g
 where not exists (select 1 from public.conversations c where c.group_id = g.id)
on conflict (group_id) where group_id is not null do nothing;

insert into public.group_members (group_id, user_id, role, status, joined_at, responded_at)
select g.id, g.owner_id, 'owner', 'active', g.created_at, now()
  from public.groups g
on conflict (group_id, user_id) do update
  set role = 'owner', status = 'active', joined_at = coalesce(group_members.joined_at, excluded.joined_at), responded_at = now();

insert into public.conversation_participants (conversation_id, user_id, role)
select c.id, m.user_id,
       case when m.role in ('owner', 'admin') then m.role else 'member' end
  from public.conversations c
  join public.group_members m on m.group_id = c.group_id and m.status = 'active'
 where c.group_id is not null
on conflict (conversation_id, user_id) do update
  set role = excluded.role;

create or replace function public.create_group(
  p_name text,
  p_slug text,
  p_description text default '',
  p_privacy text default 'public'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  created_group_id uuid;
begin
  if viewer is null then
    raise exception 'You must be signed in to create a group.' using errcode = '42501';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 80 then
    raise exception 'Group names must be between 1 and 80 characters.' using errcode = '22023';
  end if;
  if p_description is not null and char_length(p_description) > 2000 then
    raise exception 'Group descriptions must be 2000 characters or fewer.' using errcode = '22023';
  end if;
  if p_privacy is null or p_privacy not in ('public', 'private', 'hidden') then
    raise exception 'Choose a valid group privacy setting.' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 64 then
    raise exception 'The group URL is invalid.' using errcode = '22023';
  end if;

  insert into public.groups (slug, name, description, privacy, owner_id)
  values (p_slug, trim(p_name), coalesce(p_description, ''), p_privacy, viewer)
  returning id into created_group_id;

  insert into public.conversations (kind, title, owner_id, group_id)
  values ('group', trim(p_name), viewer, created_group_id);

  insert into public.group_settings (group_id, join_policy)
  values (
    created_group_id,
    case when p_privacy = 'public' then 'open'
         when p_privacy = 'hidden' then 'invite_only'
         else 'approval' end
  );

  insert into public.group_members (group_id, user_id, role, status, joined_at, responded_at)
  values (created_group_id, viewer, 'owner', 'active', now(), now());

  return created_group_id;
end;
$$;

revoke all on function public.create_group(text, text, text, text) from public, anon;
grant execute on function public.create_group(text, text, text, text) to authenticated;

create or replace function public.accept_group_invite(p_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null then
    raise exception 'You must be signed in to accept a group invitation.' using errcode = '42501';
  end if;
  update public.group_members
     set status = 'active', joined_at = now(), responded_at = now(), updated_at = now()
   where group_id = p_group_id and user_id = viewer and status = 'invited';
  return found;
end;
$$;

revoke all on function public.accept_group_invite(uuid) from public, anon;
grant execute on function public.accept_group_invite(uuid) to authenticated;

create or replace function public.invite_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer uuid := auth.uid();
  target public.groups%rowtype;
begin
  if viewer is null then
    raise exception 'You must be signed in to invite a group member.' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = viewer then
    raise exception 'Choose another account to invite.' using errcode = '22023';
  end if;
  if private.group_role_rank((
       select m.role from public.group_members m
        where m.group_id = p_group_id and m.user_id = viewer and m.status = 'active'
     )) < 3 then
    raise exception 'Only a group owner or admin can invite members.' using errcode = '42501';
  end if;

  select * into target from public.groups where id = p_group_id for update;
  if not found then
    raise exception 'That group was not found.' using errcode = 'P0002';
  end if;
  if target.is_locked then
    raise exception 'That group is not accepting new members.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'That account was not found.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.group_members m
     where m.group_id = p_group_id and m.user_id = p_user_id and m.status in ('active', 'banned')
  ) then
    raise exception 'That account is already a member or cannot be invited.' using errcode = '22023';
  end if;

  insert into public.group_members (group_id, user_id, role, status, invited_by, responded_at)
  values (p_group_id, p_user_id, 'member', 'invited', viewer, now())
  on conflict (group_id, user_id) do update
    set role = 'member', status = 'invited', invited_by = viewer,
        joined_at = null, responded_at = now(), updated_at = now();

  perform public.enqueue_social_notification(
    p_user_id, viewer, 'group_invite', 'Group invitation',
    'You have been invited to join a group.', '/groups/' || target.slug, 'group', p_group_id
  );
  return true;
end;
$$;

revoke all on function public.invite_group_member(uuid, uuid) from public, anon;
grant execute on function public.invite_group_member(uuid, uuid) to authenticated;

create or replace function private.sync_group_chat_title()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.name is distinct from new.name then
    update public.conversations set title = new.name where group_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_group_chat_title() from public, anon, authenticated;

drop trigger if exists group_chat_title_sync on public.groups;
create trigger group_chat_title_sync
  after update of name on public.groups
  for each row execute function private.sync_group_chat_title();

-- Group avatars use private objects. Public groups expose avatars; private
-- groups expose them only to active members and users with an outstanding
-- request or invitation.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-media', 'group-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Readers download visible group avatars" on storage.objects;
create policy "Readers download visible group avatars" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'group-media'
    and exists (
      select 1 from public.groups g
       where g.avatar_url = storage.objects.name
         and (
           (g.privacy = 'public' and not g.is_locked)
           or exists (
             select 1 from public.group_members m
              where m.group_id = g.id and m.user_id = auth.uid() and m.status = 'active'
           )
           or exists (
             select 1 from public.group_members m
              where m.group_id = g.id and m.user_id = auth.uid() and m.status in ('requested', 'invited')
           )
         )
    )
  );

drop policy if exists "Group owners upload avatars" on storage.objects;
create policy "Group owners upload avatars" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'group-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.groups g
       where g.id::text = (storage.foldername(name))[2]
         and (
           g.owner_id = (select auth.uid())
           or exists (
             select 1 from public.group_members m
              where m.group_id = g.id and m.user_id = (select auth.uid())
                and m.role = 'admin' and m.status = 'active'
           )
         )
    )
  );

drop policy if exists "Group owners delete avatars" on storage.objects;
create policy "Group owners delete avatars" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'group-media'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
