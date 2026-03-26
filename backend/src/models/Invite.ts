import mongoose, { Document, Schema } from "mongoose"

export interface IInvite extends Document {
  email: string
  role: string
  permissions?: Record<string, unknown>
  invitedBy: mongoose.Types.ObjectId
  organizationId?: mongoose.Types.ObjectId
  /** Cleared after acceptance so the link cannot be reused. */
  token?: string
  expiresAt: Date
  accepted: boolean
  createdAt: Date
}

const inviteSchema = new Schema<IInvite>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, required: true, trim: true },
    permissions: { type: Schema.Types.Mixed, required: false },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    organizationId: { type: Schema.Types.ObjectId, required: false },
    token: { type: String, unique: true, sparse: true },
    expiresAt: { type: Date, required: true },
    accepted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

inviteSchema.index({ email: 1 })
inviteSchema.index({ email: 1, token: 1 })

export const Invite = mongoose.model<IInvite>("Invite", inviteSchema)
