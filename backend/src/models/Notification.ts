import mongoose, { Document, Schema } from "mongoose"

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId
  user?: { name: string; avatar?: string }
  action: string
  content: string
  isRead: boolean
  newNotification: boolean // avoid Mongoose reserved key "isNew"
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    user: {
      name: { type: String, default: "System" },
      avatar: { type: String },
    },
    action: { type: String, required: true, trim: true },
    content: { type: String, default: "" },
    isRead: { type: Boolean, default: false },
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
