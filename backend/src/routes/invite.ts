import { Router, type IRouter } from "express"
import { createInvite, acceptInvite } from "../controllers/inviteController"
import { authMiddleware } from "../middleware/auth"
import { authorizeRoles } from "../middleware/roleMiddleware"

const router: IRouter = Router()

router.post("/accept", acceptInvite)
router.post("/", authMiddleware, authorizeRoles("admin"), createInvite)

export default router
