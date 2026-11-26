# Deployment Guide

## 1. Rotate exposed secrets
Rotate the Gmail app password, Supabase service/publishable keys, Vercel/OIDC token, and database password if they were used outside secure secret storage.

## 2. Supabase
- Back up existing production data.
- Create the PostgreSQL schema using `supabase/schema.sql` only after review.
- Configure RLS and authenticate the app architecture.
- Migrate data in a staged, verifiable import.

## 3. Cloudflare Pages
- Project root: repository root
- Build command: `npm run build:frontend`
- Output directory: `frontend/dist`
- Variables: `VITE_API_URL=https://<node-backend-host>/api`
- Cloudflare Pages: Settings → Environment variables → Production
- Custom SPA fallback: `frontend/public/_redirects`

## 4. Backend runtime
Recommended minimum-change deployment: deploy the Express backend to a Node-compatible server or container, keeping public HTTPS in front of it.

Set server secrets:
- `NODE_ENV=production`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` only if server-side privileged Supabase operations are implemented
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `CORS_ORIGINS`
- `FRONTEND_URL`, `APP_URL`
- legacy DB variables only until database cutover is complete

## 5. Cloudflare Workers option
A Workers deployment requires porting the Express application to Web Request/Response APIs, replacing MySQL TCP with Supabase HTTP/PostgREST or PostgreSQL-compatible networking, moving uploads to R2, and replacing local secrets/filesystem startup behavior.

## VS Code commands
```powershell
cd e:\TQI_ERP-main
npm install
npm run lint
npm run build
npm --prefix backend run mail:verify
npm run dev
```

Deployment commands depend on the selected Node/VPS or container platform and must not include secret values in shell history.
