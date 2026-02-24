import mongoose from "mongoose"
import { Response } from "express"
import { Farm } from "../models/Farm"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"

export const getSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const userIdObj = new mongoose.Types.ObjectId(userId)

  const [farms, evaluations, aggResult] = await Promise.all([
    Farm.find({ userId }).sort({ createdAt: -1 }),
    SiteEvaluation.find({ userId }).sort({ updatedAt: -1 }),
    SiteEvaluation.aggregate([
      { $match: { userId: userIdObj } },
      {
        $facet: {
          revenueStats: [
            { $match: { status: "submitted" } },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: { $ifNull: ["$costEstimate", 0] } },
                count: { $sum: 1 },
              },
            },
          ],
          draftCount: [
            { $match: { status: "draft" } },
            { $count: "count" },
          ],
          submittedCount: [
            { $match: { status: "submitted" } },
            { $count: "count" },
          ],
          monthlyRevenue: [
            { $match: { status: "submitted" } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } },
                total: { $sum: { $ifNull: ["$costEstimate", 0] } },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]),
  ])

  const draftCount = aggResult[0]?.draftCount?.[0]?.count ?? 0
  const submittedCount = aggResult[0]?.submittedCount?.[0]?.count ?? 0
  const totalRevenue = aggResult[0]?.revenueStats?.[0]?.totalRevenue ?? 0
  const monthlyRevenue = (aggResult[0]?.monthlyRevenue ?? []).map(
    (r: { _id: string; total: number }) => ({ month: r._id, total: r.total })
  )

  const draftEvaluations = evaluations.filter((e) => e.status === "draft").length
  const submitted = evaluations.filter((e) => e.status === "submitted").length
  const totalLandArea = evaluations.reduce((sum, e) => sum + (e.area ?? 0), 0)

  const averageProjectCost =
    submittedCount > 0 ? Math.round(totalRevenue / submittedCount) : 0

  res.json({
    success: true,
    data: {
      activeSites: evaluations.length,
      draftEvaluations,
      submitted,
      totalLandArea,
      farms,
      evaluations,
      totalRevenue,
      draftCount,
      submittedCount,
      totalFarms: farms.length,
      averageProjectCost,
      monthlyRevenue,
    },
  })
})
