import { Response } from "express"
import { User } from "../models/User"
import { Infrastructure, type InfrastructureKind } from "../models/Infrastructure"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"
import {
  getInfrastructureMap,
  bumpInfrastructureConfigVersion,
  type InfraCosts,
} from "../services/infrastructureConfigService"
import { normalizeRole } from "../middleware/roleMiddleware"
import {
  getDefaultPermissions,
  getEffectivePermissions,
  permissionsToJSON,
  sanitizePermissionsPatch,
} from "../utils/permissionUtils"
import { logAudit } from "../utils/auditLogger"

const INFRA_KINDS: InfrastructureKind[] = ["polyhouse", "shade_net", "open_field"]

function parseInfraRow(
  row: { minCost?: number; maxCost?: number; roiMonths?: number; minCostPerAcre?: number; maxCostPerAcre?: number } | undefined
): InfraCosts | null {
  if (!row) return null
  const min = row.minCost ?? row.minCostPerAcre
  const max = row.maxCost ?? row.maxCostPerAcre
  const roi = row.roiMonths
  if (min == null || max == null || roi == null) return null
  return { minCost: Number(min), maxCost: Number(max), roiMonths: Number(roi) }
}

export const listTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const users = await User.find({})
    .select("name email role isActive createdAt permissions")
    .sort({ createdAt: -1 })
    .lean()
  const data = users.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role ?? "viewer",
    status: (u as { isActive?: boolean }).isActive !== false ? "active" : "inactive",
    createdAt: u.createdAt,
    permissions: permissionsToJSON(
      getEffectivePermissions({
        role: u.role,
        permissions: (u as { permissions?: unknown }).permissions,
      })
    ),
  }))
  res.json({ success: true, data })
})

/** Persisted role values aligned with frontend team dropdown (User schema enum). */
function normalizeTeamMemberStoredRole(
  role: string | undefined
): "admin" | "field_evaluator" | "sales_associate" {
  const r = (role ?? "").toString().trim().toLowerCase()
  if (r === "admin" || r === "sales director") return "admin"
  if (r === "field_evaluator" || r === "field evaluator" || r === "editor") return "field_evaluator"
  if (r === "sales_associate" || r === "sales associate" || r === "viewer" || r === "user") return "sales_associate"
  return "sales_associate"
}

export const addTeamMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, role } = req.body as { name?: string; email?: string; role?: string }
  if (!name?.trim() || !email?.trim()) {
    throw new ApiError(400, "name and email are required")
  }
  const normalizedEmail = email.trim().toLowerCase()
  const existing = await User.findOne({ email: normalizedEmail })
  if (existing) {
    throw new ApiError(400, "User with this email already exists")
  }

  const newRole = normalizeTeamMemberStoredRole(role)
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    // Will be hashed by User pre-save hook
    password: "welcome123",
    role: newRole,
    permissions: getDefaultPermissions(newRole),
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
      permissions: permissionsToJSON(getEffectivePermissions(user)),
    },
  })
})

export const updateTeamMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.params.userId
  const existing = await User.findById(userId)
  if (!existing) throw new ApiError(404, "User not found")

  const { role, status, permissions: bodyPermissions } = req.body as {
    role?: string
    status?: string
    permissions?: unknown
  }
  const update: Record<string, unknown> = {}

  if (role !== undefined) {
    const newRole = normalizeTeamMemberStoredRole(role)
    const prevCanonical = normalizeRole(existing.role)
    update.role = newRole
    if (normalizeRole(newRole) !== prevCanonical && bodyPermissions === undefined) {
      update.permissions = getDefaultPermissions(newRole)
    }
  }
  if (status === "active" || status === "inactive") update.isActive = status === "active"

  if (bodyPermissions !== undefined) {
    const patch = sanitizePermissionsPatch(bodyPermissions)
    if (patch) {
      const cur = (existing.toObject() as { permissions?: Record<string, { read?: boolean; write?: boolean }> })
        .permissions
      update.permissions = { ...(cur ?? {}), ...patch }
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true }
  ).select("name email role isActive permissions")
  if (!user) throw new ApiError(404, "User not found")

  if (Object.keys(update).length > 0) {
    logAudit({
      userId: req.auth!.userId,
      action: "PERMISSION_CHANGE",
      module: "settings",
      entityId: user._id,
      before: {
        role: existing.role,
        status: existing.isActive !== false ? "active" : "inactive",
        permissions: permissionsToJSON(getEffectivePermissions(existing)),
      },
      after: {
        role: user.role,
        status: (user as { isActive?: boolean }).isActive !== false ? "active" : "inactive",
        permissions: permissionsToJSON(getEffectivePermissions(user)),
      },
      req,
    })
  }

  res.json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: (user as { isActive?: boolean }).isActive !== false ? "active" : "inactive",
      permissions: permissionsToJSON(getEffectivePermissions(user)),
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
  const data = await getInfrastructureMap()
  res.json({ success: true, data })
})

export const saveInfrastructure = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as Record<
    string,
    { minCost?: number; maxCost?: number; roiMonths?: number; minCostPerAcre?: number; maxCostPerAcre?: number }
  >
  let didPersist = false
  for (const kind of INFRA_KINDS) {
    const parsed = parseInfraRow(body[kind])
    if (!parsed) continue
    didPersist = true
    await Infrastructure.findOneAndUpdate(
      { type: kind },
      {
        type: kind,
        minCost: parsed.minCost,
        maxCost: parsed.maxCost,
        roiMonths: parsed.roiMonths,
      },
      { upsert: true, new: true, runValidators: true }
    )
  }
  if (didPersist) await bumpInfrastructureConfigVersion()
  const data = await getInfrastructureMap()
  res.json({ success: true, data })
})
