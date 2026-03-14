import { Response } from "express"
import { Farm } from "../models/Farm"
import { Site } from "../models/Site"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"

const notDeleted = { deletedAt: { $exists: false } }

export const listFarms = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farms = await Farm.find({ userId, ...notDeleted }).sort({ createdAt: -1 }).lean()
  const farmIds = farms.map((f) => f._id)
  const counts = await Site.aggregate([
    { $match: { farmId: { $in: farmIds } } },
    { $group: { _id: "$farmId", count: { $sum: 1 } } },
  ])
  const countByFarm = new Map(counts.map((c) => [String(c._id), c.count]))
  const data = farms.map((f) => ({
    ...f,
    siteCount: countByFarm.get(String(f._id)) ?? 0,
  }))
  res.json({ success: true, data })
})

export const createFarm = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const { name, location, totalArea, country, state, district, description } = req.body
  if (!name || typeof name !== "string" || !name.trim()) {
    throw new ApiError(400, "Farm name is required")
  }
  const farm = await Farm.create({
    userId,
    name: name.trim(),
    location: location?.trim?.() ?? undefined,
    totalArea: totalArea != null ? Number(totalArea) : undefined,
    country: country?.trim?.() ?? undefined,
    state: state?.trim?.() ?? undefined,
    district: district?.trim?.() ?? undefined,
    description: description?.trim?.() ?? undefined,
  })
  res.status(201).json({ success: true, data: farm })
})

export const getFarm = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farmId = req.params.farmId ?? req.params.id
  const farm = await Farm.findOne({ _id: farmId, userId, ...notDeleted })
  if (!farm) throw new ApiError(404, "Farm not found")
  const siteCount = await Site.countDocuments({ farmId: farm._id })
  const data = farm.toObject ? farm.toObject() : farm
  res.json({ success: true, data: { ...data, siteCount } })
})

export const updateFarm = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farmId = req.params.farmId ?? req.params.id
  const allowed = ["name", "location", "totalArea", "country", "state", "district", "description"]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key]
  }
  const farm = await Farm.findOneAndUpdate(
    { _id: farmId, userId, ...notDeleted },
    { $set: update },
    { new: true, runValidators: true }
  )
  if (!farm) throw new ApiError(404, "Farm not found")
  res.json({ success: true, data: farm })
})

export const deleteFarm = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farmId = req.params.farmId ?? req.params.id
  const farm = await Farm.findOneAndUpdate(
    { _id: farmId, userId, ...notDeleted },
    { $set: { deletedAt: new Date() } },
    { new: true }
  )
  if (!farm) throw new ApiError(404, "Farm not found")
  res.json({ success: true, message: "Farm deleted" })
})

export const getFarmSites = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farmId = req.params.farmId ?? req.params.id
  const farm = await Farm.findOne({ _id: farmId, userId, ...notDeleted })
  if (!farm) throw new ApiError(404, "Farm not found")
  const sites = await Site.find({ farmId: farm._id }).sort({ createdAt: -1 })
  res.json({ success: true, data: sites })
})
