import mongoose, { Document, Schema } from "mongoose"

export interface ISite extends Document {
  name: string
  geojson: Record<string, unknown>
  area: number
  perimeter: number
  slope?: number
  notes?: string
  farmId?: mongoose.Types.ObjectId
  /** User who created the site (optional for legacy documents). */
  createdBy?: mongoose.Types.ObjectId
  status?: "draft" | "submitted" | "approved" | "rejected"
  createdAt: Date
  updatedAt: Date
}

const siteSchema = new Schema<ISite>(
  {
    name: { type: String, required: true, trim: true },
    geojson: { type: Schema.Types.Mixed, required: true },
    area: { type: Number, required: true },
    perimeter: { type: Number, required: true },
    slope: { type: Number, min: 0 },
    notes: { type: String, trim: true },
    farmId: { type: Schema.Types.ObjectId, ref: "Farm" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      default: "draft",
    },
  },
  { timestamps: true }
)

export const Site = mongoose.model<ISite>("Site", siteSchema)
