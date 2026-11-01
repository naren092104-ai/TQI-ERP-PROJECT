# TQI production architecture

## Single Vercel deployment

- React/Vite frontend source remains in `frontend/`; `npm run build:vercel` copies the existing build into the Vercel static `public/` directory.
- Root `server.ts` exports the existing Express application from `backend/src/server.ts` as a Vercel Node.js function.
- Browser API requests use same-origin relative `/api/...` paths. No external API rewrite or secondary frontend platform is part of production routing.
- The existing MySQL schema and data remain unchanged. Vercel requires a remotely reachable MySQL endpoint and private `DB_*` environment variables.
- Production session verification uses the existing JWT flow and a single configured `JWT_SECRET` shared by all function instances.
- Local development retains the existing Vite frontend and Express server commands.

## Deployment constraints

Vercel Functions are stateless and their writable filesystem is ephemeral. Existing photo and module-resource uploads are stored on disk, so durable uploads/downloads require a persistent object-storage migration; a filesystem path or static route cannot make those files durable. Vercel also limits request bodies to 4.5 MB, below the current module-resource upload limit. The current Vercel preparation therefore supports the UI and existing API routes, but file-storage production readiness remains an explicit prerequisite.

The serverless runtime initializes the MySQL connection pool per warm instance. It intentionally does not run schema migrations or database bootstrap during requests; the target MySQL database must already contain the existing schema and records.


