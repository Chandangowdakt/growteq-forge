"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./config/db");
const errorHandler_1 = require("./middleware/errorHandler");
const requestLogger_1 = require("./middleware/requestLogger");
const auth_1 = __importDefault(require("./routes/auth"));
const farms_1 = __importDefault(require("./routes/farms"));
const siteEvaluations_1 = __importDefault(require("./routes/siteEvaluations"));
const proposals_1 = __importDefault(require("./routes/proposals"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const dashboard_1 = __importDefault(require("./routes/dashboard"));
const sites_1 = __importDefault(require("./routes/sites"));
const maps_1 = __importDefault(require("./routes/maps"));
const reports_1 = __importDefault(require("./routes/reports"));
const cost_1 = __importDefault(require("./routes/cost"));
const finance_1 = __importDefault(require("./routes/finance"));
const insights_1 = __importDefault(require("./routes/insights"));
const settings_1 = __importDefault(require("./routes/settings"));
if (!process.env.JWT_SECRET) {
    console.error("[Startup Error] JWT_SECRET is not defined.");
    process.exit(1);
}
if (!process.env.MONGODB_URI) {
    console.error("[Startup Error] MONGODB_URI is not defined.");
    process.exit(1);
}
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 5000);
const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || "http://localhost:3000";
app.use((0, cors_1.default)({
    origin: [frontendUrl, "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json());
app.use(requestLogger_1.requestLogger);
app.get("/", (_req, res) => {
    res.json({ ok: true, api: "Forge API" });
});
app.get("/health", (_req, res) => {
    res.json({
        ok: true,
        service: "forge-backend",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
    });
});
app.use("/api/auth", auth_1.default);
app.use("/api/farms", farms_1.default);
app.use("/api/site-evaluations", siteEvaluations_1.default);
app.use("/api/sites", sites_1.default);
app.use("/api/proposals", proposals_1.default);
app.use("/api/notifications", notifications_1.default);
app.use("/api/dashboard", dashboard_1.default);
app.use("/api/maps", maps_1.default);
app.use("/api/reports", reports_1.default);
app.use("/api/cost", cost_1.default);
app.use("/api/finance", finance_1.default);
app.use("/api/insights", insights_1.default);
app.use("/api/settings", settings_1.default);
app.use(errorHandler_1.errorHandler);
function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`[Server] Forge API running on http://localhost:${port}`);
    });
    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(`[Server] Port ${port} is in use. Try another port (e.g. PORT=${port + 1} pnpm run dev).`);
            process.exit(1);
        }
        throw err;
    });
}
async function start() {
    await (0, db_1.connectDb)();
    startServer(PORT);
}
start().catch((err) => {
    console.error("[Server] Failed to start:", err);
    process.exit(1);
});
