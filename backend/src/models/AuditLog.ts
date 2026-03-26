import mongoose, { Document, Schema } from "mongoose"

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "PERMISSION_CHANGE"
  | "INVITE_SENT"
  | "INVITE_ACCEPTED"
  | "USER_REQUEST_CREATED"
  | "USER_APPROVED"
  | "USER_REJECTED"

export type AuditModule =
  | "farms"
  | "sites"
  | "evaluations"
  | "proposals"
  | "reports"
  | "settings"
  | "auth"

export interface IAuditLog extends Document {
  /** Absent for self-service events before a user exists (e.g. registration request). */
  userId?: mongoose.Types.ObjectId
  organizationId?: mongoose.Types.ObjectId
  action: AuditAction
  module: AuditModule
  entityId?: mongoose.Types.ObjectId
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  ipAddress?: string
  createdAt: Date
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true },
    organizationId: { type: Schema.Types.ObjectId, required: false, index: true },
    action: {
      type: String,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "PERMISSION_CHANGE",
        "INVITE_SENT",
        "INVITE_ACCEPTED",
        "USER_REQUEST_CREATED",
        "USER_APPROVED",
        "USER_REJECTED",
      ],
      required: true,
      index: true,
    },
    module: {
      type: String,
      enum: ["farms", "sites", "evaluations", "proposals", "reports", "settings", "auth"],
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: false, index: true },
    before: { type: Schema.Types.Mixed, required: false },
    after: { type: Schema.Types.Mixed, required: false },
    ipAddress: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ module: 1, createdAt: -1 })

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema)
