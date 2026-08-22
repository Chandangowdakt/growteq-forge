# Growteq Forge

Growteq Forge is a farm operations app for Growteq Agri Farms. It covers farms and mapped sites, site evaluations, proposals, reports, finance/insights, and team administration.

**Frontend:** Next.js 14 (App Router) at the repo root. **API:** Express + TypeScript in `backend/`. **Database:** MongoDB via **Mongoose**.

New users **register a request**. An **admin** must approve it before they can sign in.

---

## Tech stack

| Layer | This repo |
|--------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Radix UI |
| HTTP | Axios (`lib/api.ts`) |
| Maps / charts | Leaflet, react-leaflet, Turf, Recharts |
| Backend | Node.js, Express, TypeScript |
| Database | **MongoDB** via **Mongoose** |
| Auth | JWT (`Authorization: Bearer`); token in `localStorage` as `forge_token` |
| Reports | jsPDF, pdfkit, sharp |
| Packages | **pnpm** |

**Prisma is not used.** Leftover generated files live under `backend/src/generated/prisma/`. Runtime data access is Mongoose models in `backend/src/models/`. Do not add Prisma `DATABASE_URL` or migrations for this app.

---

## Folder structure

```
growteq-forge/
├── app/                         # Next.js App Router (login, register, dashboard)
├── components/                  # Shared UI
├── lib/                         # API client, permissions
├── hooks/
├── public/                      # Frontend static files
├── styles/                      # Global CSS
├── backend/
│   ├── src/
│   │   ├── config/              # env, MongoDB
│   │   ├── models/             # Mongoose schemas
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── scripts/           # ensureAdminUser.ts
│   │   ├── seed.ts            # demo seed (destructive)
│   │   └── generated/prisma/ # unused leftover
│   └── public/
├── .env.example                  # frontend env names → copy to .env.local
├── backend/.env.example         # backend env names → copy to backend/.env
└── README.md
```

---

## Prerequisites

- Node.js 20+
- pnpm
- MongoDB (local or Atlas)

---

## Environment variables

Copy the example files and set values on your machine. **Never commit** `.env`, `.env.local`, or `backend/.env`.

Names only — no secrets or sample values here.

### Frontend (`.env.local` at repo root)

| Name | Required | Role |
|------|----------|------|
| `NEXT_PUBLIC_API_URL` | Recommended | Express base URL (code falls back if unset) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Optional Google Maps script |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | No | Optional Mapbox tiles on the farms map |

### Backend (`backend/.env`)

The API **exits on startup** if `MONGODB_URI` or `JWT_SECRET` is missing.

| Name | Required | Role |
|------|----------|------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | JWT signing |
| `JWT_EXPIRES_IN` | No | Token lifetime |
| `PORT` | No | API port |
| `NODE_ENV` | No | `development` / `production` |
| `FRONTEND_URL` | Recommended | CORS and invite links |
| `FRONTEND_ORIGIN` | No | Extra CORS origin |
| `MAPBOX_TOKEN` | No | PDF / maps satellite snapshots |
| `SMTP_HOST` | No | Email invites (omit to log links in the console) |
| `SMTP_PORT` | No | SMTP port |
| `SMTP_SECURE` | No | SMTP TLS flag |
| `SMTP_USER` | No | SMTP user |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From address |

**Admin recovery script only** (not needed to start the servers): `ENSURE_ADMIN_EMAIL`, `ENSURE_ADMIN_PASSWORD`, `ENSURE_ADMIN_NAME`, `ADMIN_PASSWORD`.

---

## Setup

### Backend

```bash
cd backend
cp .env.example .env
pnpm install
```

Set `MONGODB_URI` and `JWT_SECRET` in `backend/.env`.

### Frontend

From the repository root:

```bash
cp .env.example .env.local
pnpm install
```

Set `NEXT_PUBLIC_API_URL` to the API origin (same host/port as `PORT` in `backend/.env`).

---

## Run locally

Default ports: API **5000**, Next.js **3000**.

**Two terminals**

```bash
# API
cd backend
pnpm run dev

# UI (repo root)
pnpm dev
```

**One command (root)**

```bash
pnpm dev:full
```

Open the Next.js URL in the browser. Unauthenticated visits go to `/login`.

API health: `GET /health` on the backend port.

---

## Admin access

Sign-up does not create a live `User` until an admin approves the request. If you have **no admin** in MongoDB, from `backend/`:

```bash
pnpm exec tsx src/scripts/ensureAdminUser.ts
```

Or `pnpm run ensure-admin` with `ENSURE_ADMIN_PASSWORD` set.

If the user exists and you need a new password:

```bash
pnpm exec tsx src/scripts/ensureAdminUser.ts --reset
```

You can pass the password as a CLI argument. Default email is `admin@growteq.com` unless `ENSURE_ADMIN_EMAIL` is set.

`pnpm run seed` (`src/seed.ts`) loads demo data and **deletes** that admin’s farms/sites/evaluations/proposals. Use `ensureAdminUser` if you only need login.

---

## Scripts

**Root**

| Command | Description |
|---------|-------------|
| `pnpm dev` | Next.js dev server |
| `pnpm dev:backend` | Express API |
| `pnpm dev:full` | Frontend + backend |
| `pnpm build` | Next.js production build |
| `pnpm start` | Next.js production server |
| `pnpm lint` | Lint |

**`backend/`**

| Command | Description |
|---------|-------------|
| `pnpm run dev` | API with tsx watch |
| `pnpm run build` | Compile to `dist/` |
| `pnpm run start` | Run compiled server |
| `pnpm run typecheck` | TypeScript check |
| `pnpm run seed` | Demo seed (destructive) |
| `pnpm run ensure-admin` | Create or recover admin `User` |

---

## Registration

1. **Register** → `POST /api/auth/register` → pending `UserRequest`.
2. Admin approves in **Settings** (role and permissions).
3. Until then, login reports that the account is not approved.

---

## License

Private / proprietary unless otherwise stated.
