import { Response, NextFunction } from "express"
import { User } from "../models/User"
import { ApiError } from "../utils/ApiError"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"
import { signToken } from "../services/tokenService"

export const register = asyncHandler(async (req, res: Response, next: NextFunction) => {
  const { email, password, name, role } = req.body
  if (!email || !password || !name) {
    throw new ApiError(400, "Email, password and name are required")
  }
  const existing = await User.findOne({ email })
  if (existing) {
    throw new ApiError(400, "Email already registered")
  }
  const user = await User.create({ email, password, name, role: role ?? "user" })
  const token = signToken({ userId: user._id.toString(), email: user.email, role: user.role })
  res.status(201).json({
    success: true,
    data: {
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      token,
    },
  })
})

export const login = asyncHandler(async (req, res: Response) => {
  const { email, password } = req.body
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required")
  }
  const user = await User.findOne({ email }).select("+password")
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password")
  }
  const token = signToken({ userId: user._id.toString(), email: user.email, role: user.role })
  res.json({
    success: true,
    data: {
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
      token,
    },
  })
})

export const me = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!
  res.json({
    success: true,
    data: { user: { id: user._id, email: user.email, name: user.name, role: user.role } },
  })
})
