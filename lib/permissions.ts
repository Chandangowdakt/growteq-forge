export const PERMISSIONS = {
  canCreateSite: ["admin", "field_evaluator"] as const,
  canDeleteSite: ["admin"] as const,
  canCreateFarm: ["admin", "field_evaluator"] as const,
  canDeleteFarm: ["admin"] as const,
  canApproveEvaluation: ["admin"] as const,
  canManageTeam: ["admin"] as const,
  canViewReports: ["admin", "field_evaluator", "sales_associate"] as const,
  canGenerateProposal: ["admin", "field_evaluator"] as const,
} as const

export function hasPermission(
  userRole: string | undefined,
  permission: keyof typeof PERMISSIONS
): boolean {
  if (!userRole) return false
  return (PERMISSIONS[permission] as readonly string[]).includes(userRole)
}

export function getUserRole(): string {
  if (typeof window === "undefined") return "sales_associate"
  try {
    const raw = window.localStorage.getItem("forge_user")
    if (!raw) return "sales_associate"
    const user = JSON.parse(raw) as { role?: string }
    return user.role || "sales_associate"
  } catch {
    return "sales_associate"
  }
}

