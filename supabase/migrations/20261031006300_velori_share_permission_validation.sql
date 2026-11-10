-- Share links travel inside messages as typed references. Validate their
-- visibility and the content owner's reshare setting before storing a link.

create or replace function private.viewer_can_reshare_content(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.viewer_not_blocked(owner)
    and coalesce((select s.allow_reshare_globally from public.account_settings s where s.profile_id = owner), true)
    and private.viewer_meets_permission(
      owner,
      coalesce((select s.reshare_permission from public.account_settings s where s.profile_id = owner), 'everyone')
    );
$$;

revoke all on function private.viewer_can_reshare_content(uuid) from public;
grant execute on function private.viewer_can_reshare_content(uuid) to authenticated;

create or replace function private.validate_shared_content_message()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  content_owner uuid;
  can_open boolean := false;
begin
  if new.shared_content_type is null then
    return new;
  end if;
  if auth.uid() is null or new.sender_id is distinct from auth.uid() then
    return new;
  end if;

  if new.shared_content_type = 'post' then
    select p.author_id into content_owner
      from public.posts p
     where p.id = new.shared_content_id
       and p.is_published
       and p.archived_at is null
       and p.deleted_at is null
       and (p.delete_expires_at is null or p.delete_expires_at > now())
       and p.allow_sharing
       and p.visibility in ('public', 'followers')
       and private.viewer_can_view_profile(p.author_id)
       and (p.visibility = 'public' or private.viewer_is_approved_follower(p.author_id));
  elsif new.shared_content_type = 'reel' then
    select r.author_id into content_owner
      from public.reels r
     where r.id = new.shared_content_id
       and r.status = 'published'
       and not r.is_deleted
       and r.moderation_state = 'clean'
       and r.allow_sharing
       and r.visibility in ('public', 'followers')
       and private.viewer_can_view_profile(r.author_id)
       and (r.visibility = 'public' or private.viewer_is_approved_follower(r.author_id));
  elsif new.shared_content_type = 'story' then
    select s.author_id into content_owner
      from public.stories s
     where s.id = new.shared_content_id
       and s.status = 'active'
       and s.expires_at > now()
       and private.viewer_can_read_story(s.id);
    can_open := found
      and private.can_reply_to_story(new.shared_content_id, auth.uid())
      and exists (
        select 1 from public.conversation_participants cp
         where cp.conversation_id = new.conversation_id
           and cp.user_id = content_owner
      );
    if can_open then
      return new;
    end if;
  end if;

  if content_owner is null or not private.viewer_can_reshare_content(content_owner) then
    raise exception 'This content cannot be shared with its current privacy settings.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_shared_content_message() from public, anon, authenticated;
drop trigger if exists validate_shared_content_message on public.messages;
create trigger validate_shared_content_message
  before insert or update of shared_content_type, shared_content_id on public.messages
  for each row execute function private.validate_shared_content_message();

do $$
begin
  if not has_function_privilege('authenticated', 'private.viewer_can_reshare_content(uuid)', 'execute') then
    raise exception 'The share permission helper is not available to authenticated users.';
  end if;
end;
$$;
