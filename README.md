# Talent Quest for India (TQI) &middot; Academic ERP

A modern, enterprise-grade Enterprise Resource Planning (ERP) platform designed for rural education operations, field mentorship coordination, attendance tracking, and multi-tier governance across Tamil Nadu panchayats and village centres.

---

## 🌟 Architecture & Tech Stack

The platform is engineered with a decoupled, high-performance architecture:

- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind CSS v4, styled using the modern **TailAdmin** design system with full dark/light theme support.
- **Backend**: Express.js REST API with TypeScript, MySQL 8.x connection pooling, automated database migration engine, and JWT-based authentication with Role-Based Access Control (RBAC).
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

# For both Vercel and Cloudflare Pages, set this at build time:
# VITE_API_URL=https://api.yourdomain.org/api
```

Only `VITE_*` variables are included in the browser bundle. Never add database,
JWT, SMTP, or AI provider secrets to `frontend/.env` or either static-host's
environment settings.

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

### Vercel frontend

Create a Vercel project rooted at the repository root; the existing `vercel.json`
builds the Vite SPA and rewrites client-side routes to `index.html`.

- Framework: **Vite**
- Build command: `npm run build:frontend`
- Output directory: `frontend/dist`
- Required build environment variable: `VITE_API_URL=https://<your-api-domain>/api`

Deploy only the frontend from this project. The Express/MySQL backend is a
separate long-running Node service, not a static Vercel deployment.

### Cloudflare Pages frontend

Connect the repository to Cloudflare Pages. `wrangler.toml` selects
`frontend/dist`, and `frontend/public/_redirects` supplies the SPA fallback.

- Build command: `npm run build:frontend`
- Output directory: `frontend/dist`
- Required build environment variable: `VITE_API_URL=https://<your-api-domain>/api`

Cloudflare Pages deploys only the frontend; do not put backend secrets in Pages
variables. The Pages URL must also be included in the backend's `CORS_ORIGINS`.

### Separate backend and MySQL

Deploy the Express API to a Node.js host that supports a persistent writable
volume. Build with `npm run build:backend`, then run `npm start` (the root
`prestart` hook builds the backend as well). Configure `PORT`, `DB_HOST`,
`DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`, `DB_SSL_CA`,
`DB_CREATE_IF_MISSING=false`, `JWT_SECRET`, `CORS_ORIGINS`, `UPLOADS_DIR`,
`APP_URL`, `FRONTEND_URL`, and `NODE_ENV=production`. Set
`ADMIN_DEFAULT_PASSWORD` if the production database is being bootstrapped for
the first time. Add each exact production Vercel, Pages, and
custom-domain origin to comma-separated `CORS_ORIGINS`; avoid `*`.

Use a managed MySQL 8+ database reachable from the backend host. Use a dedicated
least-privilege DB user, TLS (`DB_SSL=true`, with `DB_SSL_CA` when required),
and provision the database before startup (`DB_CREATE_IF_MISSING=false`). The
backend applies existing SQL migrations on startup. Mount persistent storage at
`UPLOADS_DIR` or configure durable external storage before using an ephemeral
backend host; uploaded photos and module PDFs/PPTs are stored on disk today.

For production, set a unique `JWT_SECRET` of at least 32 characters. If the
database has no users yet, set a strong `ADMIN_DEFAULT_PASSWORD`; it is never
printed to logs. In local development only, an empty value retains the existing
`admin@tqi.org` / `admin123` bootstrap behavior. Configure SMTP variables if
OTP and workflow email delivery are required.

---

## 🛡️ Security & Access Control

- **Role-Based Access Control (RBAC)**: Supports `Super Admin` and `Cluster Admin` roles.
- **JWT Authentication**: Secure stateless tokens with support for both Email OTP and password sign-in.
- **CORS**: Local origins are enabled for development; production requires an explicit `CORS_ORIGINS` allowlist.
- **Uploads**: Session photos are limited by count/size/type; module resources accept PDF/PPT/PPTX up to 50 MB. Persist `UPLOADS_DIR` in production.
- **Data Protection**: Environment files, Cloudflare local vars, and platform metadata are excluded from version control via `.gitignore`.

---

## 📄 License

&copy; 2026 Talent Quest for India Trust. All rights reserved.
