-- Deliver administrator campaigns into the same recipient-owned timeline used by
-- social and security notifications. Delivery is server-only and transactional.

alter table public.system_notifications
  add column if not exists audience_account_types text[] not null default '{}'::text[],
  add column if not exists audience_role_keys text[] not null default '{}'::text[];

alter table public.system_notifications
  drop constraint if exists system_notifications_account_types_check;
alter table public.system_notifications
  add constraint system_notifications_account_types_check
  check (audience_account_types <@ array['personal', 'creator', 'business']::text[]);

alter table public.notifications
  add column if not exists system_notification_id uuid
    references public.system_notifications(id) on delete cascade,
  add column if not exists expires_at timestamptz;

create unique index if not exists notifications_campaign_recipient_unique
  on public.notifications (system_notification_id, recipient_id)
  where system_notification_id is not null;

create index if not exists notifications_unexpired_recipient_idx
  on public.notifications (recipient_id, expires_at, created_at desc)
  where system_notification_id is not null;

create or replace function public.sync_notification_campaign_receipt_read_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.system_notification_id is not null
     and new.read_at is distinct from old.read_at then
    update public.system_notification_receipts
       set read_at = new.read_at
     where notification_id = new.system_notification_id
       and profile_id = new.recipient_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_notification_campaign_receipt_read_at()
  from public, anon, authenticated;

drop trigger if exists sync_notification_campaign_receipt_read_at on public.notifications;
create trigger sync_notification_campaign_receipt_read_at
  after update of read_at on public.notifications
  for each row
  when (new.system_notification_id is not null)
  execute function public.sync_notification_campaign_receipt_read_at();

create or replace function public.admin_dispatch_system_notification(
  p_notification_id uuid
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  campaign public.system_notifications%rowtype;
  delivered integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Administrator notification delivery is service-only'
      using errcode = '42501';
  end if;

  select * into campaign
    from public.system_notifications
   where id = p_notification_id
   for update;
  if not found then
    raise exception 'Notification campaign was not found' using errcode = 'P0002';
  end if;

  -- A committed delivery is immutable and safe to retry after a lost response.
  if campaign.sent_at is not null then
    return campaign.recipient_count;
  end if;
  if campaign.starts_at > now() then
    raise exception 'Scheduled notification delivery is not enabled';
  end if;
  if campaign.ends_at is not null and campaign.ends_at <= now() then
    raise exception 'Notification campaign has already expired';
  end if;

  with recipients as materialized (
    select profile.id
      from public.profiles profile
      left join public.notification_preferences preference
        on preference.profile_id = profile.id
     where coalesce(preference.system, true)
       and case campaign.audience
         when 'all' then true
         when 'selected_users' then profile.id = any(campaign.audience_ids)
         when 'account_types' then profile.account_type = any(campaign.audience_account_types)
         when 'admins' then exists (
           select 1 from public.admin_profiles admin
            where admin.user_id = profile.id and admin.is_active
         )
         when 'roles' then exists (
           select 1 from public.admin_profiles admin
            where admin.user_id = profile.id
              and admin.is_active
              and admin.role_key = any(campaign.audience_role_keys)
         )
         else false
       end
  ), inserted_receipts as (
    insert into public.system_notification_receipts (notification_id, profile_id)
    select campaign.id, recipients.id from recipients
    on conflict (notification_id, profile_id) do nothing
    returning profile_id
  )
  insert into public.notifications (
    recipient_id,
    kind,
    title,
    body,
    link,
    entity_type,
    entity_id,
    system_notification_id,
    expires_at
  )
  select
    inserted_receipts.profile_id,
    'system',
    campaign.title,
    campaign.message,
    campaign.link,
    'system',
    campaign.id,
    campaign.id,
    campaign.ends_at
  from inserted_receipts
  on conflict (system_notification_id, recipient_id)
    where system_notification_id is not null
    do nothing;

  select count(*)::integer into delivered
    from public.system_notification_receipts receipt
   where receipt.notification_id = campaign.id;

  update public.system_notifications
     set recipient_count = delivered,
         sent_at = clock_timestamp(),
         updated_at = clock_timestamp()
   where id = campaign.id;

  return delivered;
end;
$$;

revoke all on function public.admin_dispatch_system_notification(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_dispatch_system_notification(uuid)
  to service_role;

comment on function public.admin_dispatch_system_notification(uuid) is
  'Atomically materializes an administrator campaign into each eligible recipient notification timeline.';
