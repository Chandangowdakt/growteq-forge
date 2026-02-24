import { Router, type IRouter } from "express"
import {
  listNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController"
import { authMiddleware } from "../middleware/auth"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", listNotifications)
router.post("/", createNotification)
router.patch("/:id/read", markAsRead)
router.post("/read-all", markAllAsRead)

export default router
