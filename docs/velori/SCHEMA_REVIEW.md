# Database foundation awaiting approval

This is a concrete review proposal for the newly attached master prompt, not an applied migration. The deployed redesign and existing social features already work without it.

## Required authorization

The repository AGENTS.md states: **Never modify database schema without asking**. Approve or reject `supabase/proposals/20261024_ecosystem.sql` before it is moved into migrations or executed. Do not automatically apply this proposal during setup.

## Exact change

The transaction creates 24 new `ecosystem_` tables listed below, supporting article metadata, support tickets, employer/recruiting workflows, developer applications, private credentials, webhook queues, verification requests, private asset metadata, localization, AI status/waitlist, legal review records and delivery outbox. It reuses current Auth users, profiles, CMS pages, CMS revisions and admin-account IDs. It adds indexes, constraints, read policies and one private 10 MB attachment bucket. It does not alter existing social tables or their policies.

- `ecosystem_categories`
- `ecosystem_articles`
- `ecosystem_article_feedback`
- `ecosystem_support_tickets`
- `ecosystem_ticket_messages`
- `ecosystem_ticket_notes`
- `ecosystem_organizations`
- `ecosystem_organization_members`
- `ecosystem_jobs`
- `ecosystem_job_applications`
- `ecosystem_saved_jobs`
- `ecosystem_developer_applications`
- `ecosystem_developer_credentials`
- `ecosystem_developer_webhooks`
- `ecosystem_webhook_deliveries`
- `ecosystem_verification_applications`
- `ecosystem_private_assets`
- `ecosystem_locales`
- `ecosystem_translations`
- `ecosystem_language_preferences`
- `ecosystem_ai_milestones`
- `ecosystem_ai_waitlist`
- `ecosystem_legal_reviews`
- `ecosystem_delivery_outbox`

## Permission boundary

Every new table enables RLS and revokes default browser privileges. Public reads are limited to published content, reviewed employers/open jobs, approved translations and published milestone records. Authenticated private reads are owner-only. Credential hashes, webhook signing references, staff notes, delivery payloads and legal review records have no browser grants. There are no direct browser writes: trusted endpoints must validate the existing session, permissions, ownership, state transition, idempotency and rate limits before service-role writes.

The new private bucket has no client object policies. Server handlers must authorize each upload/download, validate real file contents, enforce limits and provide short-lived access. Review existing storage policies for broad matches before launch. The SQL does not configure malware scanning or a mail provider.

## Effects that are deliberately absent

No real jobs, employers, articles, translations, AI milestones, applicants or verification evidence are seeded. No API key is issued and no OAuth server or /v1 integration API is activated. No legal approval is fabricated. The legal review table still needs a content-hash publication guard connected to CMS publishing. The outbox still needs a configured provider and worker. Installing tables alone does not complete the master prompt.

## Review performed and pending

Confirmed the referenced id columns on profiles, admin_accounts, cms_pages and cms_page_versions are UUIDs, and no existing ecosystem_ tables were found. Checked table-name uniqueness, schema transaction boundaries, explicit table enumeration and deny-by-default grants. These are static checks only: the proposal has **not** been executed, SQL integration tested, or represented as passing RLS acceptance.

After approval, apply in an isolated test context first and test requester/recruiter/developer/admin/outsider access, denial of forged statuses, file privacy, invalid foreign keys and rollback behavior. The application and Edge Function integration follows in dependency order; update qa/implementation-status.json with actual evidence after each phase.

## Rollback and data handling

Keep a backup and deploy the additive schema before enabling any new UI. Before any records exist, an authorized rollback may remove the new tables/bucket in reverse dependency order. Once submissions exist, do not drop tables or delete private objects to roll back the UI; disable feature exposure and preserve data until a reviewed migration/retention process is approved. This proposal contains no destructive downgrade.
