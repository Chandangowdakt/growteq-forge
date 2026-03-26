import mongoose, { Document, Schema } from "mongoose"

export type SunExposure = "full" | "partial" | "shade"
export type SiteEvaluationStatus = "draft" | "submitted" | "approved" | "rejected"

export type InfrastructureSnapshotKind = "polyhouse" | "shade_net" | "open_field"

/** Frozen infra pricing/ROI at evaluation creation (optional for legacy documents). */
export interface IInfrastructureSnapshot {
  type: InfrastructureSnapshotKind
  minCost: number
  maxCost: number
  roiMonths: number
  configVersion?: number
}

export interface ISiteEvaluation extends Document {
  siteId: mongoose.Types.ObjectId
  farmId: mongoose.Types.ObjectId
  /** Creator (optional for legacy documents). */
  userId?: mongoose.Types.ObjectId
  soilType: string
  waterAvailability: string
  slopePercentage: number
  elevationMeters?: number
  sunExposure: SunExposure
  status: SiteEvaluationStatus
  notes?: string
  /** Optional; may be set from populated site or legacy data */
  name?: string
  area?: number
  slope?: number
  areaUnit?: string
  infrastructureRecommendation?: string
  numberOfUnits?: number
  cropType?: string
  calculatedInvestment?: number
  infrastructureSnapshot?: IInfrastructureSnapshot
  createdAt: Date
  updatedAt: Date
}

const siteEvaluationSchema = new Schema<ISiteEvaluation>(
  {
    siteId: { type: Schema.Types.ObjectId, ref: "Site", required: true },
    farmId: { type: Schema.Types.ObjectId, ref: "Farm", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    soilType: { type: String, required: true, trim: true },
    waterAvailability: { type: String, required: true, trim: true },
    slopePercentage: { type: Number, required: true, min: 0 },
    elevationMeters: { type: Number, min: 0 },
    sunExposure: { type: String, enum: ["full", "partial", "shade"], default: "full" },
    status: { type: String, enum: ["draft", "submitted", "approved", "rejected"], default: "draft" },
    notes: { type: String, trim: true },
    name: { type: String, trim: true },
    area: { type: Number, min: 0 },
    slope: { type: Number, min: 0 },
    areaUnit: { type: String, trim: true },
    infrastructureRecommendation: { type: String, trim: true },
    numberOfUnits: { type: Number, default: 1 },
    cropType: { type: String, trim: true },
    calculatedInvestment: { type: Number },
    infrastructureSnapshot: new Schema(
      {
        type: {
          type: String,
          enum: ["polyhouse", "shade_net", "open_field"],
          required: true,
        },
        minCost: { type: Number, required: true, min: 0 },
        maxCost: { type: Number, required: true, min: 0 },
        roiMonths: { type: Number, required: true, min: 0 },
        configVersion: { type: Number, min: 1, required: false },
      },
      { _id: false }
    ),
  },
  { timestamps: true }
)

export const SiteEvaluation = mongoose.model<ISiteEvaluation>("SiteEvaluation", siteEvaluationSchema)
