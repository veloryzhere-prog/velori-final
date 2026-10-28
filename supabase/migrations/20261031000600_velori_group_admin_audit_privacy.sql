-- Group lock reasons and administrator identity belong in admin_audit_logs,
-- which is service-role-only. Remove the unused copies from public.groups so
-- anonymous public-group readers cannot select moderation metadata.

alter table public.groups
  drop column if exists moderation_reason,
  drop column if exists moderated_by,
  drop column if exists moderated_at;
