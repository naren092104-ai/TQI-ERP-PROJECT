# Supabase Setup

## Project
- Project URL: `https://aqadjaawhkuedrcqhkmc.supabase.co`
- Server-side key: store `SUPABASE_SERVICE_ROLE_KEY` only in Cloudflare/host secrets.
- Publishable key: may be used in browser code but only for RLS-safe operations.

## Apply schema safely
1. Create a Supabase database backup before applying anything.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql` in a transaction-aware review window.
4. Do not run destructive reset scripts against production.
5. Verify table and foreign-key counts with SQL Editor.

## Migration cutover
The current application uses MySQL-specific SQL and transactions. It cannot be switched to Supabase by changing one URL. Export approved MySQL data, map columns to `supabase/schema.sql`, and use a staged import. Existing rows must be reconciled and tested before DNS/application cutover.

## RLS
RLS is enabled on core application tables, but application policies require an explicit authentication claim mapping. Do not disable RLS. The existing app's JWT is application-owned; either mint Supabase-compatible JWT claims or keep privileged CRUD behind the Node backend and enforce cluster/role authorization there.
