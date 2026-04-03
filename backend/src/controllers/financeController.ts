import mongoose from "mongoose"
import { Response } from "express"
import { Proposal } from "../models/Proposal"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"

function normalizeProposalInfraKey(
  raw: string | undefined
): "polyhouse" | "shade_net" | "open_field" {
  const t = String(raw ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_")
  if (t === "shade_net" || t === "shadenet") return "shade_net"
  if (t === "open_field" || t === "openfield") return "open_field"
  return "polyhouse"
}

function proposalInvestment(p: {
  investmentValue?: number
  content?: Record<string, unknown>
}): number {
  const c = p.content ?? {}
  const fromContent =
    typeof c.investment === "number"
      ? c.investment
      : typeof c.estimatedCost === "number"
        ? c.estimatedCost
        : 0
  const inv = p.investmentValue ?? fromContent
  return typeof inv === "number" && Number.isFinite(inv) ? inv : 0
}

function proposalRoiMonths(p: {
  roiMonths?: number
  content?: Record<string, unknown>
}): number | null {
  const c = p.content ?? {}
  const r = p.roiMonths ?? (typeof c.roiMonths === "number" ? c.roiMonths : null)
  return typeof r === "number" && Number.isFinite(r) && r >= 0 ? r : null
}

export const getSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const siteId = req.query.siteId as string | undefined

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const match: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(userId) }
  if (siteId) match.siteId = new mongoose.Types.ObjectId(siteId)

  const evalMonthMatch: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    status: "submitted",
    createdAt: { $gte: startOfMonth },
  }
  if (siteId) evalMonthMatch.siteId = new mongoose.Types.ObjectId(siteId)

  const [
    proposals,
    totalResult,
    avgRoiResult,
    activeCountResult,
    trendsResult,
    thisMonthEvalResult,
  ] = await Promise.all([
    Proposal.find(match).lean(),
    Proposal.aggregate([
      { $match: match },
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
      { $match: { ...match, status: { $ne: "rejected" } } },
      {
        $addFields: {
          roi: { $ifNull: ["$roiMonths", "$content.roiMonths"] },
        },
      },
      { $match: { roi: { $exists: true, $ne: null, $gte: 0 } } },
      { $group: { _id: null, avg: { $avg: "$roi" } } },
    ]),
    Proposal.countDocuments({ ...match, status: { $in: ["draft", "recommended"] } }),
    Proposal.aggregate([
      { $match: { ...match, createdAt: { $gte: sixMonthsAgo } } },
      {
        $addFields: {
          inv: {
            $ifNull: [
              "$investmentValue",
              { $ifNull: ["$content.investment", { $ifNull: ["$content.estimatedCost", 0] }] },
            ],
          },
          infra: { $ifNull: ["$infrastructureType", "$content.infrastructureType"] },
        },
      },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            infrastructureType: "$infra",
          },
          total: { $sum: "$inv" },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]),
    SiteEvaluation.aggregate([
      { $match: evalMonthMatch },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$calculatedInvestment", 0] } },
        },
      },
    ]),
  ])

  const totalInvestment = totalResult[0]?.total ?? 0
  const expectedROI = totalInvestment * 2.15
  const avgROITimeline = avgRoiResult[0]?.avg ?? 0
  const activeProposals = activeCountResult ?? 0
  const thisMonthSubmittedInvestment = thisMonthEvalResult[0]?.total ?? 0

  const trendsByMonth: Record<string, { polyhouse: number; shade_net: number; open_field: number }> = {}
  for (const t of trendsResult ?? []) {
    const month = (t._id as { month: string }).month
    const infra = String((t._id as { infrastructureType?: string }).infrastructureType ?? "").toLowerCase().replace(/\s/g, "_")
    if (!trendsByMonth[month]) {
      trendsByMonth[month] = { polyhouse: 0, shade_net: 0, open_field: 0 }
    }
    if (infra in trendsByMonth[month]) {
      (trendsByMonth[month] as Record<string, number>)[infra] = t.total
    } else if (infra === "polyhouse") {
      trendsByMonth[month].polyhouse = t.total
    } else if (infra === "shade_net" || infra === "shadenet") {
      trendsByMonth[month].shade_net = t.total
    } else {
      trendsByMonth[month].open_field = t.total
    }
  }
  let costTrends = Object.entries(trendsByMonth).map(([month, values]) => ({
    month,
    polyhouse: values.polyhouse ?? 0,
    shade_net: values.shade_net ?? 0,
    open_field: values.open_field ?? 0,
  })).sort((a, b) => a.month.localeCompare(b.month))
  if (costTrends.length === 0) {
    const now = new Date()
    costTrends = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      costTrends.push({
        month: d.toISOString().slice(0, 7),
        polyhouse: 0,
        shade_net: 0,
        open_field: 0,
      })
    }
  }

  const staticComparison: Record<
    string,
    { roiMonths: number; profitMargin: string; initialInvestmentPerAcre: string }
  > = {
    polyhouse: {
      roiMonths: 18,
      profitMargin: "35-40%",
      initialInvestmentPerAcre: "₹25-35 lakhs / ac (typical)",
    },
    shade_net: {
      roiMonths: 6,
      profitMargin: "25-30%",
      initialInvestmentPerAcre: "₹2-5 lakhs / ac (typical)",
    },
    open_field: {
      roiMonths: 3,
      profitMargin: "15-20%",
      initialInvestmentPerAcre: "₹0.5-2 lakhs / ac (typical)",
    },
  }

  const groups: Record<
    string,
    { count: number; totalInv: number; roiSum: number; roiN: number }
  > = {
    polyhouse: { count: 0, totalInv: 0, roiSum: 0, roiN: 0 },
    shade_net: { count: 0, totalInv: 0, roiSum: 0, roiN: 0 },
    open_field: { count: 0, totalInv: 0, roiSum: 0, roiN: 0 },
  }
  for (const p of proposals) {
    if (p.status === "rejected") continue
    const content = p.content as Record<string, unknown> | undefined
    const infraRaw =
      typeof p.infrastructureType === "string"
        ? p.infrastructureType
        : typeof content?.infrastructureType === "string"
          ? content.infrastructureType
          : undefined
    const key = normalizeProposalInfraKey(infraRaw)
    const inv = proposalInvestment(p)
    const roi = proposalRoiMonths(p)
    groups[key].count += 1
    groups[key].totalInv += inv
    if (roi != null) {
      groups[key].roiSum += roi
      groups[key].roiN += 1
    }
  }

  const comparison = (["polyhouse", "shade_net", "open_field"] as const).map((type) => {
    const g = groups[type]
    const st = staticComparison[type]
    const avgRoi =
      g.roiN > 0 ? Math.round((g.roiSum / g.roiN) * 10) / 10 : st.roiMonths
    const invLabel =
      g.count > 0
        ? `₹${Math.round(g.totalInv).toLocaleString("en-IN")} total · ${g.count} proposal(s)`
        : st.initialInvestmentPerAcre
    return {
      type,
      roiMonths: avgRoi,
      profitMargin: st.profitMargin,
      initialInvestmentPerAcre: invLabel,
    }
  })

  res.json({
    success: true,
    data: {
      totalInvestment,
      expectedROI,
      avgROITimeline: Math.round(avgROITimeline * 10) / 10,
      activeProposals,
      thisMonthSubmittedInvestment,
      costTrends,
      comparison,
    },
  })
})
