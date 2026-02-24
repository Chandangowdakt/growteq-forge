import { Response } from "express"
import { Notification } from "../models/Notification"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"

export const listNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50)
  res.json({ success: true, data: notifications })
})

export const createNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const { userId: targetUserId, action, content, user } = req.body
  const forUserId = targetUserId ?? userId
  const notification = await Notification.create({
    userId: forUserId,
    action: action ?? "Update",
    content: content ?? "",
    user: user ?? { name: "System" },
  })
  res.status(201).json({ success: true, data: notification })
})

export const markAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId },
    { isRead: true, newNotification: false },
    { new: true }
  )
  if (!notification) throw new ApiError(404, "Notification not found")
  res.json({ success: true, data: notification })
})

export const markAllAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  await Notification.updateMany({ userId }, { isRead: true, newNotification: false })
  res.json({ success: true, message: "All notifications marked as read" })
})
