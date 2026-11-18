# Talent Quest for India (TQI) &middot; Academic ERP

A modern, enterprise-grade Enterprise Resource Planning (ERP) platform designed for rural education operations, field mentorship coordination, attendance tracking, and multi-tier governance across Tamil Nadu panchayats and village centres.

---

## 🌟 Architecture & Tech Stack

The production deployment uses one Vercel domain for the React client and Express API:

- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind CSS v4, styled using the modern **TailAdmin** design system with full dark/light theme support.
- **Backend**: Existing Express.js REST API with TypeScript, MySQL 8.x connection pooling, and JWT-based authentication with Role-Based Access Control (RBAC), hosted as a Vercel Node.js function.
- **OCR & Intelligence**: Tesseract.js / Google GenAI for automated receipt & expense verification.
- **Reporting & Export**: jsPDF, html2canvas, and XLSX for automated PDF & Excel semester reporting.

---

## 📁 Repository Structure

```text
├── backend/                  # Express REST API Server
│   ├── src/
│   │   ├── db/               # MySQL pool and schema bootstrap
│   │   ├── scripts/          # Backend maintenance and workflow scripts
│   │   ├── templates/        # Transactional email templates
│   │   ├── authMailer.ts
│   │   └── server.ts         # API routes and application entry point
│   ├── storage/uploads/      # Runtime uploads (ignored by Git)
│   └── tsconfig.json
├── frontend/                 # React 19 + TypeScript Client (TailAdmin UI)
│   ├── src/
│   │   ├── components/       # UI Views (Dashboard, Attendance, Finance, Approvals, etc.)
│   │   │   └── ui/           # TailAdmin design system primitives (Card, Badge, Table, Modal)
│   │   ├── hooks/            # Shared React hooks
│   │   ├── data/             # District and college reference data
│   │   ├── utils/            # API, bill parsing, export, and PDF helpers
│   │   ├── types.ts          # TypeScript domain interfaces
│   │   └── index.css         # Global styles and design tokens
│   ├── tests/e2e/            # Playwright browser tests
│   ├── scripts/              # Frontend data maintenance scripts
│   ├── vite.config.ts
│   └── .env.example
├── database/
│   ├── migrations/           # Versioned MySQL migrations
│   ├── migrations/archive/   # Superseded historical migrations
│   └── schema/schema.sql     # Full schema reference
├── docs/
│   └── project-documents/    # Preserved finance and lesson-plan references
├── frontend/tests/e2e/       # Full-system Playwright tests
├── frontend/scripts/         # Frontend data maintenance scripts
├── server.ts                 # Root Express entrypoint detected by Vercel
├── scripts/prepare-vercel-public.mjs # Copies built SPA assets to Vercel public/
├── package.json              # Monorepo root scripts
└── README.md
```

---

## ⚙️ Environment Configuration

### 1. Backend Environment Setup (`backend/.env` or root `.env`)

Create a `.env` file in `backend/` or the project root based on `.env.example`:

```env
# Runtime (local development)
NODE_ENV=development
PORT=5000

# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=TQI_ERP
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_SSL=false
DB_CREATE_IF_MISSING=true

# Authentication & Security
JWT_SECRET=
ADMIN_DEFAULT_PASSWORD=
UPLOADS_DIR=backend/storage/uploads
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
APP_URL=http://localhost:5173
FRONTEND_URL=http://localhost:5173

# SMTP Configuration (Optional: Used for Email OTP login)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@tqierp.org
```

### 2. Frontend Environment Setup (`frontend/.env`)

```env
# Local development against backend:
VITE_API_URL=http://localhost:5000/api

VITE_API_URL=/api
```

Production always forces same-origin `/api` requests. Only `VITE_*` variables
are included in the browser bundle. Never put database, JWT, SMTP, or AI
provider secrets in frontend variables.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20.x or higher (required by the patched Nodemailer release)
- **MySQL Server**: v8.0 or higher

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/Mithunp123/TQI_ERP.git
cd TQI_ERP

# Install the root monorepo dependencies
npm install
```

### 3. Running in Development Mode

Run both the backend (Port 5000) and frontend (Port 5173) concurrently:

```bash
npm run dev
```

Or run backend and frontend in separate terminals:

```bash
npm run dev:backend   # Express API server at http://localhost:5000
npm run dev:frontend  # Vite React App at http://localhost:5173
```

> **Note**: On startup, the backend automatically initializes the MySQL database schema and applies any pending migrations from `database/migrations/`.

---

## 🛠️ Build & Verification Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs both backend and frontend concurrently in development mode |
| `npm run build` | Compiles both frontend (`frontend/dist`) and backend (`backend/dist/server.cjs`) |
| `npm run build:frontend` | Builds production frontend bundle |
| `npm run build:vercel` | Builds the frontend and stages it in Vercel's `public/` directory |
| `npm run build:backend` | Bundles Node.js backend using esbuild |
| `npm run lint` | Runs TypeScript typechecks across both frontend and backend |
| `npm run lint:frontend` | Typechecks frontend source code |
| `npm run lint:backend` | Typechecks backend source code |
| `npm start` | Builds and starts the production backend (`backend/dist/server.cjs`) |
| `npm run test:e2e:responsive` | Checks the public login layout at 320px–1440px (start the frontend first) |

The authenticated E2E specs require the local API and MySQL. The full-system and
comprehensive specs reset the configured database and are skipped unless
`TQI_E2E_ALLOW_DB_RESET=true`; only set that flag when using a disposable test DB.
The standalone backend reset scripts also refuse to reset a production database
unless `ALLOW_DESTRUCTIVE_DB_RESET=true` is explicitly supplied; production
resets additionally require a strong `ADMIN_DEFAULT_PASSWORD`.

### Vercel multi-service deployment (Beta)

Connect this repository to one Vercel project with the repository root as the
Root Directory. The root `vercel.json` defines two independently built
services: `frontend` (Vite, rooted at `frontend/`) and `backend` (Express,
rooted at `backend/`). The public route table sends `/api/*` to the backend
and all other paths to the frontend. The frontend service rewrites deep links
to its `index.html`. The legacy `/storage/uploads` static mount is not exposed
as a public route because it bypasses API authorization.

The frontend is a static Vite build, so it has no server-side runtime to call
the backend with a service binding. Browser requests use same-origin relative
`/api/...` URLs through the public Vercel rewrite; no internal service binding
is currently needed. `VITE_API_URL=/api` is an optional public build-time
override and should remain relative for Vercel previews and custom domains.

- Frontend build command: `npm run build` in `frontend/`
- Backend build command: `npm run build` in `backend/`
- Required private Vercel variables: `NODE_ENV=production`, `JWT_SECRET`,
	`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and normally
	`DB_CREATE_IF_MISSING=false`.
- For TiDB Cloud, set `DB_PORT=4000`, `DB_NAME=tqi_erp`, `DB_SSL=true`, and
	`DB_SSL_CA` to the CA PEM downloaded from TiDB Cloud. `DB_HOST`, `DB_USER`, and
	`DB_PASSWORD` must come from the cluster's Public Endpoint connection details.
	The backend enforces a remote host, verified TLS/CA, and disables database
	creation in production. Optional `DB_CONNECTION_LIMIT` defaults to 5 on Vercel;
	`DB_CONNECT_TIMEOUT_MS` defaults to 10000.
- Import the supplied SQL backup into the already-provisioned TiDB database
	using your approved database migration/import workflow before connecting.
	Production startup does not create databases, run schema migrations, or
	perform table-repair DDL; existing tables must already match the application.
- Set `FRONTEND_URL` to the actual production Vercel/custom domain (and `APP_URL`
	if used) so password-reset links return to the production app.
- Preserve the currently deployed JWT secret if existing tokens must remain
	valid; all API instances must use the same secret.
- SMTP variables are optional unless OTP and workflow email delivery are used.

If the frontend is instead deployed separately on Cloudflare Pages, set its
build variable `VITE_API_URL` to the absolute `/api` URL of the backend's public
domain and include the Pages/custom frontend origin in backend `CORS_ORIGINS`.

The MySQL server must be reachable over the network from Vercel. Vercel runtime
does not run schema migrations or create production databases on request; deploy
against the existing provisioned schema and data. A local-only MySQL instance
cannot serve production traffic.

**Storage limitation:** session photos and module files are currently written to
local disk. Vercel Functions have ephemeral, non-shared storage and a 4.5 MB
request-body limit. The current multi-service configuration does not make file
uploads durable; production uploads/downloads still require a durable object
storage integration and a compatible upload flow.

---

## 🛡️ Security & Access Control

- **Role-Based Access Control (RBAC)**: Supports `Super Admin` and `Cluster Admin` roles.
- **JWT Authentication**: Secure stateless tokens with support for both Email OTP and password sign-in.
- **CORS**: Local origins are enabled for development; production requires an explicit `CORS_ORIGINS` allowlist.
- **Uploads**: Session photos are limited by count/size/type; module resources accept PDF/PPT/PPTX up to 50 MB. Persist `UPLOADS_DIR` in production.
- **Data Protection**: Environment files, generated local JWT secrets, and Vercel platform metadata are excluded from version control via `.gitignore`.

---

## 📄 License

&copy; 2026 Talent Quest for India Trust. All rights reserved.
