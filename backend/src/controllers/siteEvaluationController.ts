import { Response } from "express"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"
import { calculateCost, type InfrastructureType } from "../services/costEngine"

export const listSiteEvaluations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farmId = req.query.farmId as string | undefined
  const filter: Record<string, unknown> = { userId }
  if (farmId) filter.farmId = farmId
  const evaluations = await SiteEvaluation.find(filter).sort({ updatedAt: -1 })
  res.json({ success: true, data: evaluations })
})

export const createSiteEvaluation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const {
    name,
    farmId,
    boundary,
    area,
    areaUnit,
    slope,
    infrastructureRecommendation,
    costCurrency,
  } = req.body
  if (!name) throw new ApiError(400, "Site name is required")
  if (area == null) throw new ApiError(400, "Area is required")
  let costEstimate: number | undefined
  if (infrastructureRecommendation != null && area != null) {
    try {
      costEstimate = calculateCost(Number(area), infrastructureRecommendation as InfrastructureType)
    } catch (err) {
      throw new ApiError(400, err instanceof Error ? err.message : "Invalid cost parameters")
    }
  }
  const evaluation = await SiteEvaluation.create({
    userId,
    name,
    farmId,
    boundary: boundary ?? [],
    area,
    areaUnit: areaUnit ?? "acres",
    slope,
    infrastructureRecommendation,
    costEstimate,
    costCurrency: costCurrency ?? "INR",
  })
  res.status(201).json({ success: true, data: evaluation })
})

export const getSiteEvaluation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const evaluation = await SiteEvaluation.findOne({ _id: req.params.id, userId })
  if (!evaluation) throw new ApiError(404, "Site evaluation not found")
  res.json({ success: true, data: evaluation })
})

export const updateSiteEvaluation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const existing = await SiteEvaluation.findOne({ _id: req.params.id, userId })
  if (!existing) throw new ApiError(404, "Site evaluation not found")
  const update: Record<string, unknown> = { ...req.body }
  delete update.costEstimate
  if (update.infrastructureRecommendation != null) {
    const areaForCost = update.area != null ? Number(update.area) : existing.area
    if (areaForCost != null) {
      try {
        update.costEstimate = calculateCost(
          areaForCost,
          update.infrastructureRecommendation as InfrastructureType
        )
      } catch (err) {
        throw new ApiError(400, err instanceof Error ? err.message : "Invalid cost parameters")
      }
    }
  }
  const evaluation = await SiteEvaluation.findOneAndUpdate(
    { _id: req.params.id, userId },
    { $set: update },
    { new: true, runValidators: true }
  )
  if (!evaluation) throw new ApiError(404, "Site evaluation not found")
  res.json({ success: true, data: evaluation })
})

export const deleteSiteEvaluation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const evaluation = await SiteEvaluation.findOneAndDelete({ _id: req.params.id, userId })
  if (!evaluation) throw new ApiError(404, "Site evaluation not found")
  res.json({ success: true, message: "Site evaluation deleted" })
})
