# Growteq Forge — API reference

There are **no Next.js Route Handlers** (`app/api`). The UI calls the **Express** server in `backend/`.

| | |
|--|--|
| Base URL (local) | `http://localhost:5000` (or `NEXT_PUBLIC_API_URL`) |
| JSON envelope | `{ "success": true, "data": ... }` or `{ "success": false, "error": "..." }` |
| Auth header | `Authorization: Bearer <jwt>` |
| Token storage (browser) | `localStorage` key `forge_token` |

**Roles (canonical):** `admin` · `editor` · `viewer`  
**Permission modules:** `farms` · `sites` · `evaluations` · `proposals` · `reports` · `finance` · `settings`  
Each module has `{ read, write }`. Admins skip module checks. Users without **write** on a module are often limited to their own records.

Replace `BASE` and `<TOKEN>` in examples. Do not commit real tokens.

---

## Conventions

```http
Authorization: Bearer <TOKEN>
Content-Type: application/json
```

Typical errors:

| Status | Meaning |
|--------|---------|
| 400 | Validation / invalid JSON body |
| 401 | Missing or invalid JWT |
| 403 | Role or module permission denied; or registration not approved |
| 404 | Resource not found |
| 500 | Unhandled server error |

---

## Public (no JWT)

### `GET /`

Liveness JSON.

**Response:** `{ "ok": true, "api": "Forge API" }`

```bash
curl -s BASE/
```

### `GET /health`

Process health (used by the UI warmup ping).

**Response:** `{ "ok": true, "service": "forge-backend", "uptime": number, "timestamp": string, "environment": string }`

```bash
curl -s BASE/health
```

---

## Auth — `/api/auth`

### `POST /api/auth/register`

**Auth:** none. Creates a **pending** `UserRequest` (not a `User`).

**Body:**

```json
{
  "email": "user@example.com",
  "password": "<password>",
  "name": "Jane Doe",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "viewer"
}
```

`name` **or** `firstName` + `lastName` required. `role` is a request hint (normalized to admin/editor/viewer).

**Response `202`:** `{ "success": true, "message": "Request submitted. Await admin approval.", "data": { "submitted": true } }`

```bash
curl -s -X POST BASE/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"user@example.com\",\"password\":\"********\",\"name\":\"Jane Doe\"}"
```

### `POST /api/auth/login`

**Auth:** none.

**Body:** `{ "email": string, "password": string }`

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "<objectId>",
      "email": "user@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "admin",
      "permissions": {
        "farms": { "read": true, "write": true },
        "sites": { "read": true, "write": true },
        "evaluations": { "read": true, "write": true },
        "proposals": { "read": true, "write": true },
        "reports": { "read": true, "write": true },
        "finance": { "read": true, "write": true },
        "settings": { "read": true, "write": true }
      }
    }
  }
}
```

**403** if a matching `UserRequest` is pending or rejected. **401** invalid credentials.

```bash
curl -s -X POST BASE/api/auth/login -H "Content-Type: application/json" --data-binary "@login.json"
```

### `GET /api/auth/me`

**Auth:** JWT.

**Response:** `{ "success": true, "data": { "user": { "id", "email", "firstName", "lastName", "name", "role", "permissions" } } }`

```bash
curl -s BASE/api/auth/me -H "Authorization: Bearer <TOKEN>"
```

---

## Farms — `/api/farms`

All routes: JWT. Extra: `farms` read/write except delete.

| Method | Path | Permission |
|--------|--------|------------|
| GET | `/api/farms` | `farms` read |
| POST | `/api/farms` | `farms` write |
| GET | `/api/farms/:farmId` | `farms` read |
| PUT, PATCH | `/api/farms/:farmId` | `farms` write |
| GET | `/api/farms/:farmId/sites` | `farms` read |
| DELETE | `/api/farms/:farmId` | **role `admin` only** |

**POST body:** `{ "name": string (required), "location"?, "totalArea"?, "country"?, "state"?, "district"?, "description"? }`

**PUT/PATCH body:** same fields, partial.

**List/get `data`:** farm document + `siteCount`. Soft-deleted farms (`deletedAt`) are omitted.

```bash
curl -s BASE/api/farms -H "Authorization: Bearer <TOKEN>"
curl -s -X POST BASE/api/farms -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d "{\"name\":\"North Block\",\"location\":\"Karnataka\"}"
```

---

## Sites — `/api/sites`

JWT + `sites` read/write.

| Method | Path | Permission |
|--------|--------|------------|
| POST | `/api/sites` | write |
| GET | `/api/sites/:siteId` | read (own-scope may 403) |
| PATCH | `/api/sites/:siteId` | write |
| DELETE | `/api/sites/:siteId` | write |

**POST body:** `{ "farmId", "name", "geojson", "area", "perimeter", "slope"?, "notes"? }`  
(`createdBy` is set from the JWT.)

**PATCH body:** `{ "name"?, "notes"?, "status"? }` (`draft` \| `submitted` \| `approved` \| `rejected`)

**Response:** `{ "success": true, "data": <site> }` (POST also adds `id`.)

```bash
curl -s BASE/api/sites/<SITE_ID> -H "Authorization: Bearer <TOKEN>"
```

List of sites for a farm is **`GET /api/farms/:farmId/sites`**, not under `/api/sites`.

---

## Site evaluations — `/api/site-evaluations`

JWT + `evaluations` read/write.

| Method | Path | Permission |
|--------|--------|------------|
| GET | `/api/site-evaluations` | read |
| POST | `/api/site-evaluations` | write |
| GET | `/api/site-evaluations/:id` | read |
| PATCH | `/api/site-evaluations/:id` | write |
| PATCH | `/api/site-evaluations/:id/status` | write |
| DELETE | `/api/site-evaluations/:id` | write |

**GET query:** `farmId`, `siteId`, `status`.

**POST body (required):** `siteId`, `farmId`, `soilType`, `waterAvailability`, `slopePercentage`  
**Optional:** `elevationMeters`, `sunExposure`, `notes`, `infrastructureType`, `numberOfUnits`, `cropType`, `calculatedInvestment`.

If `infrastructureType` is omitted, type is chosen from slope (≤5 polyhouse, ≤10 shade net, else open field).

**PATCH `:id/status` body:** `{ "status": "submitted" \| "approved" \| "rejected" }`

**List `data`:** evaluations (populated farm/site) plus `proposalId` when a proposal exists.

```bash
curl -s "BASE/api/site-evaluations?status=submitted" -H "Authorization: Bearer <TOKEN>"
```

---

## Proposals — `/api/proposals`

JWT + `proposals` read/write.

| Method | Path | Permission |
|--------|--------|------------|
| GET | `/api/proposals` | read |
| POST | `/api/proposals` | write |
| POST | `/api/proposals/recommend` | write |
| POST | `/api/proposals/save` | write |
| GET | `/api/proposals/site/:siteId` | read |
| GET | `/api/proposals/farm/:farmId` | read |
| GET | `/api/proposals/:id` | read |
| PATCH | `/api/proposals/:id` | write |
| GET | `/api/proposals/:id/pdf` | read (PDF stream) |

**POST body:** `{ "title": string, "siteEvaluationId": string, "content"?: object }`

**Recommend body:** `{ "siteId": string, "area"?: number, "slope"?: number }` → creates a proposal from the recommendation engine.

**Save body:** `{ "siteId", "infrastructureType"?, "estimatedCost"?, "roiMonths"?, "suitabilityScore"? }`

**PATCH body:** arbitrary `$set` fields on the proposal document.

**PDF:** `GET /api/proposals/:id/pdf` — `:id` must be a **proposal** id (not a site-evaluation id).

```bash
curl -s BASE/api/proposals -H "Authorization: Bearer <TOKEN>"
curl -s BASE/api/proposals/<PROPOSAL_ID>/pdf -H "Authorization: Bearer <TOKEN>" -o proposal.pdf
```

---

## Notifications — `/api/notifications`

JWT only (no module check).

| Method | Path |
|--------|------|
| GET | `/api/notifications` |
| GET | `/api/notifications/unread-count` |
| POST | `/api/notifications` |
| PUT, POST | `/api/notifications/read-all` |
| PUT, PATCH | `/api/notifications/:id/read` |
| DELETE | `/api/notifications/:id` |

**POST body:** `{ "userId"?, "title"?, "message"?, "type"?, "action"?, "content"?, "user"? }`  
Defaults to the current user; `type` defaults to `"info"`.

**Unread:** `{ "success": true, "data": { "count": number } }`

---

## Dashboard — `/api/dashboard`

JWT only.

### `GET /api/dashboard/summary`

**Response `data`:** `{ "totalSites", "totalArea", "totalProposals", "pipelineValue", "averageROI", "revenueTrend": [{ "month", "value" }] }`

### `GET /api/dashboard/work-in-progress`

**Response `data`:** array of evaluations with `farmId`, `siteId`, `farmName`, `siteName`, `area`, `status`, `completionPercentage`, `proposalId`, `boundaryPointCount`, timestamps.

```bash
curl -s BASE/api/dashboard/summary -H "Authorization: Bearer <TOKEN>"
```

---

## Insights — `/api/insights`

JWT only.

### `GET /api/insights/pipeline`

**Response `data`:** `{ "byMonth": [{ "month", "approved", "drafted", "submitted" }], "totalPipelineValue", "proposalCount" }`  
(Last ~6 months of evaluations.)

### `GET /api/insights/site-ranking`

**Response `data`:** `[{ "siteId", "siteName", "area", "score", "roiMonths", "infrastructureType" }]`

### `GET /api/insights/roi-distribution`

**Response `data`:** `[{ "month": 1|3|6|12, "polyhouse", "shade_net", "open_field" }]` (projected series).

---

## Finance — `/api/finance`

JWT + **`finance` read**.

### `GET /api/finance/summary`

**Query:** `siteId?` (scopes proposals/evals for the current user).

**Response `data` (typical):** investment totals, average ROI, active proposal counts (draft + recommended), `thisMonthSubmittedInvestment`, monthly `trends` / `comparison` series.

```bash
curl -s BASE/api/finance/summary -H "Authorization: Bearer <TOKEN>"
```

---

## Cost — `/api/cost`

JWT only.

### `GET /api/cost/:siteId`

`:siteId` may be a **Site** or **SiteEvaluation** ObjectId. Computes investment from area × infra cost/acre × units (+ 25% markup).

**Response `data`:** `{ "siteId", "infrastructureType", "costPerAcre", "investment", "finalInvestment", "annualProfit", "roiMonths" }`

```bash
curl -s BASE/api/cost/<SITE_OR_EVAL_ID> -H "Authorization: Bearer <TOKEN>"
```

---

## Maps — `/api/maps`

JWT only.

### `POST /api/maps/snapshot`

**Body:** `{ "siteId": string, "width"?: number, "height"?: number }`  
Looks up a **site evaluation** owned by the user and builds a polygon snapshot URL.

**Response:** `{ "success": true, "url": string }` (or 400/404).

```bash
curl -s -X POST BASE/api/maps/snapshot -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d "{\"siteId\":\"<EVAL_ID>\",\"width\":800,\"height\":450}"
```

---

## Reports — `/api/reports`

JWT + `reports` read or write as below.

| Method | Path | Permission | Notes |
|--------|------|------------|--------|
| GET | `/api/reports` | read | Report records |
| GET | `/api/reports/files` | read | Files on disk |
| GET | `/api/reports/list` | read | Report types catalog |
| POST | `/api/reports/generate` | write | Body `reportType`, `siteIds`?, `format` `pdf`\|`excel` |
| GET | `/api/reports/site-evaluation/:siteId` | write | Evaluation PDF by **site** id |
| GET | `/api/reports/single-site/:siteId` | write | Alias of above |
| POST | `/api/reports/multi-site` | write | Body `{ "siteIds": string[] }` |
| GET | `/api/reports/export/data-table` | write | CSV of evaluations |
| GET | `/api/reports/export/map-data` | write | JSON map export |
| GET | `/api/reports/download/:fileName` | read | File download |
| DELETE | `/api/reports/:fileName` | write | Delete generated file |
| POST | `/api/reports/farm/:farmId` | write | Farm report |
| POST | `/api/reports/proposal/:proposalId` | write | Proposal report |

**`reportType` values:** `site_evaluation` · `infrastructure_proposal` · `cost_estimate` · `sales_pipeline` · `site_comparison` · `executive_summary`

```bash
curl -s BASE/api/reports/export/data-table -H "Authorization: Bearer <TOKEN>" -o evaluations.csv
curl -s BASE/api/reports/site-evaluation/<SITE_ID> -H "Authorization: Bearer <TOKEN>" -o eval.pdf
```

---

## Settings — `/api/settings`

JWT. Infrastructure GET is any authenticated user; other routes need `settings` read/write.

| Method | Path | Permission |
|--------|--------|------------|
| GET | `/api/settings/infrastructure` | JWT only |
| POST | `/api/settings/infrastructure` | settings write |
| GET | `/api/settings/team` | settings read |
| POST | `/api/settings/team` | settings write |
| PUT | `/api/settings/team/:userId` | settings write |
| DELETE | `/api/settings/team/:userId` | settings write (cannot delete self) |

**POST infrastructure body:** keys `polyhouse`, `shade_net`, `open_field` each `{ "minCost"|"minCostPerAcre", "maxCost"|"maxCostPerAcre", "roiMonths" }`.

**GET infrastructure `data`:** map of those three types → cost/ROI numbers.

**POST team body:** `{ "name", "email", "role"? }`  
Creates a `User`. Initial password is **not** supplied by the client (server-side default in code — rotate after first login).

**PUT team body:** `{ "role"?, "status"?: "active"|"inactive", "permissions"? }`

```bash
curl -s BASE/api/settings/team -H "Authorization: Bearer <TOKEN>"
```

---

## Audit — `/api/audit`

JWT + **admin** or **`settings` read**.

### `GET /api/audit/logs`

**Query:** `module?` (`farms`\|`sites`\|`evaluations`\|`proposals`\|`reports`\|`settings`\|`auth`), `userId?`, `from?`, `to?` (ISO dates), `limit?` (1–500, default 100).

**Response:** `{ "success": true, "data": [ { userId, action, module, entityId, before, after, ipAddress, createdAt } ] }`

```bash
curl -s "BASE/api/audit/logs?limit=50" -H "Authorization: Bearer <TOKEN>"
```

---

## Invites — `/api/invite`

### `POST /api/invite`

**Auth:** JWT + **role `admin`**.

**Body:** `{ "email": string, "role"?: string, "permissions"? }`

**Response `201`:** `{ "success": true, "data": { "email", "role", "expiresAt" } }`  
Invite token is emailed (or logged if SMTP is unset). Token is **not** returned in JSON.

### `POST /api/invite/accept`

**Auth:** none.

**Body:** `{ "token": string, "name": string, "password": string }` (password min 6 chars)

Creates a `User` from the invite and consumes the token.

```bash
curl -s -X POST BASE/api/invite/accept -H "Content-Type: application/json" -d "{\"token\":\"<invite-token>\",\"name\":\"New User\",\"password\":\"********\"}"
```

---

## User requests — `/api/user-requests`

JWT + **role `admin`**.

| Method | Path |
|--------|------|
| GET | `/api/user-requests` |
| POST | `/api/user-requests/:id/approve` |
| POST | `/api/user-requests/:id/reject` |

**GET `data`:** pending rows `{ _id, name, email, requestedRole, status, createdAt }`.

**Approve body:** `{ "role"?, "permissions"? }` — creates a `User` from the request password hash.

**Reject:** no body required.

```bash
curl -s BASE/api/user-requests -H "Authorization: Bearer <TOKEN>"
curl -s -X POST BASE/api/user-requests/<REQUEST_ID>/approve -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d "{\"role\":\"editor\"}"
```

---

## Index (all paths)

| Method | Path | Auth |
|--------|------|------|
| GET | `/` | public |
| GET | `/health` | public |
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| GET | `/api/auth/me` | JWT |
| GET, POST | `/api/farms` | farms r/w |
| GET | `/api/farms/:farmId/sites` | farms read |
| GET, PUT, PATCH | `/api/farms/:farmId` | farms r/w |
| DELETE | `/api/farms/:farmId` | admin |
| POST | `/api/sites` | sites write |
| GET, PATCH, DELETE | `/api/sites/:siteId` | sites r/w |
| GET, POST | `/api/site-evaluations` | evaluations r/w |
| GET, PATCH, DELETE | `/api/site-evaluations/:id` | evaluations r/w |
| PATCH | `/api/site-evaluations/:id/status` | evaluations write |
| GET, POST | `/api/proposals` | proposals r/w |
| POST | `/api/proposals/recommend` | proposals write |
| POST | `/api/proposals/save` | proposals write |
| GET | `/api/proposals/site/:siteId` | proposals read |
| GET | `/api/proposals/farm/:farmId` | proposals read |
| GET, PATCH | `/api/proposals/:id` | proposals r/w |
| GET | `/api/proposals/:id/pdf` | proposals read |
| GET, POST | `/api/notifications` | JWT |
| GET | `/api/notifications/unread-count` | JWT |
| PUT, POST | `/api/notifications/read-all` | JWT |
| PUT, PATCH | `/api/notifications/:id/read` | JWT |
| DELETE | `/api/notifications/:id` | JWT |
| GET | `/api/dashboard/summary` | JWT |
| GET | `/api/dashboard/work-in-progress` | JWT |
| GET | `/api/insights/pipeline` | JWT |
| GET | `/api/insights/site-ranking` | JWT |
| GET | `/api/insights/roi-distribution` | JWT |
| GET | `/api/finance/summary` | finance read |
| GET | `/api/cost/:siteId` | JWT |
| POST | `/api/maps/snapshot` | JWT |
| GET | `/api/reports` | reports read |
| GET | `/api/reports/files` | reports read |
| GET | `/api/reports/list` | reports read |
| POST | `/api/reports/generate` | reports write |
| GET | `/api/reports/site-evaluation/:siteId` | reports write |
| GET | `/api/reports/single-site/:siteId` | reports write |
| POST | `/api/reports/multi-site` | reports write |
| GET | `/api/reports/export/data-table` | reports write |
| GET | `/api/reports/export/map-data` | reports write |
| GET | `/api/reports/download/:fileName` | reports read |
| DELETE | `/api/reports/:fileName` | reports write |
| POST | `/api/reports/farm/:farmId` | reports write |
| POST | `/api/reports/proposal/:proposalId` | reports write |
| GET | `/api/settings/infrastructure` | JWT |
| POST | `/api/settings/infrastructure` | settings write |
| GET | `/api/settings/team` | settings read |
| POST | `/api/settings/team` | settings write |
| PUT | `/api/settings/team/:userId` | settings write |
| DELETE | `/api/settings/team/:userId` | settings write |
| GET | `/api/audit/logs` | admin or settings read |
| POST | `/api/invite` | admin |
| POST | `/api/invite/accept` | public |
| GET | `/api/user-requests` | admin |
| POST | `/api/user-requests/:id/approve` | admin |
| POST | `/api/user-requests/:id/reject` | admin |

Source of truth: `backend/src/server.ts` + `backend/src/routes/`.
