import { Router, type IRouter } from "express"
import { Proposal } from "../models/Proposal"
import { Site } from "../models/Site"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { authMiddleware } from "../middleware/auth"

const router: IRouter = Router()

router.use(authMiddleware)

// GET /api/insights/pipeline — by month: approved, drafted, submitted
router.get("/pipeline", async (_req, res, next) => {
  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const agg = await SiteEvaluation.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          drafted: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          submitted: { $sum: { $cond: [{ $eq: ["$status", "submitted"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { month: "$_id", approved: 1, drafted: 1, submitted: 1, _id: 0 } },
    ])
    const proposals = await Proposal.find().lean()
    const totalPipelineValue = proposals.reduce((sum, p) => {
      const inv =
        typeof (p as { investmentValue?: number }).investmentValue === "number"
          ? (p as { investmentValue: number }).investmentValue
          : (() => {
              const c = (p as { content?: { investment?: number; estimatedCost?: number } }).content
              return typeof c?.investment === "number" ? c.investment : typeof c?.estimatedCost === "number" ? c.estimatedCost : 0
            })()
      return sum + inv
    }, 0)
    res.json({
      success: true,
      data: {
        byMonth: agg,
        totalPipelineValue,
        proposalCount: proposals.length,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/insights/site-ranking — site name, area, score (area/max*100), roiMonths from proposal
router.get("/site-ranking", async (_req, res, next) => {
  try {
    const sites = await Site.find().lean()
    const siteIds = sites.map((s) => s._id)
    const proposals = await Proposal.find({ siteId: { $in: siteIds } }).lean()
    const proposalBySite = new Map<string | undefined, { roiMonths?: number; infrastructureType?: string }>()
    for (const p of proposals) {
      const sid = String((p as { siteId?: unknown }).siteId)
      if (!proposalBySite.has(sid)) {
        proposalBySite.set(sid, {
          roiMonths: (p as { roiMonths?: number }).roiMonths ?? (p as { content?: { roiMonths?: number } }).content?.roiMonths,
          infrastructureType: (p as { infrastructureType?: string }).infrastructureType ?? (p as { content?: { infrastructureType?: string } }).content?.infrastructureType,
        })
      }
    }
    const maxArea = Math.max(...sites.map((s) => (typeof s.area === "number" ? s.area : 0)), 1)
    const data = sites
      .map((s) => {
        const area = typeof s.area === "number" ? s.area : 0
        const prop = proposalBySite.get(String(s._id))
        const rawName = (s as { name?: string }).name
        const siteName = (typeof rawName === "string" && rawName.trim()) ? rawName.trim() : "Unnamed Site"
        return {
          siteId: String(s._id),
          siteName,
          area,
          score: Math.min(100, Math.round((area / maxArea) * 100)),
          roiMonths: prop?.roiMonths ?? null,
          infrastructureType: prop?.infrastructureType ?? null,
        }
      })
      .sort((a, b) => b.area - a.area)

    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

// GET /api/insights/roi-distribution — projections by infrastructure at month 1,3,6,12
router.get("/roi-distribution", async (_req, res, next) => {
  try {
    const proposals = await Proposal.find().lean()
    const byType: Record<string, { inv: number[]; roi: number[] }> = {}
    for (const p of proposals) {
      const doc = p as {
        infrastructureType?: string
        investmentValue?: number
        roiMonths?: number
        content?: { investment?: number; estimatedCost?: number; roiMonths?: number; infrastructureType?: string }
      }
      const type = (doc.infrastructureType ?? doc.content?.infrastructureType ?? "open_field").toString().toLowerCase().replace(/\s/g, "_")
      const inv = typeof doc.investmentValue === "number" ? doc.investmentValue : doc.content?.investment ?? doc.content?.estimatedCost ?? 0
      const roi = typeof doc.roiMonths === "number" ? doc.roiMonths : doc.content?.roiMonths ?? 0
      if (!byType[type]) byType[type] = { inv: [], roi: [] }
      byType[type].inv.push(inv)
      byType[type].roi.push(roi)
    }
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
    const polyhouse = avg(byType.polyhouse?.inv ?? []) || 0
    const shade_net = avg(byType.shade_net?.inv ?? []) || 0
    const open_field = avg(byType.open_field?.inv ?? []) || 0
    const data = [
      { month: 1, polyhouse: Math.round(polyhouse * 0.1), shade_net: Math.round(shade_net * 0.15), open_field: Math.round(open_field * 0.2) },
      { month: 3, polyhouse: Math.round(polyhouse * 0.25), shade_net: Math.round(shade_net * 0.4), open_field: Math.round(open_field * 0.6) },
      { month: 6, polyhouse: Math.round(polyhouse * 0.5), shade_net: Math.round(shade_net * 0.7), open_field: Math.round(open_field * 0.9) },
      { month: 12, polyhouse: Math.round(polyhouse), shade_net: Math.round(shade_net), open_field: Math.round(open_field) },
    ]
    res.json({ success: true, data })
  } catch (err) {
    next(err)
  }
})

export default router

