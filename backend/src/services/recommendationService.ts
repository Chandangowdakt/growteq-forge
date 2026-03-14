import fs from "fs"
import path from "path"
import { Proposal } from "../models/Proposal"
import mongoose from "mongoose"

export type InfrastructureType = "polyhouse" | "shade_net" | "open_field"

const INFRASTRUCTURE_JSON = path.join(__dirname, "..", "config", "infrastructure.json")

const DEFAULTS: Record<InfrastructureType, { minCostPerAcre: number; maxCostPerAcre: number; roiMonths: number }> = {
  polyhouse: { minCostPerAcre: 2500000, maxCostPerAcre: 3500000, roiMonths: 18 },
  shade_net: { minCostPerAcre: 200000, maxCostPerAcre: 500000, roiMonths: 6 },
  open_field: { minCostPerAcre: 50000, maxCostPerAcre: 200000, roiMonths: 3 },
}

function getConfig(): typeof DEFAULTS {
  if (!fs.existsSync(INFRASTRUCTURE_JSON)) return DEFAULTS
  try {
    const raw = fs.readFileSync(INFRASTRUCTURE_JSON, "utf8")
    const parsed = JSON.parse(raw) as Record<string, { minCostPerAcre?: number; maxCostPerAcre?: number; roiMonths?: number }>
    return {
      polyhouse: { ...DEFAULTS.polyhouse, ...parsed.polyhouse },
      shade_net: { ...DEFAULTS.shade_net, ...parsed.shade_net },
      open_field: { ...DEFAULTS.open_field, ...parsed.open_field },
    }
  } catch {
    return DEFAULTS
  }
}

export function computeRecommendation(area: number, slope: number): {
  infrastructureType: InfrastructureType
  investmentValue: number
  roiMonths: number
} {
  const a = typeof area === "number" && Number.isFinite(area) ? area : 0
  const s = typeof slope === "number" && Number.isFinite(slope) ? slope : 0
  const config = getConfig()
  if (s <= 5) {
    const c = config.polyhouse
    return { infrastructureType: "polyhouse", investmentValue: a * c.minCostPerAcre, roiMonths: c.roiMonths }
  }
  if (s <= 10) {
    const c = config.shade_net
    return { infrastructureType: "shade_net", investmentValue: a * c.minCostPerAcre, roiMonths: c.roiMonths }
  }
  const c = config.open_field
  return { infrastructureType: "open_field", investmentValue: a * c.minCostPerAcre, roiMonths: c.roiMonths }
}

export async function createProposalFromRecommendation(
  userId: string,
  area: number,
  slope: number,
  options: { siteEvaluationId?: mongoose.Types.ObjectId; siteId?: string }
) {
  const { infrastructureType, investmentValue, roiMonths } = computeRecommendation(area, slope)
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
