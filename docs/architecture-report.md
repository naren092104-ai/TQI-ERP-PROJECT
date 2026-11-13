# TQI production architecture

## Vercel multi-service deployment

- `vercel.json` defines the Vite frontend service rooted at `frontend/` and the Express backend service rooted at `backend/`.
- Public `/api/*` paths route to the backend; the frontend service receives the catch-all and rewrites SPA deep links to `index.html`. The legacy unauthenticated `/storage/uploads` static mount is not exposed.
- Browser API requests use same-origin relative `/api/...` paths. The static frontend makes no server-to-server call, so no service binding is required.
- The Vercel backend service exports the existing Express app from `backend/src/server.ts`; in Vercel it does not serve the frontend SPA.
- The existing MySQL schema and data remain unchanged. Vercel requires a remotely reachable MySQL endpoint and private `DB_*` environment variables.
- Production session verification uses the existing JWT flow and a single configured `JWT_SECRET` shared by all function instances.
- Local development retains the existing Vite frontend and Express server commands.

## Deployment constraints

Vercel Functions are stateless and their writable filesystem is ephemeral. Existing photo and module-resource uploads are stored on disk, so durable uploads/downloads require a persistent object-storage migration; a filesystem path or static route cannot make those files durable. Vercel also limits request bodies to 4.5 MB, below the current module-resource upload limit. The current Vercel services configuration therefore supports the UI and existing API routes, but file-storage production readiness remains an explicit prerequisite.

The serverless runtime initializes the MySQL connection pool per warm instance. It intentionally does not run schema migrations or database bootstrap during requests; the target MySQL database must already contain the existing schema and records.


