# TQI production architecture

## Vercel multi-service deployment

- `vercel.json` defines the Vite frontend service rooted at `frontend/` and the Express backend service rooted at `backend/`.
- Public `/api/*` paths route to the backend; the frontend service receives the catch-all and rewrites SPA deep links to `index.html`. The legacy unauthenticated `/storage/uploads` static mount is not exposed.
- Browser API requests use same-origin relative `/api/...` paths. The static frontend makes no server-to-server call, so no service binding is required.
- The Vercel backend service exports the existing Express app from `backend/src/server.ts`; in Vercel it does not serve the frontend SPA.
- The existing MySQL schema and data remain unchanged. Vercel requires a remotely reachable TiDB/MySQL endpoint and private `DB_*` environment variables.
- Production session verification uses the existing JWT flow and a single configured `JWT_SECRET` shared by all function instances.
- Local development retains the existing Vite frontend and Express server commands.

## Database and deployment safety

The production TiDB connection uses the existing `mysql2/promise` pool with required TLS and CA certificate verification. Production requires an explicit remote DB host, database name, port, user/password, `DB_SSL=true`, a PEM CA, and `DB_CREATE_IF_MISSING=false`. Pool size defaults to five connections per Vercel function instance.

Production startup does not apply schema migrations or table-repair DDL. Import/provision the existing schema and data before deploying. The `/api/health` endpoint checks connectivity with `SELECT 1` and returns HTTP 503 when the database is unavailable.

## Deployment constraints

Vercel Functions are stateless and their writable filesystem is ephemeral. Existing photo and module-resource uploads are stored on disk, so durable uploads/downloads require persistent object storage. Vercel also limits request bodies to 4.5 MB, below the current module-resource upload limit.


