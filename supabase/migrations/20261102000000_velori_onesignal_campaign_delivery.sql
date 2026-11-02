alter table public.system_notifications
  add column if not exists client_request_id uuid,
  add column if not exists push_requested boolean not null default false,
  add column if not exists push_status text not null default 'not_requested',
  add column if not exists push_target_count integer not null default 0,
  add column if not exists push_provider_recipient_count integer,
  add column if not exists push_provider_notification_ids text[] not null default '{}'::text[],
  add column if not exists push_error_code text,
  add column if not exists push_accepted_at timestamptz;

create unique index if not exists system_notifications_client_request_unique
  on public.system_notifications (client_request_id)
  where client_request_id is not null;

alter table public.system_notifications
  drop constraint if exists system_notifications_push_status_check;
alter table public.system_notifications
  add constraint system_notifications_push_status_check
  check (push_status in (
    'pending',
    'not_requested',
    'not_configured',
    'no_recipients',
    'accepted',
    'partial',
    'failed'
  ));

create table if not exists public.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('chat')),
  event_id uuid not null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'partial', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  provider_notification_ids text[] not null default '{}'::text[],
  provider_recipient_count integer,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, event_id, recipient_id)
);

create index if not exists notification_push_deliveries_recipient_idx
  on public.notification_push_deliveries (recipient_id, created_at desc);

alter table public.notification_push_deliveries enable row level security;
revoke all on public.notification_push_deliveries from public, anon, authenticated;
grant all on public.notification_push_deliveries to service_role;

comment on table public.notification_push_deliveries is
  'Server-only idempotency and provider outcome records for native push delivery events.';
