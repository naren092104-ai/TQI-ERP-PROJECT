# API Integration

## Existing architecture
- Frontend: Vite, with `apiUrl()` in `frontend/src/utils/api.ts`
- Backend: Express REST API under `/api/*`
- Authentication: `Authorization: Bearer <JWT>`
- Storage: `/storage/uploads`

## Frontend configuration
Set `VITE_API_URL` as the absolute public backend origin plus `/api` in the Cloudflare Pages build environment.

Example:
```text
VITE_API_URL=https://api.example.com/api
```

Do not use `localhost` in production builds.

## Backend CORS
Set `CORS_ORIGINS` to the exact Pages and custom frontend origins, comma-separated. The backend also permits `*.pages.dev` in the existing CORS implementation.

## Cloudflare compatibility
The Express/MySQL backend cannot run unchanged as a Workers process because it uses Node filesystem, listeners, MySQL TCP/pools, multipart disk uploads, and migrations. Use Cloudflare Pages for static frontend hosting and a Node-compatible host for the backend until the database and runtime are fully ported.
