# Production Checklist

- [ ] Exposed credentials rotated
- [ ] Supabase backup created
- [ ] PostgreSQL schema reviewed and applied
- [ ] Existing data imported and reconciled
- [ ] RLS policies implemented and tested
- [ ] Backend database connection tested
- [ ] JWT secret configured identically on every backend instance
- [ ] SMTP test delivered to authorized mailbox
- [ ] SMTP app password remains server-only
- [ ] Cloudflare Pages build succeeds
- [ ] `VITE_API_URL` uses HTTPS production backend
- [ ] Cloudflare SPA fallback tested
- [ ] Backend CORS allows exact production origins
- [ ] Upload storage migrated to durable R2/object storage
- [ ] Login/logout and forced password change tested
- [ ] Cluster/user CRUD tested
- [ ] Attendance, lesson plan, finance, photos, reports tested
- [ ] Refresh/direct-route tested
- [ ] Security and dependency advisories reviewed
- [ ] Production health endpoint verified
- [ ] Actual frontend/backend/Supabase evidence attached before marking PASS

## Current final status
- Frontend build: PASS
- Frontend lint: PASS
- Backend lint: PASS
- Backend build: PASS
- SMTP connectivity/authentication: PASS
- SMTP test delivery: PASS
- Supabase publishable/service endpoint authentication: PASS
- Supabase database cutover: NOT VERIFIED / PENDING
- Cloudflare Workers backend: NOT COMPATIBLE WITHOUT PORT
- Full E2E production workflows: NOT VERIFIED
- Production deployment: NOT VERIFIED
