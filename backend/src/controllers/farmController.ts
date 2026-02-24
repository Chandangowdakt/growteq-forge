import { Response } from "express"
import { Farm } from "../models/Farm"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"

export const listFarms = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farms = await Farm.find({ userId }).sort({ createdAt: -1 })
  res.json({ success: true, data: farms })
})

export const createFarm = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const { name, description, location } = req.body
  if (!name) throw new ApiError(400, "Farm name is required")
  const farm = await Farm.create({ userId, name, description, location })
  res.status(201).json({ success: true, data: farm })
})

export const getFarm = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farm = await Farm.findOne({ _id: req.params.id, userId })
  if (!farm) throw new ApiError(404, "Farm not found")
  res.json({ success: true, data: farm })
})

export const updateFarm = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farm = await Farm.findOneAndUpdate(
    { _id: req.params.id, userId },
    { $set: req.body },
    { new: true, runValidators: true }
  )
  if (!farm) throw new ApiError(404, "Farm not found")
  res.json({ success: true, data: farm })
})

export const deleteFarm = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.auth!.userId
  const farm = await Farm.findOneAndDelete({ _id: req.params.id, userId })
  if (!farm) throw new ApiError(404, "Farm not found")
  res.json({ success: true, message: "Farm deleted" })
})
