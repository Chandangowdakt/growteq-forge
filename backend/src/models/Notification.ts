import mongoose, { Document, Schema } from "mongoose"

export type NotificationType = "info" | "success" | "warning" | "error"

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId
  title: string
  message: string
  type: NotificationType
  relatedEntityType?: string
  relatedEntityId?: mongoose.Types.ObjectId
  isRead: boolean
  readAt?: Date
  // Legacy fields for backward compatibility
  user?: { name: string; avatar?: string }
  action?: string
  content?: string
  newNotification?: boolean
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "", trim: true },
    message: { type: String, default: "", trim: true },
    type: { type: String, enum: ["info", "success", "warning", "error"], default: "info" },
    relatedEntityType: { type: String, trim: true },
    relatedEntityId: { type: Schema.Types.ObjectId },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    user: { name: { type: String, default: "System" }, avatar: { type: String } },
    action: { type: String, trim: true },
    content: { type: String, default: "" },
    newNotification: { type: Boolean, default: true },
  },
  { timestamps: true }
)

notificationSchema.set("toJSON", {
  transform(_doc, ret: Record<string, unknown>) {
    ret.isNew = ret.newNotification
    delete ret.newNotification
    return ret
  },
})

export const Notification = mongoose.model<INotification>("Notification", notificationSchema)
