import { Response, NextFunction } from "express"
import { AuthenticatedRequest } from "./auth"
import { hasModulePermission, isAdminUser } from "../utils/permissionUtils"

/** Admin or Settings read can view audit logs. */
export function requireAuditLogAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Unauthorized" })
    return
  }
  if (isAdminUser(req.user) || hasModulePermission(req.user, "settings", "read")) {
    next()
    return
  }
  res.status(403).json({ success: false, error: "Forbidden" })
}
