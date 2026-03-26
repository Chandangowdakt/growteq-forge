import { Proposal } from "../models/Proposal"
import mongoose from "mongoose"
import {
  avgCostPerAcre,
  getInfrastructureMap,
  type InfraCosts,
} from "./infrastructureConfigService"

export type InfrastructureType = "polyhouse" | "shade_net" | "open_field"

export async function computeRecommendation(
  area: number,
  slope: number
): Promise<{
  infrastructureType: InfrastructureType
  investmentValue: number
  roiMonths: number
}> {
  const a = typeof area === "number" && Number.isFinite(area) ? area : 0
  const s = typeof slope === "number" && Number.isFinite(slope) ? slope : 0
  const config = await getInfrastructureMap()

  const pick = (c: InfraCosts, t: InfrastructureType) => ({
    infrastructureType: t,
    investmentValue: Math.round(a * avgCostPerAcre(c)),
    roiMonths: c.roiMonths,
  })

  if (s <= 5) return pick(config.polyhouse, "polyhouse")
  if (s <= 10) return pick(config.shade_net, "shade_net")
  return pick(config.open_field, "open_field")
}

export async function createProposalFromRecommendation(
  userId: string,
  area: number,
  slope: number,
  options: {
    siteEvaluationId?: mongoose.Types.ObjectId
    siteId?: string
    /** When set (e.g. new site evaluation), costs/ROI are frozen from this snapshot. */
    infrastructureSnapshot?: {
      type: InfrastructureType
      minCost: number
      maxCost: number
      roiMonths: number
    }
    numberOfUnits?: number
  }
) {
  const units = Math.max(1, options.numberOfUnits ?? 1)
  let infrastructureType: InfrastructureType
  let investmentValue: number
  let roiMonths: number

  if (options.infrastructureSnapshot) {
    const snap = options.infrastructureSnapshot
    infrastructureType = snap.type
    investmentValue = Math.round(area * avgCostPerAcre(snap) * units)
    roiMonths = snap.roiMonths
  } else {
    const rec = await computeRecommendation(area, slope)
    infrastructureType = rec.infrastructureType
    investmentValue = Math.round(rec.investmentValue * units)
    roiMonths = rec.roiMonths
  }

  const proposal = await Proposal.create({
    userId: new mongoose.Types.ObjectId(userId),
    title: `Recommended: ${infrastructureType}`,
    status: "recommended",
    investmentValue,
    roiMonths,
    infrastructureType,
    content: { area, slope, investmentValue, roiMonths, infrastructureType },
    ...(options.siteEvaluationId && { siteEvaluationId: options.siteEvaluationId }),
    ...(options.siteId && { siteId: new mongoose.Types.ObjectId(options.siteId) }),
  })
  return proposal
}
