import { Response, NextFunction } from "express"
import { ApiError } from "../utils/ApiError"
import { AuthenticatedRequest } from "./auth"
import { Role } from "../models/User"

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ApiError(401, "Authentication required"))
      return
    }
    if (!allowedRoles.includes(req.user.role as Role)) {
      next(new ApiError(403, "Insufficient permissions"))
      return
    }
    next()
  }
}
