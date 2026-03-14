# Growteq Farm Management System — Architecture Summary

This document gives a developer a fast, structured understanding of the full system without reading every file.

---

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GROWTEQ FARM MANAGEMENT                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 14)          │  Backend (Express + TypeScript)           │
│  • React 18, Tailwind, Radix   │  • REST API, JWT auth                       │
│  • Axios client → API_URL      │  • Mongoose → MongoDB                      │
│  • Auth via localStorage token │  • CORS: FRONTEND_ORIGIN                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────────┐
                              │  MongoDB (Atlas)    │
                              │  MONGODB_URI        │
                              │  Users, Farms,      │
                              │  Sites, Evaluations,│
                              │  Proposals, Notifs  │
                              └─────────────────────┘
```

- **Frontend**: Next.js app (App Router), runs on port 3000 by default. Uses `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:5000`) for API calls.
- **Backend**: Express API, runs on port 5000. Connects to MongoDB via `MONGODB_URI`, validates JWT on protected routes.
- **Database**: MongoDB. All entities use Mongoose schemas with `_id` (ObjectId) and timestamps.

---

## 2. Project Architecture

### Frontend stack

| Layer        | Technology |
|-------------|------------|
| Framework   | Next.js 14 (App Router) |
| UI          | React 18, Tailwind CSS, Radix UI (shadcn-style components) |
| State / API | React state, `lib/api.ts` (Axios), AuthContext |
| Maps        | Leaflet, react-leaflet, @turf/turf |
| Charts      | Recharts |
| HTTP        | Axios (baseURL from `NEXT_PUBLIC_API_URL`), some pages use `fetch` with same base |

### Backend stack

| Layer        | Technology |
|-------------|------------|
| Runtime     | Node.js, TypeScript (tsx in dev) |
| Server      | Express 4 |
| Database    | MongoDB via Mongoose 8 |
| Auth        | JWT (jsonwebtoken), bcryptjs for passwords |
| PDF         | jsPDF, pdfkit (reports/proposals) |

### Database structure

- **Single MongoDB database** (name from `MONGODB_URI`).
- **Collections** (one per model): `users`, `farms`, `sites`, `siteevaluations`, `proposals`, `notifications`.
- **Relations**: User → Farms, SiteEvaluations, Proposals, Notifications; Farm → Sites (optional farmId); SiteEvaluation → Proposals (siteEvaluationId).

---

## 3. Folder-by-Folder Explanation

### Root

- **`package.json`** — Root scripts: `dev`, `dev:backend`, `dev:full` (frontend + backend), `build`, `lint`.
- **`ARCHITECTURE.md`** — This file.

### Frontend

| Folder / file       | Purpose |
|---------------------|--------|
| **`app/`**          | Next.js App Router: pages, layouts, providers. |
| `app/layout.tsx`    | Root layout (font, Providers, optional Google Maps script). |
| `app/page.tsx`      | Landing page. |
| `app/login/page.tsx`| Login form; uses `authApi.login`, stores token, redirects. |
| `app/logout/page.tsx` | Clears token and redirects. |
| `app/providers.tsx` | Wraps app with AuthProvider (and any other providers). |
| `app/context/auth-context.tsx` | Auth state: user, login, logout, `forge_token` in localStorage, `authApi.me()` on load. |
| `app/context/company-context.tsx` | Company/organization context for UI. |
| `app/dashboard/`   | Protected dashboard: layout (sidebar, nav), overview, farms, insights, etc. |
| `app/dashboard/layout.tsx` | Dashboard shell: sidebar nav (Overview, Dashboard, Farms, Crops, Finance, Reports, Insights, Settings), auth, notifications drawer. |
| `app/dashboard/ProtectedLayout.tsx` | Redirects unauthenticated users to login. |
| `app/dashboard/overview/page.tsx` | Overview: calls `dashboardApi.summary()`, shows totalSites, totalArea, totalProposals, pipelineValue, averageROI. |
| `app/dashboard/dashboard/page.tsx` | Work-in-progress dashboard: current site work, pending submissions, proposal generation. |
| `app/dashboard/farms/page.tsx` | Farms list, site evaluations, map (Leaflet), create farm/site evaluation. |
| `app/dashboard/insights/page.tsx` | Analytics: pipeline, site ranking, ROI distribution (fetches from `/api/insights/*`). |
| `app/dashboard/site-evaluations/[id]/page.tsx` | Single site evaluation: boundary, cost, proposal recommend/PDF. |
| `app/dashboard/finance/page.tsx` | Finance view; uses cost API by siteId. |
| `app/dashboard/reports/page.tsx` | Reports. |
| `app/dashboard/settings/page.tsx` | Settings. |
| **`components/`**   | Reusable UI and feature components. |
| `components/ui/`    | Primitive UI (button, card, input, dialog, table, etc.). |
| `components/navigation/` | User profile, company/location selectors, last-login. |
| `components/notifications/notifications-drawer.tsx` | Notifications list; uses notifications API. |
| `components/welcome-modal.tsx` | Post-login welcome. |
| **`hooks/`**       | Shared React hooks (e.g. `use-toast.ts`). |
| **`lib/`**         | Shared frontend logic and API client. |
| `lib/api.ts`       | **Central API layer**: Axios instance (baseURL from `NEXT_PUBLIC_API_URL`), Bearer token from `forge_token`, `authApi`, `farmsApi`, `siteEvaluationsApi`, `proposalsApi`, `notificationsApi`, `dashboardApi`. All return `{ success, data }`-style responses. |
| `lib/utils.ts`     | Utilities (e.g. `cn` for classnames). |
| `lib/map-provider.ts` | Map context/provider if used. |

### Backend

| Folder / file           | Purpose |
|-------------------------|--------|
| **`backend/src/config/`** | App and DB configuration. |
| `config/db.ts`          | `connectDb()`: `mongoose.connect(process.env.MONGODB_URI)`, logs "MongoDB connected". Used in `server.ts` before starting Express. |
| `config/env.ts`         | Reads PORT, NODE_ENV, MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN (dotenv). |
| **`backend/src/models/`** | Mongoose schemas (collections). |
| `models/User.ts`        | email, password (hashed), name, role (admin/user), timestamps. |
| `models/Farm.ts`        | name, description?, location?, userId (ref User), timestamps. |
| `models/Site.ts`        | name, geojson, area, perimeter, farmId? (ref Farm), timestamps. |
| `models/SiteEvaluation.ts` | name, userId, farmId?, boundary[], area, areaUnit, slope?, infrastructureRecommendation?, costEstimate?, costCurrency?, status (draft/submitted), timestamps. |
| `models/Proposal.ts`    | title, siteEvaluationId, userId, content (Mixed), status (draft/sent), timestamps. |
| `models/Notification.ts`| userId, user (name, avatar), action, content, isRead, newNotification, timestamps. |
| **`backend/src/routes/`** | Express routers mounted under `/api/*`. |
| **`backend/src/controllers/`** | Request handlers (DB access, response shape). |
| **`backend/src/middleware/`** | auth (JWT → req.auth), errorHandler, requestLogger, role. |
| **`backend/src/services/`** | costEngine (cost by area + infrastructure type), tokenService. |
| **`backend/src/utils/`**   | asyncHandler, ApiError. |
| **`backend/src/server.ts`** | Express app, CORS, JSON, mounts all API routes, connectDb then start server. |

---

## 4. API Workflow

### How the frontend calls the backend

1. **Base URL**: `lib/api.ts` uses `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:5000`). Set in `.env` or env.
2. **Auth**: After login, token is stored in `localStorage` as `forge_token`. Axios interceptor adds `Authorization: Bearer <token>` to every request from `api`.
3. **Pattern**: Pages use `authApi`, `farmsApi`, `siteEvaluationsApi`, `proposalsApi`, `notificationsApi`, `dashboardApi` from `lib/api.ts`. Some pages (e.g. insights, finance, farms) also use `fetch`; for those, the backend must be reachable at the same origin or they must prefix with `NEXT_PUBLIC_API_URL` (insights currently uses relative `/api/insights/*` and may need that base URL to hit the Express server).

### Example: `/api/sites`

- **Frontend** (e.g. farms page): `fetch(\`${baseURL}/api/sites\`, { method: 'POST', body: JSON.stringify({ name, geojson, area, perimeter }) })` with Bearer token.
- **Backend** `routes/sites.ts`: `POST /` → authMiddleware → validate body → `Site.create({ name, geojson, area, perimeter })` → respond `201` with `{ success: true, data: { ...site, id: _id } }`.
- **Data flow**: Frontend → Express → Mongoose → MongoDB (insert) → Mongoose → Express → JSON → Frontend.

### Example: `/api/dashboard/summary`

- **Frontend** (`overview/page.tsx`): `dashboardApi.summary()` → GET `NEXT_PUBLIC_API_URL/api/dashboard/summary` with Bearer token.
- **Backend** `routes/dashboard.ts`: GET `/summary` → authMiddleware → `getSummary` (dashboardController).
- **Controller**: Loads farms and site evaluations for `req.auth.userId`, runs SiteEvaluation aggregation (revenue, draft/submitted counts, monthly revenue), returns `{ success: true, data: { activeSites, totalLandArea, farms, evaluations, totalRevenue, monthlyRevenue, ... } }`.
- **Note**: The frontend Overview expects `totalSites`, `totalArea`, `totalProposals`, `pipelineValue`, `averageROI`. The current backend returns a different shape (e.g. `activeSites`, `totalLandArea`, `totalRevenue`). Either the backend should expose the overview metrics or the frontend should map from the current payload.

### Example: `/api/insights`

- **Endpoints**: `GET /api/insights/pipeline`, `GET /api/insights/site-ranking`, `GET /api/insights/roi-distribution`.
- **Frontend** (`insights/page.tsx`): Uses `fetch("/api/insights/pipeline")` etc. (relative). To hit the Express backend, these should use the same base URL as the rest of the API (e.g. `NEXT_PUBLIC_API_URL`).
- **Backend** `routes/insights.ts**: Auth → Proposal.find() / Site.find() → pipeline value (sum of proposal content.investment/estimatedCost), proposal count; site ranking (sites by area); ROI distribution (content.roiMonths + investment). Response shape: `{ success: true, data: ... }`.

### Example: `/api/proposals`

- **Frontend**: `proposalsApi.list()`, `proposalsApi.create({ title, siteEvaluationId, content })`, etc., from `lib/api.ts` → backend `/api/proposals`.
- **Backend** `routes/proposals.ts`: GET `/`, POST `/`, GET `/:id`, PATCH `/:id`, GET `/:id/pdf`, plus recommend/save and site/farm-scoped lists. Controllers use Proposal and SiteEvaluation models and return `{ success: true, data }`.

### End-to-end data flow

```
Frontend (React)  →  Axios/fetch (Bearer token)  →  Express (CORS, auth)
  →  Route  →  Controller  →  Mongoose model  →  MongoDB
  →  Model  →  Controller  →  res.json({ success, data })  →  Frontend
```

---

## 5. Database Schema (MongoDB Collections)

| Collection         | Model            | Key fields |
|--------------------|------------------|------------|
| **users**          | User             | email (unique), password (hashed), name, role (admin/user), timestamps. |
| **farms**          | Farm             | name, description?, location?, userId (ref User), timestamps. |
| **siteevaluations**| SiteEvaluation   | name, userId, farmId?, boundary[], area, areaUnit, slope?, infrastructureRecommendation?, costEstimate?, costCurrency?, status (draft/submitted), timestamps. |
| **sites**          | Site             | name, geojson, area, perimeter, farmId?, timestamps. |
| **proposals**       | Proposal         | title, siteEvaluationId (ref SiteEvaluation), userId, content (Mixed: e.g. investment, roiMonths), status (draft/sent), timestamps. |
| **notifications**  | Notification     | userId, user (name, avatar), action, content, isRead, newNotification, timestamps. |

- All use **`_id`** (ObjectId) and **timestamps** (createdAt, updatedAt).
- References are stored as ObjectIds; `.populate()` is used where needed (e.g. proposal → siteEvaluation).

---

## 6. Analytics / Dashboard Metrics Logic

- **Total sites**: In the **current** backend, dashboard summary does not return a field named `totalSites`. It returns `activeSites` (count of site evaluations for the user) and `totalFarms`. So “total sites” in the UI could be mapped from `activeSites` or from a future backend field that counts Site + SiteEvaluation.
- **Total area**: From **SiteEvaluation**: sum of `area` for the user’s evaluations → exposed as `totalLandArea` in the dashboard summary.
- **Pipeline value**: In **insights** route: sum of `content.investment` (or `content.estimatedCost`) across all Proposals. In dashboard controller, **totalRevenue** is sum of `costEstimate` of submitted SiteEvaluations (different concept: evaluation cost, not proposal investment).
- **Average ROI**: Not computed in the current dashboard controller. Could be derived from Proposals’ `content.roiMonths` (e.g. in insights) and then averaged; Overview expects `averageROI` from the summary API.
- **Revenue trend**: Dashboard controller returns **monthlyRevenue**: aggregation on SiteEvaluation (status submitted) by month from `updatedAt`, sum of `costEstimate` per month. Frontend Overview shows a placeholder for “Connect monthly revenue analytics”; the data exists in the summary response as `monthlyRevenue`.

Cost per acre and infrastructure (used in cost route and costEngine):

- **costEngine** (`services/costEngine.ts`): `calculateCost(area, infrastructure)` uses fixed cost per acre: Polyhouse 8L, Shade Net 4L, Open Field 1.5L (INR). Used for estimates and cost API logic.

---

## 7. Code Relationships (Models ↔ Routes ↔ Controllers)

- **Auth**: `routes/auth.ts` → `authController` (login, register, me) → User model, JWT, bcrypt.
- **Farms**: `routes/farms.ts` → `farmController` (list, create, get, update, delete) → Farm model, filtered by `userId`.
- **Sites**: `routes/sites.ts` → inline POST create → Site model; GET/PUT/DELETE and details/boundary/export → `siteEvaluationController` (SiteEvaluation model).
- **Site evaluations**: `routes/siteEvaluations.ts` → `siteEvaluationController` → SiteEvaluation model.
- **Proposals**: `routes/proposals.ts` → `proposalController` (list, create, get, update, PDF, recommend, save, by site/farm) → Proposal, SiteEvaluation.
- **Notifications**: `routes/notifications.ts` → `notificationController` → Notification model.
- **Dashboard**: `routes/dashboard.ts` → `dashboardController.getSummary` → Farm, SiteEvaluation (and aggregation).
- **Cost**: `routes/cost.ts` → inline handler → SiteEvaluation.findById, Site.findById (by ObjectId), then cost formula (costPerAcre × area, etc.).
- **Insights**: `routes/insights.ts` → inline handlers → Proposal.find(), Site.find(); pipeline value, site ranking, ROI distribution.
- **Maps**: `routes/maps.ts` → `mapsController` (e.g. snapshot).
- **Reports**: `routes/reports.ts` → `reportsController`.

All protected routes use `authMiddleware` (JWT → `req.auth.userId`). Controllers use `asyncHandler` and throw `ApiError`; errors are handled by `errorHandler` middleware.

---

## 8. Key Files to Understand the Project Quickly

| Goal                     | Files to read |
|--------------------------|----------------|
| How frontend talks to API | `lib/api.ts` |
| Auth flow                 | `app/context/auth-context.tsx`, `backend/src/middleware/auth.ts`, `backend/src/controllers/authController.ts` |
| Dashboard data            | `app/dashboard/overview/page.tsx`, `backend/src/controllers/dashboardController.ts`, `backend/src/routes/dashboard.ts` |
| Farms & site evaluations  | `app/dashboard/farms/page.tsx`, `backend/src/controllers/farmController.ts`, `backend/src/controllers/siteEvaluationController.ts` |
| Proposals & cost          | `backend/src/routes/proposals.ts`, `backend/src/controllers/proposalController.ts`, `backend/src/routes/cost.ts`, `backend/src/services/costEngine.ts` |
| Insights / analytics      | `backend/src/routes/insights.ts`, `app/dashboard/insights/page.tsx` |
| DB and config             | `backend/src/config/db.ts`, `backend/src/server.ts`, all under `backend/src/models/` |
| Route mounting            | `backend/src/server.ts` (lines 63–73) |

---

## 9. Summary

- **Growteq** is a farm management app: users manage farms, site evaluations (with boundaries and infrastructure recommendations), and proposals. The dashboard and insights show aggregates and trends.
- **Frontend**: Next.js 14, React, Tailwind, Radix; main API client in `lib/api.ts` with Bearer token; some pages use `fetch` and should use the same API base URL for insights/cost.
- **Backend**: Express + Mongoose; JWT auth; all data in MongoDB (User, Farm, Site, SiteEvaluation, Proposal, Notification).
- **Data flow**: Request → auth → route → controller → model → MongoDB → same path back as `{ success, data }`.
- **Dashboard metrics**: Total area and revenue/trend come from SiteEvaluation aggregation; pipeline value and ROI from Proposals (insights). Overview page expects a summary shape that the current dashboard/summary endpoint may need to align with (totalSites, totalArea, totalProposals, pipelineValue, averageROI).

Using this document plus the key files above, a developer can navigate and extend the system without reading every file.
