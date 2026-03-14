# Growteq Farm Management System

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env   # fill in MONGODB_URI and JWT_SECRET
pnpm install
pnpm tsx src/seed.ts   # load demo data
pnpm run dev           # starts on http://localhost:5000
```

### Frontend

```bash
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL
pnpm install
pnpm dev                     # starts on http://localhost:3000
```

## Demo Login

- **Email:** admin@growteq.com  
- **Password:** admin123  

## Pages

| Path | Description |
|------|-------------|
| `/login` | Sign in |
| `/register` | Create account |
| `/dashboard/overview` | KPI summary |
| `/dashboard/dashboard` | Active site work |
| `/dashboard/farms` | Map + site drawing |
| `/dashboard/crops` | Infrastructure guide |
| `/dashboard/finance` | Cost analysis |
| `/dashboard/reports` | PDF/Excel downloads |
| `/dashboard/insights` | Analytics |
| `/dashboard/settings` | Team + config |

## Tech Stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS  
- **Backend:** Node.js, Express, MongoDB (Mongoose)  
- **Auth:** JWT (Bearer token in `localStorage` as `forge_token`)
