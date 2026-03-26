import { Response } from "express"
import mongoose from "mongoose"
import { UserRequest } from "../models/UserRequest"
import { User } from "../models/User"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import type { AuthenticatedRequest } from "../middleware/auth"
import {
  getDefaultPermissions,
  PERMISSION_MODULES,
  sanitizePermissionsPatch,
  permissionsToJSON,
  getEffectivePermissions,
  type UserPermissions,
} from "../utils/permissionUtils"
import { logAudit } from "../utils/auditLogger"

function normalizeIncomingRole(role: string | undefined): "admin" | "editor" | "viewer" {
  const r = (role ?? "").toString().trim().toLowerCase()
  if (r === "sales director") return "admin"
  if (r === "field evaluator") return "editor"
  if (r === "sales associate") return "viewer"
  if (r === "field_evaluator") return "editor"
  if (r === "sales_associate") return "viewer"
  if (r === "user") return "viewer"
  if (r === "admin") return "admin"
  if (r === "editor") return "editor"
  if (r === "viewer") return "viewer"
  return "viewer"
}

function buildUserPermissions(role: string, bodyPermissions: unknown): UserPermissions {
  const defaults = getDefaultPermissions(role)
  const patch = sanitizePermissionsPatch(bodyPermissions)
  if (!patch) return defaults
  const out: UserPermissions = { ...defaults }
  for (const m of PERMISSION_MODULES) {
    if (patch[m]) {
      out[m] = {
        read: patch[m]!.read === true,
        write: patch[m]!.write === true,
      }
    }
  }
  return out
}

export const listPendingUserRequests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const rows = await UserRequest.find({ status: "pending" })
    .select("name email requestedRole status createdAt")
    .sort({ createdAt: -1 })
    .lean()
  res.json({
    success: true,
    data: rows.map((r) => ({
      _id: r._id,
      name: r.name,
      email: r.email,
      requestedRole: r.requestedRole ?? null,
      status: r.status,
      createdAt: r.createdAt,
    })),
  })
})

export const approveUserRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.auth?.userId
  if (!adminId) throw new ApiError(401, "Authentication required")

  const { id } = req.params
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid request id")

  const { role, permissions: bodyPermissions } = req.body as {
    role?: string
    permissions?: unknown
  }
  const newRole = normalizeIncomingRole(role)

  const requestDoc = await UserRequest.findById(id).select("+password")
  if (!requestDoc) throw new ApiError(404, "Request not found")
  if (requestDoc.status !== "pending") {
    throw new ApiError(400, "This request has already been processed")
  }

  const email = requestDoc.email
  const existingUser = await User.findOne({ email })
  if (existingUser) {
    throw new ApiError(400, "A user with this email already exists")
  }

  const permissions = buildUserPermissions(newRole, bodyPermissions)
  const hashedPassword = requestDoc.password

  const user = await User.create({
    name: requestDoc.name,
    email,
    password: hashedPassword,
    role: newRole,
    permissions,
    isActive: true,
  })

  requestDoc.status = "approved"
  await requestDoc.save()

  logAudit({
    userId: adminId,
    action: "USER_APPROVED",
    module: "settings",
    entityId: requestDoc._id,
    after: {
      email,
      userId: String(user._id),
      role: newRole,
    },
    req,
  })

  res.status(201).json({
    success: true,
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: "active" as const,
        permissions: permissionsToJSON(getEffectivePermissions(user)),
      },
    },
  })
})

export const rejectUserRequest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.auth?.userId
  if (!adminId) throw new ApiError(401, "Authentication required")

  const { id } = req.params
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid request id")

  const requestDoc = await UserRequest.findById(id)
  if (!requestDoc) throw new ApiError(404, "Request not found")
  if (requestDoc.status !== "pending") {
    throw new ApiError(400, "This request has already been processed")
  }

  const email = requestDoc.email
  requestDoc.status = "rejected"
  await requestDoc.save()

  logAudit({
    userId: adminId,
    action: "USER_REJECTED",
    module: "settings",
    entityId: requestDoc._id,
    after: { email },
    req,
  })

  res.json({ success: true, data: { message: "Request rejected" } })
})
