import { Response, NextFunction } from "express"
import { AuthenticatedRequest } from "./auth"
import {
  type PermissionModule,
  getEffectivePermissions,
  isAdminUser,
} from "../utils/permissionUtils"

export function checkPermission(module: PermissionModule, action: "read" | "write") {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Unauthorized" })
      return
    }

    if (isAdminUser(req.user)) {
      next()
      return
    }

    const perms = getEffectivePermissions(req.user)
    const m = perms[module]
    if (!m) {
      res.status(403).json({ success: false, error: "No permissions" })
      return
    }

    const allowed =
      action === "read" ? m.read === true || m.write === true : m.write === true
    if (!allowed) {
      res.status(403).json({ success: false, error: "Permission denied" })
      return
    }

    next()
  }
}
