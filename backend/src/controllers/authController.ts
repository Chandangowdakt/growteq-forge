import { Response, NextFunction, Request } from "express"
import { User } from "../models/User"
import { UserRequest } from "../models/UserRequest"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"
import { signToken } from "../services/tokenService"
import { getEffectivePermissions, permissionsToJSON } from "../utils/permissionUtils"
import { logAudit } from "../utils/auditLogger"

function nameToFirstLast(name: string): { firstName: string; lastName: string } {
  const parts = (name || "").trim().split(/\s+/)
  const firstName = parts[0] ?? "User"
  const lastName = parts.slice(1).join(" ") ?? ""
  return { firstName, lastName }
}

function normalizeRole(role: string | undefined): "admin" | "editor" | "viewer" {
  const r = (role ?? "").toString().trim().toLowerCase()
  if (r === "admin") return "admin"
  if (r === "editor") return "editor"
  if (r === "viewer") return "viewer"
  // Legacy roles
  if (r === "field_evaluator") return "editor"
  if (r === "sales_associate") return "viewer"
  if (r === "user") return "viewer"
  // UI labels
  if (r === "sales director") return "admin"
  if (r === "field evaluator") return "editor"
  if (r === "sales associate") return "viewer"
  return "viewer"
}

export const register = asyncHandler(async (req, res: Response, _next: NextFunction) => {
  const { email, password, firstName, lastName, name, role } = req.body as {
    email?: string
    password?: string
    firstName?: string
    lastName?: string
    name?: string
    role?: string
  }
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || name
  if (!email || !password || !fullName?.trim()) {
    throw new ApiError(400, "Email, password and name (or firstName + lastName) are required")
  }
  const normalizedEmail = String(email).toLowerCase().trim()
  const existingUser = await User.findOne({ email: normalizedEmail })
  if (existingUser) {
    throw new ApiError(400, "Email already registered")
  }

  const existingReq = await UserRequest.findOne({ email: normalizedEmail })
  if (existingReq?.status === "pending") {
    throw new ApiError(400, "A registration request is already pending for this email")
  }
  if (existingReq?.status === "approved") {
    throw new ApiError(400, "This email is already associated with an approved request")
  }

  const normalizedRole = normalizeRole(role)
  const requestedRoleLabel = role?.toString().trim() || normalizedRole

  let requestDoc: InstanceType<typeof UserRequest>
  if (existingReq?.status === "rejected") {
    existingReq.name = fullName.trim()
    existingReq.password = String(password)
    existingReq.requestedRole = requestedRoleLabel
    existingReq.status = "pending"
    await existingReq.save()
    requestDoc = existingReq
  } else {
    requestDoc = await UserRequest.create({
      email: normalizedEmail,
      password: String(password),
      name: fullName.trim(),
      requestedRole: requestedRoleLabel,
      status: "pending",
    })
  }

  logAudit({
    action: "USER_REQUEST_CREATED",
    module: "auth",
    entityId: requestDoc._id,
    after: { email: normalizedEmail, name: fullName.trim() },
    req,
  })

  res.status(202).json({
    success: true,
    message: "Request submitted. Await admin approval.",
    data: { submitted: true },
  })
})

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required")
  }
  const normalizedEmail = String(email).toLowerCase().trim()
  const user = await User.findOne({ email: normalizedEmail }).select("+password")
  if (user) {
    if (!(await user.comparePassword(String(password)))) {
      throw new ApiError(401, "Invalid email or password")
    }
  } else {
    const regReq = await UserRequest.findOne({ email: normalizedEmail }).select("+password")
    if (regReq && (await regReq.comparePassword(String(password)))) {
      if (regReq.status === "pending") {
        throw new ApiError(403, "Your account is not approved yet")
      }
      if (regReq.status === "rejected") {
        throw new ApiError(403, "Your registration request was not approved")
      }
    }
    if (!user) {
      throw new ApiError(401, "Invalid email or password")
    }
  }
  logAudit({
    userId: user._id,
    action: "LOGIN",
    module: "auth",
    entityId: user._id,
    after: { email: user.email, role: normalizeRole(user.role) },
    req,
  })
  const token = signToken({ userId: user._id.toString(), email: user.email, role: normalizeRole(user.role) })
  const { firstName, lastName } = nameToFirstLast(user.name)
  const permissions = permissionsToJSON(getEffectivePermissions(user))
  res.json({
    success: true,
    data: {
      token,
      user: { id: user._id, email: user.email, firstName, lastName, role: user.role, permissions },
    },
  })
})

export const me = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const { firstName, lastName } = nameToFirstLast(user.name)
  const permissions = permissionsToJSON(getEffectivePermissions(user))
  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName,
        lastName,
        name: user.name,
        role: user.role,
        permissions,
      },
    },
  })
})
