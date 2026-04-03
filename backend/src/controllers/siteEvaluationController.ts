import { Response } from "express"
import mongoose from "mongoose"
import { SiteEvaluation } from "../models/SiteEvaluation"
import { Site } from "../models/Site"
import { Proposal } from "../models/Proposal"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"
import { needsOwnUserScope } from "../utils/permissionUtils"
import { createProposalFromRecommendation } from "../services/recommendationService"
import {
  getInfrastructureMap,
  getInfrastructureConfigVersion,
  normalizeInfrastructureKey,
  isValidInfraCosts,
  type InfraCosts,
} from "../services/infrastructureConfigService"
import type { InfrastructureKind } from "../models/Infrastructure"
import { createNotification } from "./notificationController"
import { logAudit } from "../utils/auditLogger"

export const listSiteEvaluations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farmId = req.query.farmId as string | undefined
  const siteId = req.query.siteId as string | undefined
  const status = req.query.status as string | undefined
  const filter: Record<string, unknown> = {}
  if (needsOwnUserScope(req.user, "evaluations")) {
    filter.userId = userId
  }
  if (farmId) filter.farmId = farmId
  if (siteId && mongoose.Types.ObjectId.isValid(siteId)) {
    filter.siteId = new mongoose.Types.ObjectId(siteId)
  }
  if (status) filter.status = status
  const evaluations = await SiteEvaluation.find(filter)
    .populate("farmId", "name")
    .populate("siteId", "name area")
    .sort({ createdAt: -1 })
    .lean()
  const evalIds = evaluations.map((e) => e._id)
  const proposalFilter: Record<string, unknown> = { siteEvaluationId: { $in: evalIds } }
  if (needsOwnUserScope(req.user, "proposals")) proposalFilter.userId = userId
  const proposals = await Proposal.find(proposalFilter)
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
    infrastructureType,
    numberOfUnits,
    cropType,
    calculatedInvestment,
  } = req.body
  if (!siteId || !farmId || !soilType || !waterAvailability || slopePercentage == null) {
    throw new ApiError(
      400,
      "siteId, farmId, soilType, waterAvailability, and slopePercentage are required"
    )
  }

  let siteObjectId: mongoose.Types.ObjectId
  try {
    siteObjectId = new mongoose.Types.ObjectId(siteId as string)
  } catch (e) {
    console.error("Invalid siteId format:", siteId)
    return res.status(400).json({ success: false, error: "Invalid siteId" })
  }

  const site = await Site.findById(siteId).lean()
  const area = (site?.area as number) ?? 0
  const slope = Number(slopePercentage)

  const infraMap = await getInfrastructureMap()
  const configVersion = await getInfrastructureConfigVersion()
  const units =
    typeof numberOfUnits === "number" && Number.isFinite(numberOfUnits) && numberOfUnits >= 1
      ? Math.floor(numberOfUnits)
      : 1

  let selectedKey: InfrastructureKind
  let selectedCosts: InfraCosts
  const rawInfra = infrastructureType
  if (rawInfra != null && String(rawInfra).trim() !== "") {
    const norm = normalizeInfrastructureKey(String(rawInfra))
    if (!norm) {
      throw new ApiError(400, "Invalid infrastructureType")
    }
    selectedKey = norm
    selectedCosts = infraMap[selectedKey]
  } else {
    const s = Number.isFinite(slope) ? slope : 0
    if (s <= 5) {
      selectedKey = "polyhouse"
      selectedCosts = infraMap.polyhouse
    } else if (s <= 10) {
      selectedKey = "shade_net"
      selectedCosts = infraMap.shade_net
    } else {
      selectedKey = "open_field"
      selectedCosts = infraMap.open_field
    }
  }

  if (!isValidInfraCosts(selectedCosts)) {
    throw new ApiError(500, "Invalid infrastructure configuration")
  }

  const infrastructureSnapshot = {
    type: selectedKey,
    minCost: selectedCosts.minCost,
    maxCost: selectedCosts.maxCost,
    roiMonths: selectedCosts.roiMonths,
    configVersion,
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
    numberOfUnits: units,
    ...(typeof cropType === "string" && cropType.trim() && { cropType: cropType.trim() }),
    ...(typeof calculatedInvestment === "number" &&
      Number.isFinite(calculatedInvestment) && { calculatedInvestment }),
    infrastructureRecommendation: selectedKey,
    infrastructureSnapshot,
  })

  const updatedSite = await Site.findByIdAndUpdate(
    siteObjectId,
    { $set: { status: "submitted" } },
    { new: true, runValidators: false }
  )
  console.log("Site update result:", {
    siteId: siteObjectId.toString(),
    found: !!updatedSite,
    newStatus: (updatedSite as any)?.status,
  })

  const proposal = await createProposalFromRecommendation(userId, area, slope, {
    siteEvaluationId: evaluation._id,
    siteId: String(siteId),
    infrastructureSnapshot,
    numberOfUnits: units,
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
  logAudit({
    userId: req.auth!.userId,
    action: "CREATE",
    module: "evaluations",
    entityId: evaluation._id,
    after: {
      evaluationId: String(evaluation._id),
      siteId: String(siteId),
      farmId: String(farmId),
      status: evaluation.status,
      infrastructureRecommendation: evaluation.infrastructureRecommendation,
    },
    req,
  })

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
  const evalFilter: Record<string, unknown> = { _id: req.params.id }
  if (needsOwnUserScope(req.user, "evaluations")) evalFilter.userId = userId
  const evaluation = await SiteEvaluation.findOne(evalFilter).populate("siteId").lean()
  if (!evaluation) throw new ApiError(404, "Site evaluation not found")
  const proposalFilter: Record<string, unknown> = { siteEvaluationId: evaluation._id }
  if (needsOwnUserScope(req.user, "proposals")) proposalFilter.userId = userId
  const proposal = await Proposal.findOne(proposalFilter).lean()
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
  const previous = await SiteEvaluation.findById(req.params.id).lean()
  const evaluation = await SiteEvaluation.findOneAndUpdate(
    { _id: req.params.id },
    { $set: { status } },
    { new: true }
  )
  if (!evaluation) throw new ApiError(404, "Site evaluation not found")
  logAudit({
    userId: req.auth!.userId,
    action: "UPDATE",
    module: "evaluations",
    entityId: evaluation._id,
    before: previous ? { status: previous.status } : undefined,
    after: { status: evaluation.status },
    req,
  })
  const notifyUserId = String((evaluation as { userId?: unknown }).userId ?? userId)
  await createNotification({
    userId: notifyUserId,
    title: "Evaluation status updated",
    message: `Evaluation status updated to ${status}`,
    type: "info",
    relatedEntityType: "SiteEvaluation",
    relatedEntityId: evaluation._id,
  })
  res.json({ success: true, data: evaluation })
})

export const updateSiteEvaluation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
  const previous = await SiteEvaluation.findById(req.params.id).lean()
  const evaluation = await SiteEvaluation.findOneAndUpdate(
    { _id: req.params.id },
    { $set: update },
    { new: true, runValidators: true }
  )
  if (!evaluation) throw new ApiError(404, "Site evaluation not found")
  const beforePick: Record<string, unknown> = {}
  const afterPick: Record<string, unknown> = {}
  for (const key of allowed) {
    if (previous && key in previous) beforePick[key] = (previous as Record<string, unknown>)[key]
    if (key in update) afterPick[key] = update[key]
  }
  if (Object.keys(update).length > 0) {
    logAudit({
      userId: req.auth!.userId,
      action: "UPDATE",
      module: "evaluations",
      entityId: evaluation._id,
      before: Object.keys(beforePick).length ? beforePick : undefined,
      after: Object.keys(afterPick).length ? afterPick : undefined,
      req,
    })
  }
  res.json({ success: true, data: evaluation })
})

export const deleteSiteEvaluation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const evaluation = await SiteEvaluation.findOneAndDelete({ _id: req.params.id })
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
