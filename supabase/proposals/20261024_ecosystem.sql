-- REVIEW ONLY: NOT APPLIED. Keep outside migrations until explicit approval.
-- Adds the relational foundation requested by docs/velori/MASTER_REQUEST.md.
-- Reuses auth.users, public.profiles, public.cms_pages and cms_page_versions.
-- Does not alter existing social tables, grants, authentication or moderation.
-- All writes require the trusted backend. Admin handlers must reuse existing
-- requirePermission, recent reauthentication and writeAudit before service writes.
begin;

create table public.ecosystem_categories (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('journal','help','documentation')),
 slug text not null check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 title text not null check(char_length(title) between 1 and 120),
 description text not null default '' check(char_length(description)<=1000),
 position integer not null default 0,
 published boolean not null default false,
 unique(kind,slug)
);
create table public.ecosystem_articles (
 id uuid primary key default gen_random_uuid(),
 page_id uuid not null unique references public.cms_pages(id) on delete restrict,
 page_route text not null unique check(page_route ~ '^/[^[:space:]]+$'),
 category_id uuid references public.ecosystem_categories(id) on delete set null,
 kind text not null check(kind in ('journal','help','documentation')),
 slug text not null unique check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 author_id uuid references public.profiles(id) on delete set null,
 author_display_name text check(char_length(author_display_name)<=120),
 tags text[] not null default '{}' check(cardinality(tags)<=20),
 status text not null default 'draft' check(status in ('draft','review','scheduled','published','archived')),
 published_at timestamptz, scheduled_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status<>'published' or published_at is not null)
);
create index ecosystem_articles_published_idx on public.ecosystem_articles(kind,published_at desc,id) where status='published';
create index ecosystem_articles_category_idx on public.ecosystem_articles(category_id,published_at desc,id);
create index ecosystem_articles_author_idx on public.ecosystem_articles(author_id);

create table public.ecosystem_article_feedback (
 id uuid primary key default gen_random_uuid(),
 article_id uuid not null references public.ecosystem_articles(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 helpful boolean not null,
 comment text not null default '' check(char_length(comment)<=1000),
 created_at timestamptz not null default now(), unique(article_id,user_id)
);
create index ecosystem_feedback_user_idx on public.ecosystem_article_feedback(user_id);

create table public.ecosystem_support_tickets (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 client_nonce uuid not null,
 category text not null check(category in ('account','technical','content','privacy','safety','copyright','developer','general')),
 subject text not null check(char_length(subject) between 3 and 160),
 description text not null check(char_length(description) between 10 and 10000),
 status text not null default 'open' check(status in ('open','awaiting_user','in_progress','resolved','closed')),
 priority text not null default 'normal' check(priority in ('low','normal','high')),
 assigned_admin_id uuid references public.admin_accounts(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,client_nonce)
);
create index ecosystem_tickets_owner_idx on public.ecosystem_support_tickets(user_id,created_at desc,id);
create index ecosystem_tickets_queue_idx on public.ecosystem_support_tickets(status,created_at,id);
create index ecosystem_tickets_assignee_idx on public.ecosystem_support_tickets(assigned_admin_id,status);
create table public.ecosystem_ticket_messages (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.ecosystem_support_tickets(id) on delete cascade,
 author_user_id uuid references auth.users(id) on delete set null,
 author_admin_id uuid references public.admin_accounts(id) on delete set null,
 body text not null check(char_length(body) between 1 and 10000),
 created_at timestamptz not null default now(),
 check((author_user_id is null)<>(author_admin_id is null))
);
create index ecosystem_ticket_messages_ticket_idx on public.ecosystem_ticket_messages(ticket_id,created_at,id);
create table public.ecosystem_ticket_notes (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.ecosystem_support_tickets(id) on delete cascade,
 admin_id uuid not null references public.admin_accounts(id) on delete restrict,
 body text not null check(char_length(body) between 1 and 10000), created_at timestamptz not null default now()
);
create index ecosystem_ticket_notes_ticket_idx on public.ecosystem_ticket_notes(ticket_id,created_at,id);

create table public.ecosystem_organizations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 name text not null check(char_length(name) between 2 and 160),
 website text check(website is null or website ~ '^https://[^ /]+'),
 description text not null default '' check(char_length(description)<=10000),
 verification_status text not null default 'unreviewed' check(verification_status in ('unreviewed','review','verified','rejected','suspended')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index ecosystem_organizations_owner_idx on public.ecosystem_organizations(owner_id);
create table public.ecosystem_organization_members (
 organization_id uuid not null references public.ecosystem_organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','recruiter','viewer')),
 active boolean not null default true,
 primary key(organization_id,user_id)
);
create index ecosystem_organization_members_user_idx on public.ecosystem_organization_members(user_id,organization_id) where active;
create table public.ecosystem_jobs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.ecosystem_organizations(id) on delete restrict,
 slug text not null unique check(slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 title text not null check(char_length(title) between 3 and 160),
 description text not null check(char_length(description) between 30 and 30000),
 responsibilities text[] not null default '{}', qualifications text[] not null default '{}', skills text[] not null default '{}',
 location text not null default '' check(char_length(location)<=240),
 work_mode text not null check(work_mode in ('remote','hybrid','onsite')),
 employment_type text not null check(employment_type in ('full_time','part_time','contract','internship')),
 experience_level text not null default 'unspecified' check(experience_level in ('entry','mid','senior','unspecified')),
 salary_min numeric(14,2), salary_max numeric(14,2), currency text check(currency is null or currency ~ '^[A-Z]{3}$'),
 status text not null default 'draft' check(status in ('draft','review','open','closed','rejected','archived')),
 closes_at timestamptz, published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(salary_min is null or salary_min>=0), check(salary_max is null or salary_max>=0),
 check(salary_min is null or salary_max is null or salary_max>=salary_min),
 check(status<>'open' or published_at is not null)
);
create index ecosystem_jobs_organization_idx on public.ecosystem_jobs(organization_id,status,created_at desc,id);
create index ecosystem_jobs_open_idx on public.ecosystem_jobs(published_at desc,id) where status='open';
create index ecosystem_jobs_search_idx on public.ecosystem_jobs using gin(to_tsvector('simple',title||' '||description||' '||location));
create table public.ecosystem_job_applications (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.ecosystem_jobs(id) on delete restrict,
 applicant_id uuid not null references auth.users(id) on delete cascade,
 cover_letter text not null default '' check(char_length(cover_letter)<=10000),
 status text not null default 'draft' check(status in ('draft','submitted','under_review','shortlisted','interview','offered','rejected','withdrawn','closed')),
 submitted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(job_id,applicant_id)
);
create index ecosystem_job_applications_owner_idx on public.ecosystem_job_applications(applicant_id,created_at desc,id);
create index ecosystem_job_applications_job_idx on public.ecosystem_job_applications(job_id,status,created_at,id);
create table public.ecosystem_saved_jobs (
 user_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null references public.ecosystem_jobs(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,job_id)
);
create index ecosystem_saved_jobs_job_idx on public.ecosystem_saved_jobs(job_id);

create table public.ecosystem_developer_applications (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 3 and 160),
 description text not null check(char_length(description) between 20 and 10000),
 website text check(website is null or website ~ '^https://[^ /]+'),
 purpose text not null check(char_length(purpose) between 20 and 5000),
 requested_scopes text[] not null default '{}', approved_scopes text[] not null default '{}',
 redirect_uris text[] not null default '{}',
 privacy_url text check(privacy_url is null or privacy_url ~ '^https://[^ /]+'),
 data_handling text not null check(char_length(data_handling) between 20 and 10000),
 expected_daily_requests integer check(expected_daily_requests between 0 and 10000000),
 status text not null default 'draft' check(status in ('draft','submitted','review','changes_requested','approved','rejected','suspended','revoked')),
 reviewed_by uuid references public.admin_accounts(id) on delete set null,
 reviewed_at timestamptz, decision_reason text check(char_length(decision_reason)<=5000),
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(approved_scopes <@ requested_scopes)
);
create index ecosystem_developer_apps_owner_idx on public.ecosystem_developer_applications(owner_id,created_at desc,id);
create index ecosystem_developer_apps_queue_idx on public.ecosystem_developer_applications(status,created_at,id);
create table public.ecosystem_developer_credentials (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.ecosystem_developer_applications(id) on delete cascade,
 identifier text not null unique,
 secret_hash text not null check(secret_hash ~ '^[a-f0-9]{64}$'),
 scopes text[] not null default '{}',
 expires_at timestamptz not null, revoked_at timestamptz,
 created_at timestamptz not null default now(), check(expires_at>created_at)
);
create index ecosystem_developer_credentials_application_idx on public.ecosystem_developer_credentials(application_id);
create table public.ecosystem_developer_webhooks (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.ecosystem_developer_applications(id) on delete cascade,
 endpoint text not null check(endpoint ~ '^https://[^ /]+'),
 event_types text[] not null default '{}',
 signing_secret_reference text not null, -- Reference to a server-held secret; not plaintext.
 enabled boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index ecosystem_webhooks_application_idx on public.ecosystem_developer_webhooks(application_id);
create table public.ecosystem_webhook_deliveries (
 id uuid primary key default gen_random_uuid(),
 webhook_id uuid not null references public.ecosystem_developer_webhooks(id) on delete cascade,
 event_id uuid not null, event_type text not null,
 status text not null default 'pending' check(status in ('pending','sending','delivered','retry','failed')),
 attempt_count integer not null default 0 check(attempt_count between 0 and 20),
 next_attempt_at timestamptz not null default now(),
 last_http_status integer check(last_http_status between 100 and 599),
 created_at timestamptz not null default now(), unique(webhook_id,event_id)
);
create index ecosystem_webhook_delivery_queue_idx on public.ecosystem_webhook_deliveries(next_attempt_at,id) where status in ('pending','retry');

create table public.ecosystem_verification_applications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('individual','organization','creator')),
 statement text not null check(char_length(statement) between 20 and 10000),
 status text not null default 'draft' check(status in ('draft','submitted','review','more_information','approved','rejected','revoked','withdrawn')),
 reviewed_by uuid references public.admin_accounts(id) on delete set null,
 reviewed_at timestamptz,
 decision_reason text check(char_length(decision_reason)<=5000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index ecosystem_verification_owner_idx on public.ecosystem_verification_applications(user_id,created_at desc,id);
create index ecosystem_verification_queue_idx on public.ecosystem_verification_applications(status,created_at,id);

create table public.ecosystem_private_assets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 object_path text not null unique,
 filename text not null check(char_length(filename) between 1 and 240),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
 bytes integer not null check(bytes between 1 and 10485760),
 ticket_id uuid references public.ecosystem_support_tickets(id) on delete cascade,
 job_application_id uuid references public.ecosystem_job_applications(id) on delete cascade,
 verification_id uuid references public.ecosystem_verification_applications(id) on delete cascade,
 scan_status text not null default 'unscanned' check(scan_status in ('unscanned','pending','clean','rejected')),
 created_at timestamptz not null default now(),
 check(num_nonnulls(ticket_id,job_application_id,verification_id)=1)
);
create index ecosystem_private_assets_owner_idx on public.ecosystem_private_assets(owner_id);
create index ecosystem_private_assets_ticket_idx on public.ecosystem_private_assets(ticket_id);
create index ecosystem_private_assets_application_idx on public.ecosystem_private_assets(job_application_id);
create index ecosystem_private_assets_verification_idx on public.ecosystem_private_assets(verification_id);

create table public.ecosystem_locales (
 code text primary key check(code ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
 display_name text not null, native_name text not null,
 enabled boolean not null default false,
 review_status text not null default 'draft' check(review_status in ('draft','review','approved')),
 updated_at timestamptz not null default now(), check(not enabled or review_status='approved')
);
create table public.ecosystem_translations (
 locale text not null references public.ecosystem_locales(code) on delete cascade,
 namespace text not null check(namespace ~ '^[a-z][a-z0-9_-]{0,63}$'),
 translation_key text not null check(char_length(translation_key) between 1 and 200),
 value text not null check(char_length(value)<=20000),
 status text not null default 'draft' check(status in ('draft','review','approved')),
 version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now(), primary key(locale,namespace,translation_key)
);
create table public.ecosystem_language_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 locale text not null references public.ecosystem_locales(code) on delete restrict,
 updated_at timestamptz not null default now()
);
create table public.ecosystem_ai_milestones (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(title) between 3 and 160),
 description text not null check(char_length(description) between 20 and 10000),
 position integer not null default 0,
 status text not null default 'planned' check(status in ('planned','building','testing','available')),
 completion_evidence text check(char_length(completion_evidence)<=10000),
 published boolean not null default false, updated_at timestamptz not null default now(),
 check(status<>'available' or nullif(trim(completion_evidence),'') is not null)
);
create table public.ecosystem_ai_waitlist (
 user_id uuid primary key references auth.users(id) on delete cascade,
 subscribed boolean not null default true,
 consent_version text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.ecosystem_legal_reviews (
 id uuid primary key default gen_random_uuid(),
 page_id uuid not null references public.cms_pages(id) on delete restrict,
 source_revision_id uuid references public.cms_page_versions(id) on delete restrict,
 jurisdiction text not null check(char_length(jurisdiction) between 2 and 120),
 locale text not null default 'en' references public.ecosystem_locales(code) on delete restrict,
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'draft' check(status in ('draft','review','approved','rejected','superseded')),
 reviewer_admin_id uuid references public.admin_accounts(id) on delete restrict,
 decision_note text check(char_length(decision_note)<=10000),
 effective_at timestamptz, reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 check(status<>'approved' or (reviewer_admin_id is not null and reviewed_at is not null and effective_at is not null))
);
create index ecosystem_legal_reviews_page_idx on public.ecosystem_legal_reviews(page_id,created_at desc,id);
create index ecosystem_legal_reviews_reviewer_idx on public.ecosystem_legal_reviews(reviewer_admin_id);
create index ecosystem_legal_reviews_revision_idx on public.ecosystem_legal_reviews(source_revision_id);

create table public.ecosystem_delivery_outbox (
 id uuid primary key default gen_random_uuid(),
 topic text not null check(topic in ('support','job_application','developer_review','verification','ai_waitlist')),
 aggregate_id uuid not null,
 recipient_user_id uuid references auth.users(id) on delete cascade,
 template_key text not null,
 payload jsonb not null default '{}' check(jsonb_typeof(payload)='object'),
 idempotency_key text not null unique,
 status text not null default 'pending' check(status in ('pending','sending','sent','retry','failed','cancelled')),
 attempt_count integer not null default 0 check(attempt_count between 0 and 20),
 next_attempt_at timestamptz not null default now(),
 created_at timestamptz not null default now(), delivered_at timestamptz
);
create index ecosystem_outbox_pending_idx on public.ecosystem_delivery_outbox(next_attempt_at,id) where status in ('pending','retry');
create index ecosystem_outbox_recipient_idx on public.ecosystem_delivery_outbox(recipient_user_id);


create index ecosystem_ticket_messages_user_idx on public.ecosystem_ticket_messages(author_user_id);
create index ecosystem_ticket_messages_admin_idx on public.ecosystem_ticket_messages(author_admin_id);
create index ecosystem_ticket_notes_admin_idx on public.ecosystem_ticket_notes(admin_id);
create index ecosystem_developer_apps_reviewer_idx on public.ecosystem_developer_applications(reviewed_by);
create index ecosystem_verification_reviewer_idx on public.ecosystem_verification_applications(reviewed_by);
create index ecosystem_language_preferences_locale_idx on public.ecosystem_language_preferences(locale);
create index ecosystem_legal_reviews_locale_idx on public.ecosystem_legal_reviews(locale);

-- Deny by default. Users cannot forge approvals, employers, scopes or status.
-- Service role access is for existing authenticated/permission-checked Edge handlers.
do $security$
declare t text;
begin
 for t in select unnest(array['ecosystem_categories','ecosystem_articles','ecosystem_article_feedback','ecosystem_support_tickets','ecosystem_ticket_messages','ecosystem_ticket_notes','ecosystem_organizations','ecosystem_organization_members','ecosystem_jobs','ecosystem_job_applications','ecosystem_saved_jobs','ecosystem_developer_applications','ecosystem_developer_credentials','ecosystem_developer_webhooks','ecosystem_webhook_deliveries','ecosystem_verification_applications','ecosystem_private_assets','ecosystem_locales','ecosystem_translations','ecosystem_language_preferences','ecosystem_ai_milestones','ecosystem_ai_waitlist','ecosystem_legal_reviews','ecosystem_delivery_outbox']) loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $security$;

grant select on public.ecosystem_categories, public.ecosystem_articles,
 public.ecosystem_organizations, public.ecosystem_jobs,
 public.ecosystem_locales, public.ecosystem_translations,
 public.ecosystem_ai_milestones to anon,authenticated;
create policy categories_public on public.ecosystem_categories for select to anon,authenticated using(published);
create policy articles_public on public.ecosystem_articles for select to anon,authenticated using(
 status='published' and published_at<=now() and exists(select 1 from public.cms_pages p where p.route=page_route and p.status='published')
);
create policy organizations_public on public.ecosystem_organizations for select to anon,authenticated using(verification_status='verified');
create policy jobs_public on public.ecosystem_jobs for select to anon,authenticated using(
 status='open' and published_at<=now() and (closes_at is null or closes_at>now()) and exists(select 1 from public.ecosystem_organizations o where o.id=organization_id and o.verification_status='verified')
);
create policy locales_public on public.ecosystem_locales for select to anon,authenticated using(enabled and review_status='approved');
create policy translations_public on public.ecosystem_translations for select to anon,authenticated using(status='approved' and exists(select 1 from public.ecosystem_locales l where l.code=locale and l.enabled and l.review_status='approved'));
create policy ai_milestones_public on public.ecosystem_ai_milestones for select to anon,authenticated using(published);

grant select on public.ecosystem_article_feedback,public.ecosystem_support_tickets,
 public.ecosystem_ticket_messages,public.ecosystem_organization_members,
 public.ecosystem_job_applications,public.ecosystem_saved_jobs,
 public.ecosystem_developer_applications,public.ecosystem_verification_applications,
 public.ecosystem_private_assets,public.ecosystem_language_preferences,
 public.ecosystem_ai_waitlist to authenticated;
create policy feedback_owner on public.ecosystem_article_feedback for select to authenticated using(user_id=(select auth.uid()));
create policy tickets_owner on public.ecosystem_support_tickets for select to authenticated using(user_id=(select auth.uid()));
create policy ticket_messages_owner on public.ecosystem_ticket_messages for select to authenticated using(exists(select 1 from public.ecosystem_support_tickets t where t.id=ticket_id and t.user_id=(select auth.uid())));
create policy memberships_owner on public.ecosystem_organization_members for select to authenticated using(user_id=(select auth.uid()) and active);
create policy job_applications_owner on public.ecosystem_job_applications for select to authenticated using(applicant_id=(select auth.uid()));
create policy saved_jobs_owner on public.ecosystem_saved_jobs for select to authenticated using(user_id=(select auth.uid()));
create policy developer_apps_owner on public.ecosystem_developer_applications for select to authenticated using(owner_id=(select auth.uid()));
create policy verification_owner on public.ecosystem_verification_applications for select to authenticated using(user_id=(select auth.uid()));
create policy asset_metadata_owner on public.ecosystem_private_assets for select to authenticated using(owner_id=(select auth.uid()));
create policy language_preference_owner on public.ecosystem_language_preferences for select to authenticated using(user_id=(select auth.uid()));
create policy ai_waitlist_owner on public.ecosystem_ai_waitlist for select to authenticated using(user_id=(select auth.uid()));

-- Safe published organization fields only. Owner IDs do not form public directory data.
revoke select on public.ecosystem_organizations from anon,authenticated;
grant select(id,name,website,description,verification_status,created_at,updated_at) on public.ecosystem_organizations to anon,authenticated;
-- Private credential hashes, signing references, staff notes, outbox and legal
-- review rows have no client grants or policies. Metadata APIs must project a
-- whitelist, never SELECT * from secret-bearing tables.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ecosystem-private-attachments','ecosystem-private-attachments',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- Deliberately no new storage.objects policies: only the authorized server can
-- upload/sign these objects. Scanning and permission checks are required before
-- recruiter access. Existing bucket policies must be tested for broad matches.

comment on table public.ecosystem_developer_credentials is 'Server-only hashes. This schema does not implement OAuth delegation or make the proposed /v1 API available.';
comment on table public.ecosystem_legal_reviews is 'Human legal review records. Publication enforcement and approved hash checks must be connected to the existing CMS publisher before legal workflow launch.';
comment on table public.ecosystem_delivery_outbox is 'Durable delivery intent; requires a configured provider, worker leases, retries and recorded provider receipts before claiming delivery.';
commit;
