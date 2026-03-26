import crypto from "crypto"
import type { Request, Response } from "express"
import { Invite } from "../models/Invite"
import { User } from "../models/User"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import type { AuthenticatedRequest } from "../middleware/auth"
import {
  getDefaultPermissions,
  PERMISSION_MODULES,
  sanitizePermissionsPatch,
  type UserPermissions,
} from "../utils/permissionUtils"
import { logAudit } from "../utils/auditLogger"
import { sendInviteEmail } from "../services/emailService"
import { env } from "../config/env"

const INVITE_TTL_MS = 24 * 60 * 60 * 1000

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

function buildInvitePermissions(role: string, bodyPermissions: unknown): UserPermissions {
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

export const createInvite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.auth?.userId
  if (!adminId) throw new ApiError(401, "Authentication required")

  const { email, role, permissions: bodyPermissions } = req.body as {
    email?: string
    role?: string
    permissions?: unknown
  }
  if (!email?.trim()) throw new ApiError(400, "email is required")

  const normalizedEmail = email.trim().toLowerCase()
  const newRole = normalizeIncomingRole(role)
  const storedPermissions = buildInvitePermissions(newRole, bodyPermissions)

  const existingUser = await User.findOne({ email: normalizedEmail })
  if (existingUser) {
    throw new ApiError(400, "User with this email already exists")
  }

  const now = new Date()
  const pending = await Invite.findOne({
    email: normalizedEmail,
    accepted: false,
    expiresAt: { $gt: now },
  })
  if (pending) {
    throw new ApiError(400, "An invite is already pending for this email")
  }

  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  const invite = await Invite.create({
    email: normalizedEmail,
    role: newRole,
    permissions: storedPermissions,
    invitedBy: adminId,
    token,
    expiresAt,
    accepted: false,
  })

  const inviteUrl = `${env.frontendUrl.replace(/\/$/, "")}/invite/${token}`

  try {
    await sendInviteEmail(normalizedEmail, inviteUrl)
  } catch (e) {
    console.error("[invite] email send failed", e)
    await Invite.deleteOne({ _id: invite._id })
    throw new ApiError(502, "Failed to send invite email")
  }

  logAudit({
    userId: adminId,
    action: "INVITE_SENT",
    module: "settings",
    entityId: invite._id,
    after: { email: normalizedEmail, role: newRole },
    req,
  })

  res.status(201).json({
    success: true,
    data: {
      email: normalizedEmail,
      role: newRole,
      expiresAt: invite.expiresAt.toISOString(),
    },
  })
})

export const acceptInvite = asyncHandler(async (req: Request, res: Response) => {
  const { token, name, password } = req.body as {
    token?: string
    name?: string
    password?: string
  }
  if (!token?.trim()) throw new ApiError(400, "token is required")
  if (!name?.trim()) throw new ApiError(400, "name is required")
  if (!password || password.length < 6) {
    throw new ApiError(400, "password must be at least 6 characters")
  }

  const invite = await Invite.findOne({ token: token.trim() })
  if (!invite) {
    throw new ApiError(400, "Invalid invite link")
  }
  if (invite.accepted) {
    throw new ApiError(400, "This invite has already been accepted")
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(400, "This invite has expired")
  }

  const normalizedEmail = invite.email
  const dup = await User.findOne({ email: normalizedEmail })
  if (dup) {
    throw new ApiError(400, "User with this email already exists")
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    role: invite.role as "admin" | "editor" | "viewer",
    permissions: (invite.permissions as Partial<UserPermissions> | undefined) ?? getDefaultPermissions(invite.role),
    isActive: true,
  })

  const inviteId = invite._id
  await Invite.updateOne(
    { _id: inviteId },
    { $set: { accepted: true }, $unset: { token: "" } }
  )

  logAudit({
    userId: user._id,
    action: "INVITE_ACCEPTED",
    module: "settings",
    entityId: inviteId,
    after: { email: normalizedEmail, userId: String(user._id) },
    req,
  })

  res.status(201).json({
    success: true,
    data: {
      message: "Account created. You can sign in now.",
      email: user.email,
    },
  })
})
