import mongoose, { Document, Schema } from "mongoose"
import bcrypt from "bcryptjs"

export type Role = "admin" | "field_evaluator" | "sales_associate"

export interface IUser extends Document {
  email: string
  password: string
  name: string
  role?: Role
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
      enum: ["admin", "field_evaluator", "sales_associate"],
      default: "sales_associate",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()
  const self = this as IUser
  self.password = await bcrypt.hash(self.password, 12)
  next()
})

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password)
}

export const User = mongoose.model<IUser>("User", userSchema)
