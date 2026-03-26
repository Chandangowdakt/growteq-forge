import { Router, type IRouter } from "express"
import { authMiddleware } from "../middleware/auth"
import { requireAuditLogAccess } from "../middleware/auditLogAccess"
import { listAuditLogs } from "../controllers/auditController"

const router: IRouter = Router()

router.use(authMiddleware, requireAuditLogAccess)
router.get("/logs", listAuditLogs)

export default router
