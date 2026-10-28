alter table public.messages
  drop constraint if exists messages_body_present;

alter table public.messages
  add constraint messages_body_present
  check (
    deleted_at is not null
    or kind <> 'text'
    or length(trim(body)) > 0
  );
