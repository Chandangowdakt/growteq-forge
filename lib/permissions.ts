import type { AuthUser, UserPermissionsMap } from "@/lib/api"

export type PermissionModule = keyof UserPermissionsMap

/** Stable module order for settings UI and merges. */
export const PERMISSION_MODULES: PermissionModule[] = [
  "farms",
  "sites",
  "evaluations",
  "proposals",
  "reports",
  "finance",
  "settings",
]

function fullAccess(): UserPermissionsMap {
  const o = {} as UserPermissionsMap
  for (const m of PERMISSION_MODULES) {
    o[m] = { read: true, write: true }
  }
  return o
}

/** Mirrors backend `getDefaultPermissions` — keep in sync. */
export function getDefaultPermissions(role: string | undefined): UserPermissionsMap {
  const r = normalizeRole(role)
  if (r === "admin") return fullAccess()
  if (r === "editor") {
    return {
      farms: { read: true, write: true },
      sites: { read: true, write: true },
      evaluations: { read: true, write: true },
      proposals: { read: true, write: true },
      reports: { read: true, write: false },
      finance: { read: false, write: false },
      settings: { read: false, write: false },
    }
  }
  return {
    farms: { read: true, write: false },
    sites: { read: true, write: false },
    evaluations: { read: true, write: false },
    proposals: { read: true, write: false },
    reports: { read: true, write: false },
    finance: { read: false, write: false },
    settings: { read: false, write: false },
  }
}

export function normalizeRole(role: string | undefined): "admin" | "editor" | "viewer" {
  const r = (role ?? "").toString().trim().toLowerCase()
  if (r === "admin") return "admin"
  if (r === "editor") return "editor"
  if (r === "viewer") return "viewer"
  if (r === "field_evaluator") return "editor"
  if (r === "sales_associate") return "viewer"
  if (r === "user") return "viewer"
  if (r === "sales director") return "admin"
  if (r === "field evaluator") return "editor"
  if (r === "sales associate") return "viewer"
  return "viewer"
}

/** Merge stored team member permissions with role defaults (no undefined modules). */
export function mergeMemberPermissions(member: {
  role?: string
  permissions?: Partial<UserPermissionsMap> | null
}): UserPermissionsMap {
  const defaults = getDefaultPermissions(member.role)
  const raw = member.permissions
  if (!raw || typeof raw !== "object") return defaults
  const out: UserPermissionsMap = { ...defaults }
  for (const m of PERMISSION_MODULES) {
    const p = raw[m]
    if (p && typeof p === "object") {
      out[m] = { read: p.read === true, write: p.write === true }
    }
  }
  return out
}

/** Enforce write ⇒ read and read off ⇒ write off for API submit. */
export function normalizePermissionsForSubmit(p: UserPermissionsMap): UserPermissionsMap {
  const out = {} as UserPermissionsMap
  for (const m of PERMISSION_MODULES) {
    const row = p[m] ?? { read: false, write: false }
    let read = row.read === true
    let write = row.write === true
    if (write && !read) read = true
    if (!read) write = false
    out[m] = { read, write }
  }
  return out
}

export function resolvePermissions(
  user: Pick<AuthUser, "role" | "permissions"> | null | undefined
): UserPermissionsMap {
  if (!user) return getDefaultPermissions(undefined)
  const defaults = getDefaultPermissions(user.role)
  const raw = user.permissions
  if (!raw || typeof raw !== "object") return defaults
  const out: UserPermissionsMap = { ...defaults }
  for (const m of PERMISSION_MODULES) {
    const p = (raw as UserPermissionsMap)[m]
    if (p && typeof p === "object") {
      out[m] = { read: p.read === true, write: p.write === true }
    }
  }
  return out
}

export function isAdminRole(role: string | undefined): boolean {
  return normalizeRole(role) === "admin"
}

export function canReadModule(
  user: Pick<AuthUser, "role" | "permissions"> | null | undefined,
  module: PermissionModule
): boolean {
  if (isAdminRole(user?.role)) return true
  const p = resolvePermissions(user)[module]
  return !!(p?.read || p?.write)
}

export function canWriteModule(
  user: Pick<AuthUser, "role" | "permissions"> | null | undefined,
  module: PermissionModule
): boolean {
  if (isAdminRole(user?.role)) return true
  return !!resolvePermissions(user)[module]?.write
}

/** Explicit read/write check per module (admin always allowed). */
export function hasModulePermission(
  user: Pick<AuthUser, "role" | "permissions"> | null | undefined,
  module: PermissionModule,
  action: "read" | "write"
): boolean {
  return action === "read" ? canReadModule(user, module) : canWriteModule(user, module)
}

const LEGACY_MAP = {
  canCreateFarm: { module: "farms" as const, action: "write" as const },
  canDeleteFarm: { module: "farms" as const, action: "write" as const },
  canCreateSite: { module: "sites" as const, action: "write" as const },
  canDeleteSite: { module: "sites" as const, action: "write" as const },
  canApproveEvaluation: { module: "evaluations" as const, action: "write" as const },
  canManageTeam: { module: "settings" as const, action: "write" as const },
  canViewReports: { module: "reports" as const, action: "read" as const },
  canGenerateProposal: { module: "proposals" as const, action: "write" as const },
  canGenerateReports: { module: "reports" as const, action: "write" as const },
} as const

export type LegacyPermissionKey = keyof typeof LEGACY_MAP

/** Use `user` from `useAuth()` so DB permissions apply. */
export function hasPermission(
  user: Pick<AuthUser, "role" | "permissions"> | null | undefined,
  permission: LegacyPermissionKey
): boolean {
  const { module, action } = LEGACY_MAP[permission]
  return action === "read" ? canReadModule(user, module) : canWriteModule(user, module)
}

export function getUserRole(): string {
  if (typeof window === "undefined") return "viewer"
  try {
    const raw = window.localStorage.getItem("forge_user")
    if (!raw) return "viewer"
    const u = JSON.parse(raw) as { role?: string }
    return normalizeRole(u.role)
  } catch {
    return "viewer"
  }
}

/** @deprecated Prefer `hasPermission(user, key)` with auth user */
export const PERMISSIONS = {
  canCreateSite: ["admin", "editor"] as const,
  canDeleteSite: ["admin"] as const,
  canCreateFarm: ["admin", "editor"] as const,
  canDeleteFarm: ["admin"] as const,
  canApproveEvaluation: ["admin"] as const,
  canManageTeam: ["admin"] as const,
  canViewReports: ["admin", "editor", "viewer"] as const,
  canGenerateProposal: ["admin", "editor"] as const,
  canGenerateReports: ["admin"] as const,
} as const
