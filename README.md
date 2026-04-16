# Growteq Farm Management System

Full-stack farm operations platform for Growteq Agri Farms: farms, sites, evaluations, proposals, reporting, and team administration.

## Features

- **Farm management** — Farms, mapped sites, boundaries, and site records
- **Site evaluation** — Structured evaluations and workflows
- **Proposal generation** — Proposals tied to sites and approvals
- **Reports** — PDF / Excel exports where configured
- **RBAC** — Roles (`admin`, `editor`, `viewer`) plus per-module read/write permissions
- **Request-based onboarding** — Public registration creates a pending request; admins approve or reject from Settings
- **Audit logs** — Security-relevant actions recorded for review (admin / settings access)
- **Infrastructure & cost** — Shared infrastructure configuration and cost/finance views (role-gated)
- **Optional email invites** — Backend supports invite-by-email (SMTP optional); primary admin flow uses registration requests

## Tech stack

| Layer    | Stack |
|----------|--------|
| Frontend | Next.js (App Router), React, Tailwind CSS, shadcn-style UI |
| Backend  | Node.js, Express, MongoDB (Mongoose) |
| Auth     | JWT (Bearer token stored in `localStorage` as `forge_token`) |
| Package manager | pnpm |

## Project layout

```
growteq-forge/
├── app/                 # Next.js App Router (UI)
├── components/          # Shared React components
├── lib/                 # API client, permissions helpers
├── backend/
│   └── src/             # Express API, models, routes
├── public/              # Static assets (frontend)
└── README.md
```

## Prerequisites

- Node.js 20+ recommended  
- pnpm  
- MongoDB (local or Atlas)

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env: set MONGODB_URI and JWT_SECRET (required in production)
pnpm install
pnpm run build
```

Optional seed data (creates demo data; **resets** farms/sites/evaluations for that admin):

```bash
pnpm exec tsx src/seed.ts
```

Production: if login returns “account is not approved yet” but you need an admin `User` in MongoDB (without wiping data), run once from `backend/` with env set:

```bash
ENSURE_ADMIN_PASSWORD='your-secure-password' pnpm run ensure-admin
```

Run API:

```bash
pnpm run dev          # development (tsx watch)
# or after build:
pnpm run start        # serves compiled dist/server.js
```

API defaults to **http://localhost:5000** (or `PORT` in `.env`).

### 2. Frontend (repository root)

```bash
# From repository root
cp .env.example .env.local
# Ensure NEXT_PUBLIC_API_URL matches your API (e.g. http://localhost:5000)
pnpm install
pnpm dev
```

App defaults to **http://localhost:3000**.

### 3. Production notes

- Set strong `JWT_SECRET` and real `MONGODB_URI`  
- Set `FRONTEND_URL` on the backend for CORS and invite links  
- Do not commit `.env` or `.env.local`

## Demo login (after seed)

If you use the provided seed script, typical demo admin:

- **Email:** `admin@growteq.com`  
- **Password:** `admin123`  

Change or remove demo users in production.

## Registration flow

New users use **Register** to submit a request. An **admin** opens **Settings → Approve Requests** (or the **User Requests** tab), assigns role and permissions, and approves. Until approval, sign-in returns a clear “not approved” response.

## Scripts (root)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js dev server |
| `pnpm dev:backend` | API dev server (from `backend`) |
| `pnpm dev:full` | Frontend + backend together |
| `pnpm build` | Production Next.js build |

## License

Private / proprietary unless otherwise stated.
