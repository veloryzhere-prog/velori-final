-- Cap message bodies at 5,000 characters. NOT VALID preserves any older
-- imported rows while Postgres enforces the bound on all new and updated rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_body_length_check'
  ) then
    alter table public.messages
      add constraint messages_body_length_check
      check (char_length(body) <= 5000) not valid;
  end if;
end;
$$;
