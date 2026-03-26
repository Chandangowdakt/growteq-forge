import mongoose, { Document, Schema } from "mongoose"

export interface IFarm extends Document {
  name: string
  description?: string
  location?: string
  totalArea?: number
  country?: string
  state?: string
  district?: string
  deletedAt?: Date
  /** Owner (optional for legacy documents). */
  userId?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const farmSchema = new Schema<IFarm>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    location: { type: String, trim: true },
    totalArea: { type: Number, min: 0 },
    country: { type: String, trim: true },
    state: { type: String, trim: true },
    district: { type: String, trim: true },
    deletedAt: { type: Date },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
  },
  { timestamps: true }
)

export const Farm = mongoose.model<IFarm>("Farm", farmSchema)
