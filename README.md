# TQI Cluster Admin

TQI is built with a decoupled architecture featuring a **Vite + React (TypeScript) frontend** (ready for Cloudflare Pages deployment) and an **Express + MySQL REST API backend** (running on Port 5000 with CORS and migration automation).

## Structure

- `frontend/`: Standalone React/Vite application, Cloudflare Pages build target (`frontend/dist/`).
- `backend/`: Express REST API server, MySQL connection pool, database migrations runner, and email service.
- `database/migrations/`: Authoritative MySQL migrations (001 through 011).
- `storage/uploads/`: Uploaded photos and runtime files.
- `docs/`: Architecture documentation and system metadata.

## Environment Configuration

### 1. Root Backend Environment (`.env`)
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=quest
DB_USER=root
DB_PASSWORD=your-mysql-password
JWT_SECRET=replace-with-a-secret
UPLOADS_DIR=storage/uploads
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=narendhardan@gmail.com
SMTP_PASS=bzvm qsix ikoe gxti
SMTP_FROM=narendhardan@gmail.com
```

### 2. Frontend Environment (`frontend/.env`)
```env
# Local development against Port 5000 backend:
VITE_API_URL=http://localhost:5000/api

# For Cloudflare Pages production deployment:
# VITE_API_URL=https://api.your-backend-domain.org/api
```

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run both backend (port 5000) and frontend (port 5173) in parallel:
npm run dev

# Or run separately:
npm run dev:backend   # Express API server at http://localhost:5000
npm run dev:frontend  # Vite app at http://localhost:5173
```

On server boot, the backend automatically connects to MySQL, creates the database (`quest`) if it does not exist, and executes any pending migrations in `database/migrations/`.

## Building & Deploying to Cloudflare Pages

- **Cloudflare Pages Build Command**: `npm run build:frontend` (or `vite build --config frontend/vite.config.ts`)
- **Cloudflare Pages Output Directory**: `frontend/dist`
- **Environment Variable on Cloudflare**: Set `VITE_API_URL` to your production backend API URL.

## Verification Commands

- `npm run lint` checks TypeScript across frontend and backend.
- `npm run build` compiles both the frontend (`frontend/dist`) and backend (`backend/dist/server.cjs`).
- `npm start` runs the bundled production backend.


# TQI_ERP
