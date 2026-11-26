# TQI ERP Project Audit

## Architecture
- Frontend: React 19 + Vite 6 + TypeScript in `frontend/`
- Backend: Express 4 + TypeScript in `backend/src/server.ts`
- Authentication: application-owned bcrypt passwords and signed JWTs
- Existing database: MySQL-compatible SQL, `mysql2` pool, SQL migration runner
- Hosting assets: Vercel configuration exists; Cloudflare Pages is prepared separately
- Uploads: local filesystem or `/tmp` in serverless mode
- Email: Nodemailer SMTP

## Confirmed working baseline
- `npm run lint` passes
- `npm run build` passes
- Frontend and backend builds succeed
- 41 versioned MySQL migrations are present

## Critical findings
1. The backend used a hardcoded deterministic production JWT fallback. Removed: production now requires `JWT_SECRET`.
2. The backend is MySQL-specific (hundreds of `?` placeholders and MySQL-specific SQL); it is not directly Cloudflare Workers-compatible.
3. Supabase integration is not a drop-in migration: PostgreSQL/SQL dialect and an adapter rewrite are required.
4. Local Node modules and Express/FileSystem APIs are incompatible with Cloudflare Workers runtime. The minimum-change hosting solution is: keep the Express API on a Node-compatible host, serve the Vite frontend on Cloudflare Pages, and migrate the database to Supabase PostgreSQL first.
5. File storage uses the local filesystem and is not durable on Workers or ephemeral serverless hosts. Use Cloudflare R2 or a persistent volume.
6. `xlsx` has known high-severity advisories with no npm fix available.
7. The chat/provider session exposed Supabase service/SMTP credentials and a Vercel OIDC token. Rotate every shared secret.
8. One backend mail wrapper was changed to stop converting delivery failures to `false` responses.

## Security assessment
- Do not add the Supabase secret key or SMTP password to Vite variables.
- JWTs must use a secret from the runtime environment.
- CORS currently allows configured origins plus Pages domains.
- SQL queries use parameterized MySQL placeholders; this must be preserved during PostgreSQL conversion.
- Destructive reset scripts are blocked unless a maintenance-only environment flag is set.
- RLS must be designed to match application JWT/RBAC behavior rather than disabled.

## Database status
- Existing data is MySQL-based and must be preserved.
- PostgreSQL schema and migration templates are provided under `supabase/`.
- No existing Supabase tables were inspected through credentials, and no production data was changed.
- Supabase publishable key is safe only for public, RLS-restricted operations. Privileged operations belong on the server.
