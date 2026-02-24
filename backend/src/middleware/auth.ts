import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { ApiError } from "../utils/ApiError"
import { env } from "../config/env"
import { User, IUser } from "../models/User"

export interface AuthPayload {
  userId: string
  email: string
  role: string
}

export interface AuthenticatedRequest extends Request {
  user?: IUser
  auth?: AuthPayload
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!token) {
      throw new ApiError(401, "Authentication required")
    }
    const decoded = jwt.verify(token, env.jwtSecret) as AuthPayload
    const user = await User.findById(decoded.userId)
    if (!user) {
      throw new ApiError(401, "User not found")
    }
    req.auth = decoded
    req.user = user
    next()
  } catch (err) {
    if (err instanceof ApiError) next(err)
    else if (err instanceof jwt.JsonWebTokenError) next(new ApiError(401, "Invalid token"))
    else next(err)
  }
}
