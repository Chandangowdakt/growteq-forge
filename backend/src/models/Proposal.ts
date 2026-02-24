import mongoose, { Document, Schema } from "mongoose"

export interface IProposal extends Document {
  title: string
  siteEvaluationId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  content: Record<string, unknown> // flexible proposal data (sections, totals, etc.)
  status: "draft" | "sent"
  createdAt: Date
  updatedAt: Date
}

const proposalSchema = new Schema<IProposal>(
  {
    title: { type: String, required: true, trim: true },
    siteEvaluationId: { type: Schema.Types.ObjectId, ref: "SiteEvaluation", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["draft", "sent"], default: "draft" },
  },
  { timestamps: true }
)

export const Proposal = mongoose.model<IProposal>("Proposal", proposalSchema)
