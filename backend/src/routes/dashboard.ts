import { Router, type IRouter } from "express"
import { getSummary } from "../controllers/dashboardController"
import { authMiddleware } from "../middleware/auth"

const router: IRouter = Router()

router.use(authMiddleware)
router.get("/summary", getSummary)

export default router
