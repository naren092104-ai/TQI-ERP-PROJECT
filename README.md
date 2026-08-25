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
│   │   ├── controllers/      # Route controllers (Auth, Students, Sessions, Finance, etc.)
│   │   ├── middleware/       # JWT auth & RBAC validation middleware
│   │   ├── routes/           # REST API routes
│   │   ├── utils/            # Migration runner, db pool, email service
│   │   └── server.ts         # Application entry point
│   ├── tsconfig.json
│   └── .env.example
├── frontend/                 # React 19 + TypeScript Client (TailAdmin UI)
│   ├── src/
│   │   ├── components/       # UI Views (Dashboard, Attendance, Finance, Approvals, etc.)
│   │   │   └── ui/           # TailAdmin design system primitives (Card, Badge, Table, Modal)
│   │   ├── context/          # SidebarContext & ThemeProvider
│   │   ├── types.ts          # TypeScript domain interfaces
│   │   └── index.css         # TailAdmin design tokens & Outfit typography
│   ├── vite.config.ts
│   └── .env.example
├── database/
│   └── migrations/           # Versioned MySQL migration scripts (001_initial_schema.sql, etc.)
├── storage/
│   └── uploads/              # Runtime uploads directory (photos, bills, documents)
├── package.json              # Monorepo root scripts
└── README.md
```

---

## ⚙️ Environment Configuration

### 1. Backend Environment Setup (`backend/.env` or root `.env`)

Create a `.env` file in `backend/` or the project root based on `.env.example`:

```env
# Server Port
PORT=5000

# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=TQI_ERP
DB_USER=root
DB_PASSWORD=your_mysql_password

# Authentication & Security
JWT_SECRET=your_secure_jwt_secret_key
UPLOADS_DIR=storage/uploads

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

# For production deployment:
# VITE_API_URL=https://api.yourdomain.org/api
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.x or higher
- **MySQL Server**: v8.0 or higher

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/Mithunp123/TQI_ERP.git
cd TQI_ERP

# Install dependencies for the entire project
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
| `npm start` | Runs the compiled production server (`backend/dist/server.cjs`) |

---

## 🛡️ Security & Access Control

- **Role-Based Access Control (RBAC)**: Supports `Super Admin`, `State Lead`, `Cluster Admin`, `Finance Team`, `Auditor`, and `Volunteer` roles.
- **JWT Authentication**: Secure stateless tokens with support for both Email OTP and password sign-in.
- **Data Protection**: Sensitive environment variables are excluded from version control via `.gitignore`.

---

## 📄 License

&copy; 2026 Talent Quest for India Trust. All rights reserved.
