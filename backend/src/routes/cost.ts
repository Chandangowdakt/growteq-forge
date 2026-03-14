import { Router, type IRouter } from "express"
import mongoose from "mongoose"
import { Site } from "../models/Site"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { authMiddleware } from "../middleware/auth"

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

    const evaluation = await SiteEvaluation.findById(objectId).lean()
    if (evaluation && typeof evaluation.area === "number") {
      area = evaluation.area
      if (evaluation.infrastructureRecommendation) {
        infrastructureType = evaluation.infrastructureRecommendation
      }
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

    let costPerAcre = 3000000
    if (infrastructureType === "Shade Net") {
      costPerAcre = 350000
    } else if (infrastructureType === "Open Field") {
      costPerAcre = 100000
    }

    const investment = area * costPerAcre
    const finalInvestment = investment * 1.25
    const annualProfit = finalInvestment * 0.4
    const roiMonths = finalInvestment / (annualProfit / 12)

    return res.json({
      success: true,
      data: {
        siteId: siteIdParam,
        infrastructureType,
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

