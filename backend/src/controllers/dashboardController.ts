import { Response } from "express"
import { Site } from "../models/Site"
import { Proposal } from "../models/Proposal"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"

const COMPLETION_PCT: Record<string, number> = { draft: 30, submitted: 60, approved: 100, rejected: 0 }
function completionPercent(status: string): number {
  return COMPLETION_PCT[status] ?? 30
}

export const getWorkInProgress = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const evaluations = await SiteEvaluation.find({ userId })
    .populate("farmId", "name")
    .populate("siteId", "name area geojson")
    .sort({ updatedAt: -1 })
    .lean()

  const evalIds = evaluations.map((e) => e._id)
  const proposals = await Proposal.find({ siteEvaluationId: { $in: evalIds } })
    .select("siteEvaluationId")
    .lean()
  const proposalByEval = new Map(
    proposals.map((p) => [String((p as { siteEvaluationId: unknown }).siteEvaluationId), String((p as { _id: unknown })._id)])
  )

  const data = evaluations.map((e) => {
    const farm = e.farmId as { name?: string } | null
    const site = e.siteId as { name?: string; area?: number; geojson?: { coordinates?: unknown[] } } | null
    let boundaryPointCount = 0
    if (site?.geojson && Array.isArray((site.geojson as { coordinates?: unknown[] }).coordinates?.[0])) {
      boundaryPointCount = (site.geojson as { coordinates: unknown[][] }).coordinates[0].length
    }
    return {
      _id: e._id,
      farmName: farm?.name ?? "Farm",
      siteName: site?.name ?? "Site",
      area: site?.area ?? 0,
      status: e.status,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      boundaryPointCount,
      boundaryPoints: boundaryPointCount,
      completionPercentage: completionPercent(e.status),
      proposalId: proposalByEval.get(String(e._id)) ?? null,
    }
  })

  res.json({ success: true, data })
})

export const getSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const [totalSites, sitesAreaResult, totalProposals, pipelineResult, avgRoiResult, revenueTrendResult] =
    await Promise.all([
      Site.countDocuments(),
      Site.aggregate([{ $group: { _id: null, total: { $sum: "$area" } } }]),
      Proposal.countDocuments(),
      Proposal.aggregate([
        { $match: { status: { $ne: "rejected" } } },
        {
          $addFields: {
            inv: {
              $ifNull: [
                "$investmentValue",
                { $ifNull: ["$content.investment", { $ifNull: ["$content.estimatedCost", 0] }] },
              ],
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$inv" } } },
      ]),
      Proposal.aggregate([
        {
          $addFields: {
            roi: { $ifNull: ["$roiMonths", "$content.roiMonths"] },
          },
        },
        { $match: { roi: { $exists: true, $ne: null, $gte: 0 } } },
        { $group: { _id: null, avg: { $avg: "$roi" } } },
      ]),
      Proposal.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        {
          $addFields: {
            inv: {
              $ifNull: [
                "$investmentValue",
                { $ifNull: ["$content.investment", { $ifNull: ["$content.estimatedCost", 0] }] },
              ],
            },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            value: { $sum: "$inv" },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { month: "$_id", value: 1, _id: 0 } },
      ]),
    ])

  const totalArea = sitesAreaResult[0]?.total ?? 0
  const pipelineValue = pipelineResult[0]?.total ?? 0
  const averageROI = avgRoiResult[0]?.avg ?? 0
  const revenueTrend = (revenueTrendResult ?? []).map(
    (r: { month: string; value: number }) => ({ month: r.month, value: r.value })
  )

  res.json({
    success: true,
    data: {
      totalSites,
      totalArea,
      totalProposals,
      pipelineValue,
      averageROI: Math.round(averageROI * 10) / 10,
      revenueTrend,
    },
  })
})
