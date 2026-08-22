# Knowledge transfer — Growteq Forge

Hand-off notes for the next developer. **Do not put secrets, tokens, or passwords in this file.** Copy env **names** from `.env.example` / `backend/.env.example` and set values only in local or host env files.

Related docs: `README.md` (setup), `ARCHITECTURE.md` (system design).

---

## 1. Known issues and how they were addressed

### Login returned 500 on invalid JSON

**Symptom:** `POST /api/auth/login` with a non-JSON body (common with PowerShell `curl`, which is `Invoke-WebRequest`) returned **500 Internal server error**.

**Cause:** `express.json()` throws a parse error; the global error handler treated it as an unhandled 500.

**Fix:** `backend/src/middleware/errorHandler.ts` maps body-parser `entity.parse.failed` / JSON `SyntaxError` to **400** with `Invalid JSON body`.

**When testing APIs on Windows:** use `curl.exe` and a JSON file (`--data-binary "@body.json"`), not PowerShell `curl`.

### Login returned 403 “account is not approved yet”

**Symptom:** Correct JSON login still failed. Health was fine; Mongo was up.

**Cause:** Auth only issues a JWT for a **`User`** document. Public register creates a **`UserRequest`** (`pending`). If the admin **`User`** was deleted, the same email can still exist as a pending request. Login then looks like “wrong password” or “not approved,” depending on the path.

**Fix:** Recovery script `backend/src/scripts/ensureAdminUser.ts` (see §2). It creates or updates a `User` with role `admin` and marks a matching `UserRequest` approved. It does **not** delete farms/sites.

### Weak or missing JWT secret

**Symptom:** Server refused to start without `JWT_SECRET`. A short, guessable secret is unsafe in production.

**Fix:** `server.ts` **exits** if `JWT_SECRET` or `MONGODB_URI` is missing. `backend/src/config/env.ts` does not use a real fallback secret in production. After you **change** `JWT_SECRET`, existing tokens are invalid — everyone must sign in again. Set the same value on the host (e.g. Render) as locally if you share one database.

### CORS / 401 on the hosted frontend

**Symptom:** Browser console CORS errors, or cookies/credentials blocked; UI cannot call the API.

**Cause:** CORS origin must **exactly** match the frontend origin (scheme + host, **no trailing slash**). Only `FRONTEND_URL` was easy to miss vs `FRONTEND_ORIGIN`.

**Fix:** `server.ts` allows the unique set of `FRONTEND_URL`, `FRONTEND_ORIGIN`, and `http://localhost:3000`, plus `app.options("*", cors(...))`.

### Mapbox token leaked in logs

**Symptom:** Startup logs printed a token prefix in non-production.

**Fix:** Production only logs that Mapbox is configured, not a prefix. Never commit tokens. Frontend map tiles use `NEXT_PUBLIC_MAPBOX_TOKEN`; PDF snapshots use backend `MAPBOX_TOKEN`. They are **different names**.

### Reports “data table” URL in older checklists

**Symptom:** `GET /api/reports/quick/data-table` 404s.

**Actual route:** `GET /api/reports/export/data-table` (see `backend/src/routes/reports.ts`).

### Mongo connection failures were opaque

**Fix:** `connectDb()` in `backend/src/config/db.ts` logs `MongoDB connection failed:` and rethrows so the process manager can restart.

### Prisma leftover

**Issue:** `backend/src/generated/prisma/` looks like a Prisma app.

**Reality:** Unused. Runtime is Mongoose. Do not add Prisma migrations or `DATABASE_URL` unless you intentionally adopt Prisma.

---

## 2. Admin account recovery (CLI)

Registration is **request-based**. If there is **no `User` with admin role**, nobody can approve requests and you cannot sign in as admin.

**Script:** `backend/src/scripts/ensureAdminUser.ts`  
**npm script:** from `backend/`, `pnpm run ensure-admin` (password still required via CLI arg or env **names** `ENSURE_ADMIN_PASSWORD` / `ADMIN_PASSWORD`).

Behavior:

| Situation | What to run |
|----------|-------------|
| Admin `User` missing | Run the script **without** `--reset` (pass the new password as a CLI argument or via env). Creates `User` with role `admin`. |
| User exists, password unknown | Run the **same** script with **`--reset`**. Updates password, sets `role` to `admin`, `isActive` true. |
| Matching `UserRequest` still pending | Script sets that request to **approved**. |

Always run from **`backend/`** so `dotenv` loads `backend/.env` (`MONGODB_URI`). For production, use the **same Mongo URI as the API** (e.g. Render **Shell** on the backend service).

Default email is overridable with `ENSURE_ADMIN_EMAIL` (and name with `ENSURE_ADMIN_NAME`). Do **not** put passwords in git, tickets, or this file.

**Do not use `pnpm run seed` to recover login.** `backend/src/seed.ts` **deletes** farms, sites, evaluations, proposals, and notifications for that admin. Recovery ≠ seed.

---

## 3. Fragile areas

Treat these as high-risk for regressions:

| Area | Why it breaks easily |
|------|----------------------|
| `lib/api.ts` interceptors | Token key is `forge_token`. 401 handler clears storage and redirects to `/login` (except the login POST). Do not “fix” this without checking every page that still uses raw `fetch` + the same key. |
| Mixed HTTP clients | Farms, reports, site evaluation PDF still use `fetch` + `NEXT_PUBLIC_API_URL` instead of the Axios instance. Easy to drop `Authorization` or hit the wrong base URL. |
| Proposal PDF on evaluation detail | `app/dashboard/site-evaluations/[id]/page.tsx` calls `/api/proposals/${id}/pdf` where `id` is the **evaluation** id. That can 404 if the API expects a **proposal** id. |
| Leaflet (`LeafletMap.tsx`) | Map container must be destroyed on unmount or you get “already initialized.” Search uses Nominatim with `featuretype=settlement` (can weaken road/address queries). Browsers cannot set Nominatim `User-Agent`. |
| RBAC duplicated | Defaults live in `backend/src/utils/permissionUtils.ts` **and** `lib/permissions.ts`. Change both or the UI and API will disagree. |
| Own-record scoping | `needsOwnUserScope` filters lists when the user has no **write** on that module. Admins are unscoped. Easy to leak or hide data if you skip the helper. |
| JWT in `localStorage` | XSS can steal the token. There is no httpOnly cookie session. |
| `seed.ts` | Destructive; also embeds a demo credential in source. Never run against production data. |
| Sharp / PDF logo | API tries to rasterize a logo on startup. Missing files are logged, not fatal; native `sharp` can fail on some hosts without extra flags. |
| `NEXT_PUBLIC_*` | Inlined at **Next.js build time**. Changing Render env without a **rebuild** leaves the old API URL in the client bundle. |
| Dual packages | Root `package.json` (Next) and `backend/package.json` (Express). You must `pnpm install` in **both**. Root `pnpm dev:full` does not install backend deps for you. |

---

## 4. Environment variable gotchas

Names only. Values live in `.env.local` (frontend) and `backend/.env` (API). Both are gitignored.

**Frontend (repo root `.env.local`):**

- `NEXT_PUBLIC_API_URL` — Express origin, no trailing slash. Fallback in code is `http://localhost:5000`.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — optional; used in `app/layout.tsx` if set.
- `NEXT_PUBLIC_MAPBOX_TOKEN` — optional; farms Leaflet satellite tiles. **Not** listed in `.env.example` today, but the map reads it.

**Backend (`backend/.env`):**

- **Required to start:** `MONGODB_URI`, `JWT_SECRET` (use a long random string in any shared/prod DB).
- `JWT_EXPIRES_IN` — e.g. `7d`.
- `PORT` — local default 5000; many hosts (Render) inject `PORT`.
- `NODE_ENV` — `production` on the host.
- `FRONTEND_URL` — CORS + invite links. Must match the real UI origin (no trailing slash).
- `FRONTEND_ORIGIN` — extra CORS origin; used in `server.ts` but **not** in `backend/.env.example`. Set it on the host if the UI URL differs from `FRONTEND_URL`.
- `MAPBOX_TOKEN` — backend PDF/map snapshots (not the `NEXT_PUBLIC_` name).
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. If `SMTP_HOST` is omitted, invite links are logged to the console.

**Host / local pitfalls:**

1. **Two files, two processes.** Frontend env is not visible to Express. Backend `.env` is not visible to Next unless you copy names (you shouldn’t copy secrets into `NEXT_PUBLIC_*` except the API URL).
2. **CORS mismatch** is the usual “works locally, fails on Render” bug: `https://….onrender.com` vs `http://localhost:3000`.
3. **Atlas** must allow the host IP (or `0.0.0.0/0` on a throwaway cluster). Connection errors look like login 500s if you don’t read API logs.
4. **Rotating `JWT_SECRET`** logs everyone out.
5. **dotenv cwd:** run API scripts from `backend/` or `MONGODB_URI` will be undefined.
6. **Production JWT:** `env.ts` uses an empty fallback when `NODE_ENV === "production"` and `JWT_SECRET` is unset; `server.ts` should have already exited. Don’t rely on the fallback.
7. Native modules (`sharp`): if the Linux build fails, hosts sometimes need ignore-global-libvips-style flags; check the API build log, don’t copy secrets into git.

---

## 5. Next steps for a new developer

1. **Read** `README.md` then `ARCHITECTURE.md`. Install **pnpm**, Node 20+, MongoDB (or Atlas).
2. **Install twice:** `pnpm install` at repo root **and** `cd backend && pnpm install`.
3. **Env:** copy `.env.example` → `.env.local` and `backend/.env.example` → `backend/.env`. Fill required **names** yourself; never commit the filled files.
4. **Run:** `pnpm run dev` in `backend/` and `pnpm dev` at root (or `pnpm dev:full` after both installs). Confirm `GET http://localhost:5000/health`.
5. **First admin:** if you cannot log in, use **ensure-admin** (§2), not seed.
6. **Sign in** at `/login`. New self-serve users stay pending until an admin approves them in Settings.
7. **Don’t “clean up”** `lib/api.ts` auth interceptors or rename `forge_token` without a repo-wide search.
8. **Follow-up work (suggested):**
   - Route remaining `fetch` pages through `lib/api.ts`.
   - Fix evaluation-detail proposal PDF to use a real proposal id (or a dedicated evaluation PDF route — `GET /api/reports/site-evaluation/:siteId` already exists).
   - Add `FRONTEND_ORIGIN` and `NEXT_PUBLIC_MAPBOX_TOKEN` to the example env files.
   - Delete or isolate unused `backend/src/generated/prisma/`.
   - Add tests around login (pending request vs `User`) and `errorHandler` JSON parse.
   - Keep frontend/backend permission defaults in lockstep when you add a module.
9. **Production:** after deploy, smoke-test login, farms map, one PDF, reports CSV (`/api/reports/export/data-table`), and the browser console (CORS / 401). Confirm host env names match this list.

---

## 6. What not to do

- Do not commit `.env`, `.env.local`, or `backend/.env`.
- Do not paste connection strings, JWT material, or Mapbox keys into PRs or this document.
- Do not run `seed` on a database you care about.
- Do not assume Prisma, Next.js Route Handlers, or cookie sessions are how this app works — they are not.
