import { Router, type IRouter } from "express"
import {
  listNotifications,
  createNotificationRoute,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
} from "../controllers/notificationController"
import { authMiddleware } from "../middleware/auth"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", listNotifications)
router.get("/unread-count", getUnreadCount)
router.post("/", createNotificationRoute)
router.put("/read-all", markAllAsRead)
router.post("/read-all", markAllAsRead)
router.put("/:id/read", markAsRead)
router.patch("/:id/read", markAsRead)
router.delete("/:id", deleteNotification)

export default router
