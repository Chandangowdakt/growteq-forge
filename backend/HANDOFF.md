=== GROWTEQ FARM MANAGEMENT SYSTEM — DEVELOPER HANDOFF ===

Full-stack GIS farm planning platform. Node/Express/MongoDB backend + 
Next.js 14 frontend. All features complete and working.

=== QUICK START ===

# 1. Backend
cd backend
cp .env.example .env          # fill MONGODB_URI and JWT_SECRET
pnpm install
pnpm tsx src/seed.ts           # load demo data
pnpm run dev                   # http://localhost:5000

# 2. Frontend
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:5000
pnpm install
pnpm dev                       # http://localhost:3000

# 3. Test backend
chmod +x test-api.sh && ./test-api.sh

Demo login: admin@growteq.com / admin123

=== FULL SYSTEM MAP ===

PAGES (all complete and wired to backend):
  /login                    POST /api/auth/login
  /register                 POST /api/auth/register
  /dashboard/overview       GET  /api/dashboard/summary
  /dashboard/dashboard      GET  /api/dashboard/work-in-progress
  /dashboard/farms          GET/POST /api/farms, /api/sites, /api/proposals/recommend
  /dashboard/crops          STATIC — no API
  /dashboard/finance        GET  /api/finance/summary
  /dashboard/reports        GET  /api/reports/list, POST /api/reports/generate
  /dashboard/insights       GET  /api/insights/pipeline|site-ranking|roi-distribution
  /dashboard/settings       GET/POST/PUT/DELETE /api/settings/team|infrastructure

BACKEND ROUTES (all behind authenticateToken middleware):
  /api/auth          login, register, me
  /api/farms         CRUD + /:farmId/sites
  /api/sites         POST (create with geojson/area/slope)
  /api/site-evaluations  POST (creates eval + proposal), GET, PATCH /:id/status
  /api/proposals     GET, POST /recommend
  /api/dashboard     /summary, /work-in-progress
  /api/finance       /summary
  /api/reports       /list, /generate, /proposal/:id, /download/:fileName
  /api/insights      /pipeline, /site-ranking, /roi-distribution
  /api/notifications GET, PUT /read-all, PUT /:id/read, DELETE /:id, GET /unread-count
  /api/settings      /team (CRUD), /infrastructure (GET/POST)
  /api/maps          /snapshot (Mapbox static image)

MONGODB COLLECTIONS (database: forge):
  users             id, name, email, passwordHash, role, isActive
  farms             userId, name, location, totalArea, country, state, district, deletedAt
  sites             farmId, name, geojson, area, perimeter, slope, notes
  siteevaluations   siteId, farmId, userId, soilType, waterAvailability, 
                    slopePercentage, sunExposure, status, notes
  proposals         siteId, userId, infrastructureType, investmentValue, 
                    roiMonths, status
  notifications     userId, title, message, type, isRead, readAt

KEY FILES:
  lib/api.ts                  All API calls + types + 401 interceptor
  lib/utils.ts                formatINR(), formatDate()
  lib/auth-context.tsx        login(), logout(), isAuthenticated, isLoading
  backend/src/seed.ts         Demo data (re-run anytime to reset)
  backend/src/config/infrastructure.json  Cost config used by recommendation engine
  backend/public/reports/     Generated PDFs stored here

=== RECOMMENDATION ENGINE LOGIC ===

File: backend/src/services/recommendationService.ts
Reads: backend/src/config/infrastructure.json (editable in Settings page)
Logic:
  slope <= 5%  → polyhouse,   area × 2,500,000, 18 months ROI
  slope <= 10% → shade_net,   area × 200,000,   6 months ROI
  else         → open_field,  area × 50,000,     3 months ROI

Triggered by:
  POST /api/site-evaluations  (auto-generates proposal)
  POST /api/proposals/recommend (manual trigger from farms map)

=== USER FLOW (end to end) ===

1. Login → /dashboard/overview (see KPIs)
2. /dashboard/farms → select/create farm → draw boundary on satellite map
3. Boundary auto-calculates area + perimeter (Turf.js)
4. Save Site → POST /api/sites
5. Auto-recommend → POST /api/proposals/recommend → toast + panel
6. Panel shows: infrastructure type, investment ₹, ROI months
7. "Generate Report" → POST /api/reports/generate → PDF downloads
8. /dashboard/insights → site ranking, pipeline chart, ROI projection
9. /dashboard/finance → cost trends by infra type, comparison table
10. /dashboard/settings → edit team, adjust cost config per acre

=== EXTENDING THE SYSTEM ===

To add a new page:
  1. Create app/dashboard/newpage/page.tsx with 'use client'
  2. Add API function to lib/api.ts
  3. Add backend route in backend/src/routes/
  4. Mount in backend/src/server.ts: app.use('/api/newpage', newRoute)
  5. Add nav item to app/dashboard/layout.tsx

To add a new MongoDB field:
  1. Update model in backend/src/models/
  2. Update relevant controller to read/write it
  3. Re-run seed: pnpm tsx src/seed.ts
  4. Update TypeScript type in lib/api.ts

To change infrastructure cost defaults:
  Option A: Edit Settings page → Infrastructure tab → Save
  Option B: Edit backend/src/config/infrastructure.json directly

To reset all data:
  cd backend && pnpm tsx src/seed.ts
  (drops and recreates all demo documents)

=== KNOWN LIMITATIONS (future work) ===

1. Elevation API not connected — slope defaults to 2.5% for all sites
   Fix: integrate USGS Open Elevation API in POST /api/sites
   
2. Mapbox snapshot in reports uses placeholder if MAPBOX_TOKEN not set
   Fix: add MAPBOX_TOKEN to backend/.env and update maps controller

3. Excel export generates CSV not real .xlsx
   Fix: add exceljs package and rewrite reports/generate for excel format

4. No email notifications (toggle exists in Settings but sends nothing)
   Fix: add nodemailer/sendgrid, read toggle from user preferences

5. Multi-user: all users see all farms (no org isolation)
   Fix: add organizationId to all models, filter all queries by org

6. No pagination on any list endpoint
   Fix: add ?page=&limit= params to /api/farms, /api/sites, /api/proposals

=== ENVIRONMENT VARIABLES ===

Frontend (.env.local):
  NEXT_PUBLIC_API_URL=http://localhost:5000

Backend (.env):
  PORT=5000
  MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/forge
  JWT_SECRET=your-32-char-secret-here
  JWT_EXPIRES_IN=7d
  NODE_ENV=development
  FRONTEND_URL=http://localhost:3000
  MAPBOX_TOKEN=pk.eyJ1...  (optional, for map snapshots in PDFs)