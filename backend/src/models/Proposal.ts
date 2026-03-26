import mongoose, { Document, Schema } from "mongoose"

export interface IProposal extends Document {
  title?: string
  siteId?: mongoose.Types.ObjectId
  siteEvaluationId?: mongoose.Types.ObjectId
  /** Owner (optional for legacy documents). */
  userId?: mongoose.Types.ObjectId
  content: Record<string, unknown>
  status: "draft" | "sent" | "recommended" | "rejected"
  investmentValue?: number
  roiMonths?: number
  infrastructureType?: string
  createdAt: Date
  updatedAt: Date
}

const proposalSchema = new Schema<IProposal>(
  {
    title: { type: String, trim: true },
    siteId: { type: Schema.Types.ObjectId, ref: "Site" },
    siteEvaluationId: { type: Schema.Types.ObjectId, ref: "SiteEvaluation" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    content: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["draft", "sent", "recommended", "rejected"], default: "draft" },
    investmentValue: { type: Number, min: 0 },
    roiMonths: { type: Number, min: 0 },
    infrastructureType: { type: String, trim: true },
  },
  { timestamps: true }
)

export const Proposal = mongoose.model<IProposal>("Proposal", proposalSchema)
