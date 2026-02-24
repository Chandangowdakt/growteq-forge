import express from "express"
import cors from "cors"
import { connectDb } from "./config/db"
import { errorHandler } from "./middleware/errorHandler"
import { requestLogger } from "./middleware/requestLogger"

import authRoutes from "./routes/auth"
import farmsRoutes from "./routes/farms"
import siteEvaluationsRoutes from "./routes/siteEvaluations"
import proposalsRoutes from "./routes/proposals"
import notificationsRoutes from "./routes/notifications"
import dashboardRoutes from "./routes/dashboard"

if (!process.env.JWT_SECRET) {
  console.error("[Startup Error] JWT_SECRET is not defined.")
  process.exit(1)
}

if (!process.env.MONGODB_URI) {
  console.error("[Startup Error] MONGODB_URI is not defined.")
  process.exit(1)
}

const app = express()

const PORT = Number(process.env.PORT || 5000)
const corsOrigin = process.env.FRONTEND_ORIGIN

if (!corsOrigin) {
  console.warn("[Startup Warning] FRONTEND_ORIGIN not set. CORS may block requests.")
}

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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
app.use("/api/proposals", proposalsRoutes)
app.use("/api/notifications", notificationsRoutes)
app.use("/api/dashboard", dashboardRoutes)

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
  startServer(PORT)
}

start().catch((err) => {
  console.error("[Server] Failed to start:", err)
  process.exit(1)
})
