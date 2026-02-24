import mongoose, { Document, Schema } from "mongoose"

export interface IPolygonPoint {
  lat: number
  lng: number
  id: string
}

export interface ISiteEvaluation extends Document {
  name: string
  userId: mongoose.Types.ObjectId
  farmId?: mongoose.Types.ObjectId
  boundary: IPolygonPoint[]
  area: number // acres or sq meters - store in consistent unit
  areaUnit: "acres" | "sqmeters"
  slope?: number // percentage or degree
  infrastructureRecommendation?: string // e.g. "Polyhouse", "Shade Net", "Open Field"
  costEstimate?: number
  costCurrency?: string
  status: "draft" | "submitted"
  createdAt: Date
  updatedAt: Date
}

const polygonPointSchema = new Schema<IPolygonPoint>(
  { lat: Number, lng: Number, id: String },
  { _id: false }
)

const siteEvaluationSchema = new Schema<ISiteEvaluation>(
  {
    name: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    farmId: { type: Schema.Types.ObjectId, ref: "Farm" },
    boundary: { type: [polygonPointSchema], default: [] },
    area: { type: Number, required: true, min: 0 },
    areaUnit: { type: String, enum: ["acres", "sqmeters"], default: "acres" },
    slope: { type: Number, min: 0 },
    infrastructureRecommendation: { type: String, trim: true },
    costEstimate: { type: Number, min: 0 },
    costCurrency: { type: String, default: "INR" },
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
  },
  { timestamps: true }
)

export const SiteEvaluation = mongoose.model<ISiteEvaluation>("SiteEvaluation", siteEvaluationSchema)
