import mongoose, { Document, Schema } from "mongoose"
import bcrypt from "bcryptjs"
import type { UserPermissions } from "../utils/permissionUtils"

// Backend canonical roles (RBAC)
export type Role = "admin" | "editor" | "viewer"
// Legacy roles still present in existing DB documents / UI
export type LegacyRole = "field_evaluator" | "sales_associate" | "user"

const moduleAccessSchema = new Schema(
  {
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
  },
  { _id: false }
)

export interface IUser extends Document {
  email: string
  password: string
  name: string
  role?: Role | LegacyRole
  /** Per-module access; merged at runtime with role defaults when missing. */
  permissions?: Partial<UserPermissions>
  isActive?: boolean
  createdAt: Date
  updatedAt: Date
  comparePassword(candidate: string): Promise<boolean>
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      // Allow legacy role strings so existing users don't break.
      // New writes should use canonical roles: admin|editor|viewer.
      enum: ["admin", "editor", "viewer", "field_evaluator", "sales_associate", "user"],
      default: "viewer",
    },
    permissions: {
      farms: { type: moduleAccessSchema, required: false },
      sites: { type: moduleAccessSchema, required: false },
      evaluations: { type: moduleAccessSchema, required: false },
      proposals: { type: moduleAccessSchema, required: false },
      reports: { type: moduleAccessSchema, required: false },
      finance: { type: moduleAccessSchema, required: false },
      settings: { type: moduleAccessSchema, required: false },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()
  const self = this as IUser
  /** Skip re-hash when copying an existing bcrypt hash (e.g. approved registration request). */
  if (/^\$2[aby]?\$\d{2}\$/.test(self.password)) return next()
  self.password = await bcrypt.hash(self.password, 12)
  next()
})

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password)
}

export const User = mongoose.model<IUser>("User", userSchema)
