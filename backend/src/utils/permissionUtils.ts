import type { IUser } from "../models/User"
import { normalizeRole } from "../middleware/roleMiddleware"

export const PERMISSION_MODULES = [
  "farms",
  "sites",
  "evaluations",
  "proposals",
  "reports",
  "finance",
  "settings",
] as const

export type PermissionModule = (typeof PERMISSION_MODULES)[number]

export type ModuleAccess = { read: boolean; write: boolean }

export type UserPermissions = Record<PermissionModule, ModuleAccess>

function fullAccess(): UserPermissions {
  const o = {} as UserPermissions
  for (const m of PERMISSION_MODULES) {
    o[m] = { read: true, write: true }
  }
  return o
}

/** Role-based defaults when `user.permissions` is absent or incomplete. */
export function getDefaultPermissions(role: string | undefined): UserPermissions {
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

export function getEffectivePermissions(user: IUser | { role?: string; permissions?: unknown }): UserPermissions {
  const defaults = getDefaultPermissions(user.role)
  const raw = (user as IUser).permissions as Partial<Record<PermissionModule, Partial<ModuleAccess>>> | undefined
  if (!raw || typeof raw !== "object") return defaults
  const out: UserPermissions = { ...defaults }
  for (const m of PERMISSION_MODULES) {
    const patch = raw[m]
    if (patch && typeof patch === "object") {
      out[m] = {
        read: patch.read === true,
        write: patch.write === true,
      }
    }
  }
  return out
}

export function isAdminUser(user: IUser | undefined | null): boolean {
  return normalizeRole(user?.role) === "admin"
}

export function hasModulePermission(
  user: IUser | undefined | null,
  module: PermissionModule,
  action: "read" | "write"
): boolean {
  if (!user) return false
  if (isAdminUser(user)) return true
  const p = getEffectivePermissions(user)[module]
  if (action === "read") return !!(p?.read || p?.write)
  return !!p?.write
}

/** When false, list/detail queries should be limited to the current user's own records (per module). */
export function needsOwnUserScope(user: IUser | undefined | null, module: PermissionModule): boolean {
  if (!user || isAdminUser(user)) return false
  return !getEffectivePermissions(user)[module]?.write
}

export function sanitizePermissionsPatch(raw: unknown): Partial<UserPermissions> | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const out: Partial<UserPermissions> = {}
  for (const m of PERMISSION_MODULES) {
    const v = (raw as Record<string, unknown>)[m]
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>
      out[m] = {
        read: o.read === true,
        write: o.write === true,
      }
    }
  }
  return Object.keys(out).length ? out : undefined
}

export function permissionsToJSON(perms: UserPermissions): UserPermissions {
  const o = {} as UserPermissions
  for (const m of PERMISSION_MODULES) {
    o[m] = { ...perms[m] }
  }
  return o
}
