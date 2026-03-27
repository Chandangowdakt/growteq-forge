import express from "express"
import cors from "cors"
import fs from "fs"
import path from "path"
import sharp from "sharp"
import { connectDb } from "./config/db"
import { errorHandler } from "./middleware/errorHandler"
import { requestLogger } from "./middleware/requestLogger"

import authRoutes from "./routes/auth"
import farmsRoutes from "./routes/farms"
import siteEvaluationsRoutes from "./routes/siteEvaluations"
import proposalsRoutes from "./routes/proposals"
import notificationsRoutes from "./routes/notifications"
import dashboardRoutes from "./routes/dashboard"
import sitesRoutes from "./routes/sites"
import mapsRoutes from "./routes/maps"
import reportsRoutes from "./routes/reports"
import costRoutes from "./routes/cost"
import financeRoutes from "./routes/finance"
import insightsRoutes from "./routes/insights"
import settingsRoutes from "./routes/settings"
import auditRoutes from "./routes/audit"
import inviteRoutes from "./routes/invite"
import userRequestsRoutes from "./routes/userRequests"

if (!process.env.JWT_SECRET) {
  console.error("[Startup Error] JWT_SECRET is not defined.")
  process.exit(1)
}

if (!process.env.MONGODB_URI) {
  console.error("[Startup Error] MONGODB_URI is not defined.")
  process.exit(1)
}

function copyLogoForPDF() {
  // Paths relative to project structure
  const sources = [
    path.join(process.cwd(), "public/images/growteq-logo.svg"),
    path.join(__dirname, "../../../public/images/growteq-logo.svg"),
    path.join(__dirname, "../../public/images/growteq-logo.svg"),
  ]

  const destDir = path.join(process.cwd(), "backend/public/images")
  const destPNG = path.join(destDir, "growteq-logo.png")
  const destSVG = path.join(destDir, "growteq-logo.svg")

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  // If PNG already exists, skip heavy work
  if (fs.existsSync(destPNG)) {
    console.log("✓ PDF logo PNG exists:", destPNG)
    return
  }

  for (const src of sources) {
    if (fs.existsSync(src)) {
      console.log("Found logo SVG at:", src)
      try {
        fs.copyFileSync(src, destSVG)
        console.log("Copied SVG to:", destSVG)
      } catch (e: any) {
        console.error("Copy SVG failed:", e.message)
      }

      try {
        sharp(src)
          .resize(300, 75, {
            fit: "contain",
            background: { r: 45, g: 101, b: 53, alpha: 0 },
          })
          .png()
          .toFile(destPNG)
          .then(() => console.log("✓ Logo PNG created:", destPNG))
          .catch((e: any) => console.error("Sharp failed:", e.message))
      } catch (e: any) {
        console.error("Sharp not available:", e.message)
      }
      return
    }
  }

  console.log("✗ Logo SVG not found in any location")
  console.log("CWD:", process.cwd())
  console.log("__dirname:", __dirname)
}

const app = express()

const PORT = Number(process.env.PORT || 5000)
const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || "http://localhost:3000"

app.use(
  cors({
    origin: [frontendUrl, "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control"],
  })
)
app.use(express.json())
app.use(requestLogger)

app.get("/", (_req, res) => {
  res.json({ ok: true, api: "Forge API" })
})

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "forge-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  })
})

app.use("/api/auth", authRoutes)
app.use("/api/farms", farmsRoutes)
app.use("/api/site-evaluations", siteEvaluationsRoutes)
app.use("/api/sites", sitesRoutes)
app.use("/api/proposals", proposalsRoutes)
app.use("/api/notifications", notificationsRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/maps", mapsRoutes)
app.use("/api/reports", reportsRoutes)
app.use("/api/cost", costRoutes)
app.use("/api/finance", financeRoutes)
app.use("/api/insights", insightsRoutes)
app.use("/api/settings", settingsRoutes)
app.use("/api/audit", auditRoutes)
app.use("/api/invite", inviteRoutes)
app.use("/api/user-requests", userRequestsRoutes)

app.use(errorHandler)

function startServer(port: number): void {
  const server = app.listen(port, () => {
    console.log(`[Server] Forge API running on http://localhost:${port}`)
  })

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[Server] Port ${port} is in use. Try another port (e.g. PORT=${port + 1} pnpm run dev).`)
      process.exit(1)
    }
    throw err
  })
}

async function start() {
  await connectDb()
  copyLogoForPDF()
  startServer(PORT)
  console.log("=== Environment Check ===")
  console.log("NODE_ENV:", process.env.NODE_ENV)
  const mapbox = process.env.MAPBOX_TOKEN?.trim()
  if (!mapbox) {
    console.warn("[Server] MAPBOX_TOKEN is missing or empty — PDF site maps will use a placeholder.")
  } else {
    console.log("[Server] MAPBOX_TOKEN is set (length", mapbox.length + ", preview", mapbox.slice(0, 8) + "…).")
  }
  console.log("FRONTEND_URL:", process.env.FRONTEND_URL)
  console.log("PORT:", process.env.PORT)
}

start().catch((err) => {
  console.error("[Server] Failed to start:", err)
  process.exit(1)
})
