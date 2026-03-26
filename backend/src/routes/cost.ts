import { Router, type IRouter } from "express"
import mongoose from "mongoose"
import { Site } from "../models/Site"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { authMiddleware } from "../middleware/auth"
import {
  avgCostPerAcre,
  getInfrastructureMap,
  normalizeInfrastructureKey,
} from "../services/infrastructureConfigService"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/:siteId", async (req, res, next) => {
  try {
    const siteIdParam = req.params.siteId
    if (!siteIdParam) {
      return res.status(400).json({ success: false, message: "siteId is required" })
    }

    let objectId: mongoose.Types.ObjectId
    try {
      objectId = new mongoose.Types.ObjectId(siteIdParam)
    } catch {
      return res.status(400).json({ success: false, message: "siteId must be a valid id" })
    }

    let area: number | null = null
    let infrastructureType = "Polyhouse"
    let snapshot = null as
      | { type: string; minCost: number; maxCost: number; roiMonths: number }
      | null
      | undefined

    const evaluation = await SiteEvaluation.findById(objectId).populate("siteId", "area").lean()
    if (evaluation) {
      const sitePop = evaluation.siteId as { area?: number } | null
      if (typeof evaluation.area === "number") {
        area = evaluation.area
      } else if (sitePop && typeof sitePop.area === "number") {
        area = sitePop.area
      }
      if (evaluation.infrastructureRecommendation) {
        infrastructureType = evaluation.infrastructureRecommendation
      }
      snapshot = evaluation.infrastructureSnapshot as typeof snapshot
    }

    if (area == null) {
      const site = await Site.findById(objectId).lean()
      if (site && typeof site.area === "number") {
        area = site.area
      }
    }

    if (area == null) {
      return res
        .status(404)
        .json({ success: false, message: "Site or evaluation not found for this id" })
    }

    const infraMap = await getInfrastructureMap()
    const norm = infrastructureType.toLowerCase().replace(/\s+/g, "_")
    const infraKey =
      norm === "shade_net" || norm === "shadenet"
        ? "shade_net"
        : norm === "open_field" || norm === "openfield"
          ? "open_field"
          : "polyhouse"

    const snapType = snapshot?.type ? normalizeInfrastructureKey(String(snapshot.type)) : null
    const useSnapshot =
      !!snapshot &&
      !!snapType &&
      typeof snapshot.minCost === "number" &&
      typeof snapshot.maxCost === "number" &&
      typeof snapshot.roiMonths === "number"
    let row: { minCost: number; maxCost: number; roiMonths: number }
    if (useSnapshot && snapshot) {
      row = {
        minCost: snapshot.minCost,
        maxCost: snapshot.maxCost,
        roiMonths: snapshot.roiMonths,
      }
    } else {
      row = infraMap[infraKey]
    }
    const costPerAcre = avgCostPerAcre(row)

    const units =
      evaluation &&
      typeof (evaluation as { numberOfUnits?: number }).numberOfUnits === "number" &&
      Number.isFinite((evaluation as { numberOfUnits: number }).numberOfUnits) &&
      (evaluation as { numberOfUnits: number }).numberOfUnits >= 1
        ? Math.floor((evaluation as { numberOfUnits: number }).numberOfUnits)
        : 1

    const investment = area * costPerAcre * units
    const finalInvestment = investment * 1.25
    const annualProfit = finalInvestment * 0.4
    const roiMonths = row.roiMonths

    const infrastructureTypeOut =
      useSnapshot && snapType
        ? snapType === "shade_net"
          ? "Shade Net"
          : snapType === "open_field"
            ? "Open Field"
            : "Polyhouse"
        : infrastructureType

    return res.json({
      success: true,
      data: {
        siteId: siteIdParam,
        infrastructureType: infrastructureTypeOut,
        costPerAcre,
        investment,
        finalInvestment,
        annualProfit,
        roiMonths,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router

