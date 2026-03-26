import mongoose, { Document, Schema } from "mongoose"
import bcrypt from "bcryptjs"

export type UserRequestStatus = "pending" | "approved" | "rejected"

export interface IUserRequest extends Document {
  name: string
  email: string
  password: string
  status: UserRequestStatus
  requestedRole?: string
  createdAt: Date
  comparePassword(candidate: string): Promise<boolean>
}

const userRequestSchema = new Schema<IUserRequest>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    requestedRole: { type: String, trim: true, required: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

userRequestSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()
  const self = this as IUserRequest
  if (/^\$2[aby]?\$\d{2}\$/.test(self.password)) return next()
  self.password = await bcrypt.hash(self.password, 12)
  next()
})

userRequestSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password)
}

export const UserRequest = mongoose.model<IUserRequest>("UserRequest", userRequestSchema)
