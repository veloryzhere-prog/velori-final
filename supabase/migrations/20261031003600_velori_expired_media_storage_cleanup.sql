-- Preserve expired media object paths before parent rows cascade, then let a
-- service-only Edge Function remove the private Storage bytes through its API.

create table if not exists public.storage_cleanup_queue (
  id bigint generated always as identity primary key,
  bucket_id text not null check (bucket_id in ('post-media', 'story-media', 'reel-media')),
  object_path text not null check (length(object_path) > 0),
  queued_at timestamptz not null default now(),
  claimed_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  unique (bucket_id, object_path)
);

create index if not exists storage_cleanup_claim_idx
  on public.storage_cleanup_queue (claimed_until, id);

alter table public.storage_cleanup_queue enable row level security;
revoke all on public.storage_cleanup_queue from public, anon, authenticated;
grant select, insert, update, delete on public.storage_cleanup_queue to service_role;
grant usage, select on sequence public.storage_cleanup_queue_id_seq to service_role;

comment on table public.storage_cleanup_queue is
  'Service-only outbox for Storage objects whose expired parent rows have been deleted.';

create or replace function public.cleanup_expired_stories()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  insert into public.storage_cleanup_queue (bucket_id, object_path)
  select 'story-media', sm.object_path
    from public.story_media sm
    join public.stories s on s.id = sm.story_id
   where s.expires_at <= now()
     and s.status <> 'archived'
     and sm.object_path <> ''
     and (storage.foldername(sm.object_path))[1] = s.author_id::text
  on conflict (bucket_id, object_path) do nothing;

  delete from public.stories
   where expires_at <= now()
     and status <> 'archived';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function public.cleanup_expired_posts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  insert into public.storage_cleanup_queue (bucket_id, object_path)
  select 'post-media', pm.object_path
    from public.post_media pm
    join public.posts p on p.id = pm.post_id
   where p.deleted_at is not null
     and p.delete_expires_at <= now()
     and pm.object_path <> ''
     and (storage.foldername(pm.object_path))[1] = p.author_id::text
  on conflict (bucket_id, object_path) do nothing;

  delete from public.posts
   where deleted_at is not null
     and delete_expires_at <= now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.cleanup_expired_stories() from public, anon, authenticated;
revoke all on function public.cleanup_expired_posts() from public, anon, authenticated;
grant execute on function public.cleanup_expired_stories() to service_role;
grant execute on function public.cleanup_expired_posts() to service_role;

create or replace function public.claim_storage_cleanup_batch(p_batch_size integer default 1000)
returns table(id bigint, bucket_id text, object_path text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select q.id
      from public.storage_cleanup_queue q
     where q.claimed_until is null or q.claimed_until <= now()
     order by q.id
     limit least(greatest(coalesce(p_batch_size, 1000), 1), 1000)
     for update skip locked
  )
  update public.storage_cleanup_queue q
     set claimed_until = now() + interval '10 minutes',
         attempts = q.attempts + 1,
         last_error = null
    from picked
   where q.id = picked.id
  returning q.id, q.bucket_id, q.object_path;
end;
$$;

create or replace function public.ack_storage_cleanup_batch(p_ids bigint[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.storage_cleanup_queue
   where id = any(coalesce(p_ids, array[]::bigint[]));
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function public.release_storage_cleanup_item(p_id bigint, p_error text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.storage_cleanup_queue
     set claimed_until = null,
         last_error = left(coalesce(p_error, 'Storage deletion failed.'), 500)
   where id = p_id;
  return found;
end;
$$;

revoke all on function public.claim_storage_cleanup_batch(integer) from public, anon, authenticated;
revoke all on function public.ack_storage_cleanup_batch(bigint[]) from public, anon, authenticated;
revoke all on function public.release_storage_cleanup_item(bigint, text) from public, anon, authenticated;
grant execute on function public.claim_storage_cleanup_batch(integer) to service_role;
grant execute on function public.ack_storage_cleanup_batch(bigint[]) to service_role;
grant execute on function public.release_storage_cleanup_item(bigint, text) to service_role;

-- Replace the direct DELETE cron command so every expired trashed post enqueues
-- its bytes before the database rows and metadata cascade away.
do $$
declare
  existing_job record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for existing_job in
      select jobid from cron.job where jobname = 'velori-purge-expired-posts'
    loop
      perform cron.unschedule(existing_job.jobid);
    end loop;
    perform cron.schedule(
      'velori-purge-expired-posts',
      '15 3 * * *',
      'select public.cleanup_expired_posts()'
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
