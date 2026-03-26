import { Router, type IRouter } from "express"
import {
  listPendingUserRequests,
  approveUserRequest,
  rejectUserRequest,
} from "../controllers/userRequestsController"
import { authMiddleware } from "../middleware/auth"
import { authorizeRoles } from "../middleware/roleMiddleware"

const router: IRouter = Router()

router.use(authMiddleware)
router.use(authorizeRoles("admin"))

router.get("/", listPendingUserRequests)
router.post("/:id/approve", approveUserRequest)
router.post("/:id/reject", rejectUserRequest)

export default router
