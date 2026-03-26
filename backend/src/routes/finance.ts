import { Router, type IRouter } from "express"
import { getSummary } from "../controllers/financeController"
import { authMiddleware } from "../middleware/auth"
import { checkPermission } from "../middleware/permissionMiddleware"

const router: IRouter = Router()

router.use(authMiddleware, checkPermission("finance", "read"))
router.get("/summary", getSummary)

export default router
