import { Router, type IRouter } from "express"
import { getSummary, getWorkInProgress } from "../controllers/dashboardController"
import { authMiddleware } from "../middleware/auth"

const router: IRouter = Router()

router.use(authMiddleware)
router.get("/summary", getSummary)
router.get("/work-in-progress", getWorkInProgress)

export default router
