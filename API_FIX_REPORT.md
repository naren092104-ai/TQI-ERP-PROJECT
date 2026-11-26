# TQI ERP API Fix Report

## Root Causes
- Worker dashboard GET handlers blindly appended `academic_year_id=eq...` to every table/query.
- Tables such as academic_years, users, notifications, audit_logs, tqi_settings, and maintenance_settings do not use that column.
- Admin backup and reset-history routes existed in Express but were missing from the Cloudflare Worker entry point.
- The production Worker deployment version did not match the intended route source.

## Fixes
- Added table-aware academic year filtering.
- Added Super Admin authorization checks for admin routes.
- Added GET/POST `/api/admin/backups` backed by Supabase `operational_backups`.
- Added GET `/api/admin/data-reset/history` backed by real `audit_logs` records.
- Preserved reset and backup security confirmations in the Express backend.
- Added backup snapshot JSON storage to Supabase migration design.

## Database Migration
- `supabase/migrations/003_admin_backup_reset_history.sql`
- Creates `operational_backups` table and indexes.
- Stores real table snapshots and counts in JSONB.

## Security
- JWT verification is required for admin routes.
- Super Admin role claim is enforced.
- Supabase service credentials remain server/Worker secret-side.
- No destructive reset is exposed by the added GET routes.

## Verification
- `/api/system/maintenance`: 200 in direct authenticated/unauthenticated route test.
- `/api/academic-years`: 200.
- `/api/users`: 200.
- `/api/notifications`: 200.
- `/api/audit-logs`: 200.
- `/api/settings/finance`: 200.
- Admin backup/reset routes require the operational_backups migration in the Supabase SQL Editor.

## Deployment
- Worker deployed after route fixes.
- Frontend no design changes.
