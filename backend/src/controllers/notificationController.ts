import { Response } from "express"
import mongoose from "mongoose"
import { Notification } from "../models/Notification"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"
import type { NotificationType } from "../models/Notification"

export interface CreateNotificationParams {
  userId: string
  title: string
  message: string
  type?: NotificationType
  relatedEntityType?: string
  relatedEntityId?: mongoose.Types.ObjectId
}

export async function createNotification(params: CreateNotificationParams) {
  const notification = await Notification.create({
    userId: new mongoose.Types.ObjectId(params.userId),
    title: params.title,
    message: params.message,
    type: params.type ?? "info",
    relatedEntityType: params.relatedEntityType,
    relatedEntityId: params.relatedEntityId,
    isRead: false,
    action: params.title,
    content: params.message,
    user: { name: "System" },
    newNotification: true,
  })
  return notification
}

export const listNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const notifications = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(50)
  res.json({ success: true, data: notifications })
})

export const createNotificationRoute = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const { userId: targetUserId, title, message, type, action, content, user } = req.body
  const forUserId = targetUserId ?? userId
  const notification = await Notification.create({
    userId: forUserId,
    title: title ?? "",
    message: message ?? content ?? "",
    type: type ?? "info",
    action: action ?? title ?? "Update",
    content: content ?? message ?? "",
    user: user ?? { name: "System" },
    newNotification: true,
  })
  res.status(201).json({ success: true, data: notification })
})

export const markAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId },
    { isRead: true, newNotification: false, readAt: new Date() },
    { new: true }
  )
  if (!notification) throw new ApiError(404, "Notification not found")
  res.json({ success: true, data: notification })
})

export const markAllAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  await Notification.updateMany(
    { userId },
    { isRead: true, newNotification: false, readAt: new Date() }
  )
  res.json({ success: true, message: "All notifications marked as read" })
})

export const getUnreadCount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const count = await Notification.countDocuments({ userId, isRead: false })
  res.json({ success: true, data: { count } })
})

export const deleteNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId })
  if (!notification) throw new ApiError(404, "Notification not found")
  res.json({ success: true, message: "Notification deleted" })
})
