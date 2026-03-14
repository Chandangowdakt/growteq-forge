import fs from "fs"
import path from "path"
import { Response } from "express"
import { User } from "../models/User"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"

const INFRASTRUCTURE_JSON = path.join(__dirname, "..", "config", "infrastructure.json")

const DEFAULT_INFRASTRUCTURE = {
  polyhouse: { minCostPerAcre: 2500000, maxCostPerAcre: 3500000, roiMonths: 18 },
  shade_net: { minCostPerAcre: 200000, maxCostPerAcre: 500000, roiMonths: 6 },
  open_field: { minCostPerAcre: 50000, maxCostPerAcre: 200000, roiMonths: 3 },
}

export const listTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const users = await User.find({})
    .select("name email role isActive createdAt")
    .sort({ createdAt: -1 })
    .lean()
  const data = users.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role ?? "user",
    status: (u as { isActive?: boolean }).isActive !== false ? "active" : "inactive",
    createdAt: u.createdAt,
  }))
  res.json({ success: true, data })
})

export const addTeamMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, role } = req.body as { name?: string; email?: string; role?: string }
  if (!name?.trim() || !email?.trim()) {
    throw new ApiError(400, "name and email are required")
  }
  const existing = await User.findOne({ email: email.trim().toLowerCase() })
  if (existing) {
    throw new ApiError(400, "User with this email already exists")
  }
  const user = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: "changeme123",
    role: role === "admin" ? "admin" : "user",
    isActive: true,
  })
  res.status(201).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: "active",
    },
  })
})

export const updateTeamMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.userId
  const { role, status } = req.body as { role?: string; status?: string }
  const update: Record<string, unknown> = {}
  if (role === "admin" || role === "user") update.role = role
  if (status === "active" || status === "inactive") update.isActive = status === "active"

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true }
  ).select("name email role isActive")
  if (!user) throw new ApiError(404, "User not found")
  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: (user as { isActive?: boolean }).isActive !== false ? "active" : "inactive",
    },
  })
})

export const removeTeamMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.userId
  const currentUserId = req.auth!.userId
  if (userId === currentUserId) {
    throw new ApiError(400, "Cannot remove yourself")
  }
  const user = await User.findByIdAndDelete(userId)
  if (!user) throw new ApiError(404, "User not found")
  res.json({ success: true, message: "Team member removed" })
})

export const getInfrastructure = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  let data = DEFAULT_INFRASTRUCTURE
  if (fs.existsSync(INFRASTRUCTURE_JSON)) {
    try {
      const raw = fs.readFileSync(INFRASTRUCTURE_JSON, "utf8")
      data = { ...DEFAULT_INFRASTRUCTURE, ...JSON.parse(raw) }
    } catch {
      // use defaults on parse error
    }
  }
  res.json({ success: true, data })
})

export const saveInfrastructure = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as Record<string, { minCostPerAcre?: number; maxCostPerAcre?: number; roiMonths?: number }>
  const dir = path.dirname(INFRASTRUCTURE_JSON)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const current = fs.existsSync(INFRASTRUCTURE_JSON)
    ? JSON.parse(fs.readFileSync(INFRASTRUCTURE_JSON, "utf8"))
    : DEFAULT_INFRASTRUCTURE
  const data = {
    polyhouse: { ...current.polyhouse, ...body.polyhouse },
    shade_net: { ...current.shade_net, ...body.shade_net },
    open_field: { ...current.open_field, ...body.open_field },
  }
  fs.writeFileSync(INFRASTRUCTURE_JSON, JSON.stringify(data, null, 2), "utf8")
  res.json({ success: true, data })
})
