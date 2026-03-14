import { Response, NextFunction } from "express"
import { User } from "../models/User"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"
import { signToken } from "../services/tokenService"

function nameToFirstLast(name: string): { firstName: string; lastName: string } {
  const parts = (name || "").trim().split(/\s+/)
  const firstName = parts[0] ?? "User"
  const lastName = parts.slice(1).join(" ") ?? ""
  return { firstName, lastName }
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
  const existing = await User.findOne({ email: String(email).toLowerCase().trim() })
  if (existing) {
    throw new ApiError(400, "Email already registered")
  }
  const user = await User.create({
    email: String(email).toLowerCase().trim(),
    password: String(password),
    name: fullName.trim(),
    role: role === "admin" ? "admin" : "user",
  })
  const token = signToken({ userId: user._id.toString(), email: user.email, role: user.role })
  const { firstName: fn, lastName: ln } = nameToFirstLast(user.name)
  res.status(201).json({
    success: true,
    data: {
      token,
      user: { id: user._id, email: user.email, firstName: fn, lastName: ln, role: user.role },
    },
  })
})

export const login = asyncHandler(async (req, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required")
  }
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+password")
  if (!user || !(await user.comparePassword(String(password)))) {
    throw new ApiError(401, "Invalid email or password")
  }
  const token = signToken({ userId: user._id.toString(), email: user.email, role: user.role })
  const { firstName, lastName } = nameToFirstLast(user.name)
  res.json({
    success: true,
    data: {
      token,
      user: { id: user._id, email: user.email, firstName, lastName, role: user.role },
    },
  })
})

export const me = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  const { firstName, lastName } = nameToFirstLast(user.name)
  res.json({
    success: true,
    data: {
      user: { id: user._id, email: user.email, firstName, lastName, name: user.name, role: user.role },
    },
  })
})
