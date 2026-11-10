# VELORI CMS draft and publish audit

**Local implementation pass:** 2026-10-05 (Asia/Calcutta)

## Changes made

- CMS edits are now staged in `cms_pages.draft_content`; public renderers continue to read only published columns.
- A dedicated permission-gated `POST /admin/cms/pages/:id/publish` endpoint validates the draft, promotes it to the public snapshot, clears the draft, and records an audit event.
- The CMS editor now saves drafts, previews page content, exposes the route where content appears, and identifies live pages with pending edits.
- About, Contact, Privacy, Terms, Community Guidelines, Safety, Cookies, Acceptable Use, Data Policy, Legal, Help, and custom CMS routes use published CMS content when a matching route has been published. Existing product-authored content remains the fallback.
- Page history now carries the Open Graph image, footer visibility, and animation setting through snapshots and restores.
- Public CMS pages refresh after database events, on tab visibility, and on a bounded interval.

## Verification

- `pnpm.cmd run typecheck`: passed.
- `pnpm.cmd run format:check`: passed.
- `pnpm.cmd run build`: passed; Vite still reports a 510 kB main JavaScript chunk.
- `pnpm.cmd run test`: 48 passed.
- `deno check supabase/functions/server/index.tsx`: passed.
- Browser verification was not completed. The in-app browser denied localhost access, and its denial explicitly prohibited attempts through alternate browser surfaces or indirect commands. No draft or publication was made against real visitor traffic.

## Deployment and remaining audit status

The source path is connected end to end, but the database migration `20261031003400_velori_cms_draft_publish_isolation.sql` and updated Edge Function must be deployed before this workflow is available in a live environment. This pass did not query migration history or deploy backend changes. Public-site preview, publish persistence, realtime refresh, rollback, and the About/Contact/Terms/Help acceptance scenarios remain **unverified live**.

This was a targeted CMS control-path fix, not completion of the full VELORI platform rebuild. Ads, the complete visual error and maintenance studios, theme/navigation delivery, analytics, system health, and the role-by-role security matrix retain the limitations recorded in [the prior live audit](VELORI_ADMIN_FINAL_LIVE_AUDIT.md) and [maintenance/ads audit](VELORI_ADMIN_MAINTENANCE_ADS_AUDIT.md).
