"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNotification = exports.getUnreadCount = exports.markAllAsRead = exports.markAsRead = exports.createNotificationRoute = exports.listNotifications = void 0;
exports.createNotification = createNotification;
const mongoose_1 = __importDefault(require("mongoose"));
const Notification_1 = require("../models/Notification");
const ApiError_1 = require("../utils/ApiError");
const asyncHandler_1 = require("../utils/asyncHandler");
async function createNotification(params) {
    const notification = await Notification_1.Notification.create({
        userId: new mongoose_1.default.Types.ObjectId(params.userId),
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
    });
    return notification;
}
exports.listNotifications = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const notifications = await Notification_1.Notification.find({ userId }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: notifications });
});
exports.createNotificationRoute = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const { userId: targetUserId, title, message, type, action, content, user } = req.body;
    const forUserId = targetUserId ?? userId;
    const notification = await Notification_1.Notification.create({
        userId: forUserId,
        title: title ?? "",
        message: message ?? content ?? "",
        type: type ?? "info",
        action: action ?? title ?? "Update",
        content: content ?? message ?? "",
        user: user ?? { name: "System" },
        newNotification: true,
    });
    res.status(201).json({ success: true, data: notification });
});
exports.markAsRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const notification = await Notification_1.Notification.findOneAndUpdate({ _id: req.params.id, userId }, { isRead: true, newNotification: false, readAt: new Date() }, { new: true });
    if (!notification)
        throw new ApiError_1.ApiError(404, "Notification not found");
    res.json({ success: true, data: notification });
});
exports.markAllAsRead = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    await Notification_1.Notification.updateMany({ userId }, { isRead: true, newNotification: false, readAt: new Date() });
    res.json({ success: true, message: "All notifications marked as read" });
});
exports.getUnreadCount = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const count = await Notification_1.Notification.countDocuments({ userId, isRead: false });
    res.json({ success: true, data: { count } });
});
exports.deleteNotification = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const userId = req.auth.userId;
    const notification = await Notification_1.Notification.findOneAndDelete({ _id: req.params.id, userId });
    if (!notification)
        throw new ApiError_1.ApiError(404, "Notification not found");
    res.json({ success: true, message: "Notification deleted" });
});
