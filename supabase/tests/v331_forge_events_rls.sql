-- V33.1 staging-only verification. Run only after migration 20261106000000.
-- Actor-specific SELECT checks also require a seeded test account in a staging database.
select has_table_privilege('anon','public.velori_studio_run_events','SELECT') as anonymous_cannot_read,
       has_table_privilege('authenticated','public.velori_studio_run_events','SELECT') as signed_in_can_read;
-- Expected: false, true. No client-side writes are granted.
select has_table_privilege('authenticated','public.velori_studio_run_events','INSERT') as client_cannot_insert,
       has_table_privilege('authenticated','public.velori_studio_run_events','UPDATE') as client_cannot_update,
       has_table_privilege('authenticated','public.velori_studio_run_events','DELETE') as client_cannot_delete;
-- Expected: false, false, false. RLS must additionally be verified with user A and user B JWTs.
