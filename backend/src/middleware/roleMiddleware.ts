import { Response, NextFunction } from "express"

/** Maps legacy roles to canonical RBAC roles before permission checks. */
export function normalizeRole(role: string | undefined): "admin" | "editor" | "viewer" {
  const r = (role ?? "").toString().trim().toLowerCase()
  if (r === "admin") return "admin"
  if (r === "editor" || r === "field_evaluator") return "editor"
  return "viewer"
}

export const authorizeRoles =
  (...allowedRoles: string[]) =>
  (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" })
    }

    const effectiveRole = normalizeRole(req.user.role)
    const allowed = new Set(allowedRoles.map((r) => normalizeRole(r)))
    if (!allowed.has(effectiveRole)) {
      return res.status(403).json({ success: false, error: "Forbidden" })
    }

    next()
  }

// Backwards-compatible alias used by existing routes
export const requireRole = authorizeRoles

