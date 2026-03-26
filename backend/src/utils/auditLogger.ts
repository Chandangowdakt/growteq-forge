import type { Request } from "express"
import mongoose from "mongoose"
import { AuditLog, type AuditAction, type AuditModule } from "../models/AuditLog"

const REDACT_KEYS = new Set(
  [
    "password",
    "token",
    "authorization",
    "jwt",
    "secret",
    "refreshtoken",
    "accesstoken",
    "apikey",
    "api_key",
    "cookie",
    "set-cookie",
  ].map((k) => k.toLowerCase())
)

const MAX_DEPTH = 8

function isObjectIdLike(v: unknown): boolean {
  if (v == null || typeof v !== "object") return false
  const o = v as { constructor?: { name?: string }; _bsontype?: string }
  return o.constructor?.name === "ObjectId" || o._bsontype === "ObjectId"
}

/** Strip secrets and bound size for audit storage. */
export function sanitizeAuditSnapshot(value: unknown, depth = 0): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined
  const redacted = redactDeep(value, depth)
  if (redacted === undefined || (typeof redacted === "object" && redacted !== null && Object.keys(redacted as object).length === 0)) {
    return undefined
  }
  return typeof redacted === "object" && redacted !== null && !Array.isArray(redacted)
    ? (redacted as Record<string, unknown>)
    : { value: redacted as unknown }
}

function redactDeep(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return "[MaxDepth]"
  if (value === null || value === undefined) return value
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "bigint") return String(value)
  if (value instanceof Date) return value.toISOString()
  if (isObjectIdLike(value)) return String(value)
  if (Buffer.isBuffer(value)) return "[binary]"

  if (Array.isArray(value)) {
    return value.slice(0, 200).map((item) => redactDeep(item, depth + 1))
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (REDACT_KEYS.has(k.toLowerCase())) continue
      if (k === "__v") continue
      out[k] = redactDeep(v, depth + 1)
    }
    return out
  }

  return String(value)
}

export function getRequestIp(req?: Request): string | undefined {
  if (!req) return undefined
  const xf = req.headers["x-forwarded-for"]
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0]?.trim()
  if (Array.isArray(xf) && xf[0]) return xf[0].split(",")[0]?.trim()
  return req.ip || req.socket?.remoteAddress
}

export type LogAuditParams = {
  userId?: string | mongoose.Types.ObjectId
  organizationId?: string | mongoose.Types.ObjectId
  action: AuditAction
  module: AuditModule
  entityId?: string | mongoose.Types.ObjectId
  before?: unknown
  after?: unknown
  req?: Request
}

async function persistAudit(entry: LogAuditParams): Promise<void> {
  const userObjectId =
    entry.userId == null
      ? undefined
      : typeof entry.userId === "string"
        ? new mongoose.Types.ObjectId(entry.userId)
        : entry.userId
  const entityObjectId =
    entry.entityId == null
      ? undefined
      : typeof entry.entityId === "string"
        ? new mongoose.Types.ObjectId(entry.entityId)
        : entry.entityId
  const orgObjectId =
    entry.organizationId == null
      ? undefined
      : typeof entry.organizationId === "string"
        ? new mongoose.Types.ObjectId(entry.organizationId)
        : entry.organizationId

  await AuditLog.create({
    ...(userObjectId != null ? { userId: userObjectId } : {}),
    organizationId: orgObjectId,
    action: entry.action,
    module: entry.module,
    entityId: entityObjectId,
    before: sanitizeAuditSnapshot(entry.before),
    after: sanitizeAuditSnapshot(entry.after),
    ipAddress: getRequestIp(entry.req),
  })
}

/**
 * Non-blocking audit write; failures are logged only.
 * Uses setImmediate to avoid adding latency on the hot path.
 */
export function logAudit(entry: LogAuditParams): void {
  setImmediate(() => {
    void persistAudit(entry).catch((err) => {
      console.error("Audit log failed", err)
    })
  })
}
