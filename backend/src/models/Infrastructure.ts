import mongoose, { Document, Schema } from "mongoose"

export type InfrastructureKind = "polyhouse" | "shade_net" | "open_field"

export interface IInfrastructure extends Document {
  type: InfrastructureKind
  minCost: number
  maxCost: number
  roiMonths: number
}

const infrastructureSchema = new Schema<IInfrastructure>(
  {
    type: {
      type: String,
      enum: ["polyhouse", "shade_net", "open_field"],
      required: true,
      unique: true,
    },
    minCost: { type: Number, required: true, min: 0 },
    maxCost: { type: Number, required: true, min: 0 },
    roiMonths: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
)

export const Infrastructure = mongoose.model<IInfrastructure>("Infrastructure", infrastructureSchema)
