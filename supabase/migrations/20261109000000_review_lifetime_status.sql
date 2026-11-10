-- Add lifetime submission state without changing the existing review table or policies.
create or replace function public.get_my_app_review_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_last_review timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select created_at into v_last_review
    from public.app_reviews
   where profile_id = auth.uid()
   order by created_at desc
   limit 1;

  return jsonb_build_object(
    'has_submitted', v_last_review is not null,
    'can_submit', v_last_review is null or v_last_review <= now() - interval '30 days',
    'next_eligible_at',
      case
        when v_last_review is null or v_last_review <= now() - interval '30 days' then null
        else v_last_review + interval '30 days'
      end
  );
end;
$$;

revoke all on function public.get_my_app_review_status() from public, anon;
grant execute on function public.get_my_app_review_status() to authenticated;
