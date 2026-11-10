-- Metadata-only administrator access to groups. Group posts and chat messages
-- remain outside this moderation surface.

alter table public.groups
  add column if not exists moderation_reason text not null default '',
  add column if not exists moderated_by uuid references auth.users(id) on delete set null,
  add column if not exists moderated_at timestamptz;

alter table public.groups
  drop constraint if exists groups_moderation_reason_length_check;

alter table public.groups
  add constraint groups_moderation_reason_length_check
  check (char_length(moderation_reason) <= 2000) not valid;

alter table public.groups
  validate constraint groups_moderation_reason_length_check;

create index if not exists groups_locked_created_idx
  on public.groups (is_locked, created_at desc);

insert into public.admin_permissions (key, category, label, description, risk, sort_order)
values
  ('groups.view', 'Groups', 'View groups', 'View group metadata and membership counts without reading posts or chats.', 'standard', 77),
  ('groups.lock', 'Groups', 'Lock groups', 'Lock or unlock group membership and public visibility with an audited reason.', 'elevated', 78)
on conflict (key) do update set
  category = excluded.category,
  label = excluded.label,
  description = excluded.description,
  risk = excluded.risk,
  sort_order = excluded.sort_order;

insert into public.admin_role_permissions (role_key, permission_key)
select roles.key, permissions.key
  from public.admin_roles roles
 cross join public.admin_permissions permissions
 where roles.key in ('super_admin', 'admin', 'moderator')
   and permissions.key in ('groups.view', 'groups.lock')
on conflict do nothing;

comment on column public.groups.moderation_reason is
  'Reason for the last administrator group lock or unlock. This does not expose group messages.';
comment on column public.groups.moderated_by is
  'Administrator who last locked or unlocked the group.';
