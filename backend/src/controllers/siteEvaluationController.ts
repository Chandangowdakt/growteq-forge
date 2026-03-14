import { Response } from "express"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { Site } from "../models/Site"
import { Proposal } from "../models/Proposal"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"
import { createProposalFromRecommendation } from "../services/recommendationService"
import { createNotification } from "./notificationController"

export const listSiteEvaluations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farmId = req.query.farmId as string | undefined
  const status = req.query.status as string | undefined
  const filter: Record<string, unknown> = { userId }
  if (farmId) filter.farmId = farmId
  if (status) filter.status = status
  const evaluations = await SiteEvaluation.find(filter)
    .populate("siteId", "name area")
    .sort({ updatedAt: -1 })
    .lean()
  const evalIds = evaluations.map((e) => e._id)
  const proposals = await Proposal.find({
    userId,
    siteEvaluationId: { $in: evalIds },
  })
    .select("siteEvaluationId")
    .lean()
  const proposalByEval = new Map(
    proposals.map((p) => [String((p as { siteEvaluationId: unknown }).siteEvaluationId), String(p._id)])
  )
  const data = evaluations.map((e) => ({
    ...e,
    proposalId: proposalByEval.get(String(e._id)) ?? null,
  }))
  res.json({ success: true, data })
})

export const createSiteEvaluation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const {
    siteId,
    farmId,
    soilType,
    waterAvailability,
    slopePercentage,
    elevationMeters,
    sunExposure,
    notes,
  } = req.body
  if (!siteId || !farmId || !soilType || !waterAvailability || slopePercentage == null) {
    throw new ApiError(
      400,
      "siteId, farmId, soilType, waterAvailability, and slopePercentage are required"
    )
  }
  const evaluation = await SiteEvaluation.create({
    userId,
    siteId,
    farmId,
    soilType: String(soilType).trim(),
    waterAvailability: String(waterAvailability).trim(),
    slopePercentage: Number(slopePercentage),
    elevationMeters: elevationMeters != null ? Number(elevationMeters) : undefined,
    sunExposure: sunExposure ?? "full",
    notes: notes?.trim?.(),
  })
  const site = await Site.findById(siteId).lean()
  const area = (site?.area as number) ?? 0
  const slope = Number(slopePercentage)
  const proposal = await createProposalFromRecommendation(userId, area, slope, {
    siteEvaluationId: evaluation._id,
    siteId: String(siteId),
  })
  const siteName = (site as { name?: string })?.name ?? "Site"
  await createNotification({
    userId,
    title: "Site evaluation created",
    message: `Site evaluation created for ${siteName}`,
    type: "info",
    relatedEntityType: "SiteEvaluation",
    relatedEntityId: evaluation._id,
  })
  const evaluationWithSite = await SiteEvaluation.findById(evaluation._id)
    .populate("siteId", "name area")
    .lean()
  res.status(201).json({
    success: true,
    data: {
      evaluation: evaluationWithSite ?? evaluation,
      proposal,
    },
  })
})

export const getSiteEvaluation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const evaluation = await SiteEvaluation.findOne({ _id: req.params.id, userId })
    .populate("siteId")
    .lean()
  if (!evaluation) throw new ApiError(404, "Site evaluation not found")
  const proposal = await Proposal.findOne({
    siteEvaluationId: evaluation._id,
    userId,
  }).lean()
  res.json({
    success: true,
    data: { ...evaluation, proposal: proposal ?? null },
  })
})

export const updateStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const { status } = req.body
  const allowed = ["submitted", "approved", "rejected"]
  if (!status || !allowed.includes(status)) {
    throw new ApiError(400, "status must be one of: submitted, approved, rejected")
  }
  const evaluation = await SiteEvaluation.findOneAndUpdate(
    { _id: req.params.id, userId },
    { $set: { status } },
    { new: true }
  )
  if (!evaluation) throw new ApiError(404, "Site evaluation not found")
  await createNotification({
    userId,
    title: "Evaluation status updated",
    message: `Evaluation status updated to ${status}`,
    type: "info",
    relatedEntityType: "SiteEvaluation",
    relatedEntityId: evaluation._id,
  })
  res.json({ success: true, data: evaluation })
})

export const updateSiteEvaluation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const allowed = [
    "soilType",
    "waterAvailability",
    "slopePercentage",
    "elevationMeters",
    "sunExposure",
    "notes",
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key]
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

export const getSiteDetails = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const siteId = req.params.siteId
  const site = await Site.findById(siteId).lean()
  if (!site) throw new ApiError(404, "Site not found")
  res.json({ success: true, data: site })
})

export const getSiteBoundary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const siteId = req.params.siteId
  const site = await Site.findById(siteId).select("geojson").lean()
  if (!site) throw new ApiError(404, "Site not found")
  res.json({ success: true, data: (site as { geojson?: unknown }).geojson ?? null })
})

export const getSiteGeojsonExport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const siteId = req.params.siteId
  const site = await Site.findById(siteId).select("geojson").lean()
  if (!site) throw new ApiError(404, "Site not found")
  res.json({ success: true, data: (site as { geojson?: unknown }).geojson ?? null })
})
