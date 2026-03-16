import { Request, Response, NextFunction } from "express"

export const requireRole =
  (...roles: string[]) =>
  (req: any, res: Response, next: NextFunction) => {
    const userRole = req.user?.role
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Insufficient permissions.",
      })
    }
    next()
  }

