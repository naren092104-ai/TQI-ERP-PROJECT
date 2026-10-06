# TQI architecture report

## Final structure

- [frontend/](../frontend): Standalone React application, Vite build configuration, and Cloudflare Pages deployment target (`dist/`).
- [backend/](../backend): Standalone Express REST API (Port 5000), MySQL connection pool, database migrations runner, and email delivery service.
- [database/migrations/](../database/migrations): Authoritative SQL migrations (201 to 232).
- [backend/storage/uploads/](../backend/storage/uploads): Runtime upload storage through `UPLOADS_DIR`; existing database file paths are resolved from the legacy root storage location after migration.
- [docs/](.): Architecture and developer documentation.

## Decoupled Architecture & Cloudflare Deployment

The frontend and backend are completely decoupled:
1. **Frontend**: Standalone Vite + React 19 SPA communicating with the backend over HTTP REST using the configured `VITE_API_URL` (`frontend/.env`). It builds directly into `frontend/dist/` for simple static deployment onto Cloudflare Pages / Workers or Vercel.
2. **Backend**: Independent Express 4 REST API service running on Port 5000 with CORS middleware enabled to support cross-origin requests from the deployed frontend.
3. **Database**: On boot, the backend verifies/creates the MySQL database (`TQI_ERP`) and automatically runs all migrations in `database/migrations/`.
4. **Email & OTP**: Type-safe HTML/plain-text templates rendered in TypeScript (`backend/src/templates/otpEmailTemplate.ts`) and sent via Nodemailer with Gmail SMTP.


