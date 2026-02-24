import mongoose, { Document, Schema } from "mongoose"

export interface IFarm extends Document {
  name: string
  description?: string
  location?: string
  userId: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const farmSchema = new Schema<IFarm>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    location: { type: String, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

export const Farm = mongoose.model<IFarm>("Farm", farmSchema)
