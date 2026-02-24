# Forge Backend

Node.js + Express + TypeScript + MongoDB API for the Farm Infrastructure Planning app.

## Setup

1. Copy `.env.example` to `.env` and set:
   - `MONGODB_URI` (default: `mongodb://localhost:27017/forge`)
   - `JWT_SECRET` (required in production)
   - `PORT` (default: 5000)

2. Install and run:
   ```bash
   pnpm install
   pnpm run dev
   ```

## Scripts

- `pnpm run dev` — start with tsx watch (development)
- `pnpm run build` — compile TypeScript to `dist/`
- `pnpm run start` — run compiled `dist/server.js`

## API Base

- Base URL: `http://localhost:5000` (or `NEXT_PUBLIC_API_URL` from frontend)
- Health: `GET /health`

## Auth

- `POST /api/auth/register` — body: `{ email, password, name, role? }`
- `POST /api/auth/login` — body: `{ email, password }`
- `GET /api/auth/me` — header: `Authorization: Bearer <token>`

All other routes require `Authorization: Bearer <token>`.

## Modules

- **Farms** — `GET/POST /api/farms`, `GET/PATCH/DELETE /api/farms/:id`
- **Site evaluations** — `GET/POST /api/site-evaluations`, `GET/PATCH/DELETE /api/site-evaluations/:id`
- **Proposals** — `GET/POST /api/proposals`, `GET/PATCH /api/proposals/:id`
- **Notifications** — `GET/POST /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`

## Mongo

Ensure MongoDB is running (local or Atlas). Connection string in `MONGODB_URI`.
