create table if not exists public.app_reviews (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  review_text text not null check (char_length(btrim(review_text)) between 3 and 1200),
  is_anonymous boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'hidden')),
  admin_response text check (admin_response is null or char_length(admin_response) <= 1200),
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_reviews_status_created_idx
  on public.app_reviews (status, created_at desc, id desc);
create index if not exists app_reviews_rating_status_idx
  on public.app_reviews (rating, status);
create index if not exists app_reviews_profile_created_idx
  on public.app_reviews (profile_id, created_at desc);

alter table public.app_reviews enable row level security;
revoke all on public.app_reviews from public, anon, authenticated;
grant select, insert, update, delete on public.app_reviews to service_role;

create or replace function public.touch_app_review_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_reviews_touch_updated_at on public.app_reviews;
create trigger app_reviews_touch_updated_at
  before update on public.app_reviews
  for each row execute function public.touch_app_review_updated_at();
revoke all on function public.touch_app_review_updated_at() from public, anon, authenticated;

create or replace function public.submit_app_review(
  p_rating integer,
  p_review_text text,
  p_is_anonymous boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_review_text text := btrim(regexp_replace(coalesce(p_review_text, ''), '[[:cntrl:]]', ' ', 'g'));
  v_review_id uuid;
begin
  if v_profile_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception using errcode = '22023', message = 'invalid_rating';
  end if;
  if char_length(v_review_text) < 3 or char_length(v_review_text) > 1200 then
    raise exception using errcode = '22023', message = 'invalid_review_text';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_profile_id::text, 0));
  if exists (
    select 1
      from public.app_reviews
     where profile_id = v_profile_id
       and created_at > now() - interval '30 days'
  ) then
    raise exception using errcode = 'P0001', message = 'review_rate_limited';
  end if;

  insert into public.app_reviews (profile_id, rating, review_text, is_anonymous)
  values (v_profile_id, p_rating::smallint, v_review_text, coalesce(p_is_anonymous, false))
  returning id into v_review_id;
  return v_review_id;
end;
$$;

revoke all on function public.submit_app_review(integer, text, boolean) from public, anon;
grant execute on function public.submit_app_review(integer, text, boolean) to authenticated;

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
    'can_submit', v_last_review is null or v_last_review <= now() - interval '30 days',
    'next_eligible_at',
      case
        when v_last_review is null or v_last_review <= now() - interval '30 days' then null
        else v_last_review + interval '30 days'
      end
  );
end;
$$;

create or replace function public.get_public_app_reviews(p_limit integer default 6, p_offset integer default 0)
returns table (
  id uuid,
  rating smallint,
  review_text text,
  is_anonymous boolean,
  reviewer_display_name text,
  admin_response text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id,
         r.rating,
         r.review_text,
         r.is_anonymous,
         case
           when r.is_anonymous then 'Anonymous'
           when p.is_private then 'VELORI member'
           else coalesce(nullif(btrim(p.display_name), ''), 'VELORI member')
         end,
         r.admin_response,
         r.created_at
    from public.app_reviews as r
    left join public.profiles as p on p.id = r.profile_id
   where r.status = 'approved'
   order by r.created_at desc, r.id desc
   limit least(greatest(coalesce(p_limit, 6), 1), 12)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000);
$$;

create or replace function public.get_public_app_review_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'total',
      (select count(*) from public.app_reviews where status = 'approved'),
    'average',
      coalesce(
        (select round(avg(rating)::numeric, 2) from public.app_reviews where status = 'approved'),
        0
      ),
    'distribution',
      jsonb_build_object(
        '1', (select count(*) from public.app_reviews where status = 'approved' and rating = 1),
        '2', (select count(*) from public.app_reviews where status = 'approved' and rating = 2),
        '3', (select count(*) from public.app_reviews where status = 'approved' and rating = 3),
        '4', (select count(*) from public.app_reviews where status = 'approved' and rating = 4),
        '5', (select count(*) from public.app_reviews where status = 'approved' and rating = 5)
      )
  );
$$;

create or replace function public.admin_app_review_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;

  return jsonb_build_object(
    'total', (select count(*) from public.app_reviews),
    'pending', (select count(*) from public.app_reviews where status = 'pending'),
    'approved', (select count(*) from public.app_reviews where status = 'approved'),
    'rejected', (select count(*) from public.app_reviews where status = 'rejected'),
    'hidden', (select count(*) from public.app_reviews where status = 'hidden'),
    'average',
      coalesce(
        (select round(avg(rating)::numeric, 2) from public.app_reviews where status = 'approved'),
        0
      ),
    'distribution',
      jsonb_build_object(
        '1', (select count(*) from public.app_reviews where status = 'approved' and rating = 1),
        '2', (select count(*) from public.app_reviews where status = 'approved' and rating = 2),
        '3', (select count(*) from public.app_reviews where status = 'approved' and rating = 3),
        '4', (select count(*) from public.app_reviews where status = 'approved' and rating = 4),
        '5', (select count(*) from public.app_reviews where status = 'approved' and rating = 5)
      )
  );
end;
$$;

revoke all on function public.get_public_app_reviews(integer, integer) from public;
revoke all on function public.get_public_app_review_summary() from public;
revoke all on function public.admin_app_review_summary() from public, anon, authenticated;
revoke all on function public.get_my_app_review_status() from public, anon;
grant execute on function public.get_public_app_reviews(integer, integer) to anon, authenticated;
grant execute on function public.get_public_app_review_summary() to anon, authenticated;
grant execute on function public.admin_app_review_summary() to service_role;
grant execute on function public.get_my_app_review_status() to authenticated;

insert into public.admin_permissions (key, category, label, description, risk, sort_order)
values
  ('reviews.view', 'Reviews', 'View reviews', 'View the review queue and review analytics.', 'standard', 75),
  ('reviews.moderate', 'Reviews', 'Moderate reviews', 'Approve, reject, hide, restore, and respond to reviews.', 'elevated', 76),
  ('reviews.delete', 'Reviews', 'Delete reviews', 'Permanently delete an app review.', 'elevated', 77)
on conflict (key) do update
  set category = excluded.category,
      label = excluded.label,
      description = excluded.description,
      risk = excluded.risk,
      sort_order = excluded.sort_order;

insert into public.admin_role_permissions (role_key, permission_key)
values
  ('super_admin', 'reviews.view'),
  ('super_admin', 'reviews.moderate'),
  ('super_admin', 'reviews.delete'),
  ('admin', 'reviews.view'),
  ('admin', 'reviews.moderate'),
  ('admin', 'reviews.delete'),
  ('moderator', 'reviews.view'),
  ('moderator', 'reviews.moderate')
on conflict do nothing;
