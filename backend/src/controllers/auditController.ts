import { Response } from "express"
import mongoose from "mongoose"
import { AuditLog } from "../models/AuditLog"
import { asyncHandler } from "../utils/asyncHandler"
import { AuthenticatedRequest } from "../middleware/auth"
import { ApiError } from "../utils/ApiError"

export const listAuditLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { module, userId, from, to, limit } = req.query as {
    module?: string
    userId?: string
    from?: string
    to?: string
    limit?: string
  }

  const filter: Record<string, unknown> = {}
  if (module && typeof module === "string") {
    const allowed = ["farms", "sites", "evaluations", "proposals", "reports", "settings", "auth"]
    if (!allowed.includes(module)) {
      throw new ApiError(400, "Invalid module filter")
    }
    filter.module = module
  }
  if (userId && typeof userId === "string") {
    try {
      filter.userId = new mongoose.Types.ObjectId(userId)
    } catch {
      throw new ApiError(400, "Invalid userId")
    }
  }
  if (from || to) {
    const range: { $gte?: Date; $lte?: Date } = {}
    if (from) {
      const d = new Date(from)
      if (Number.isNaN(d.getTime())) throw new ApiError(400, "Invalid from date")
      range.$gte = d
    }
    if (to) {
      const d = new Date(to)
      if (Number.isNaN(d.getTime())) throw new ApiError(400, "Invalid to date")
      range.$lte = d
    }
    filter.createdAt = range
  }

  const lim = Math.min(500, Math.max(1, parseInt(String(limit ?? "100"), 10) || 100))

  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(lim)
    .populate("userId", "name email")
    .lean()

  const data = logs.map((row) => {
    const u = row.userId as { _id?: unknown; name?: string; email?: string } | null
    return {
      _id: row._id,
      userId: u?._id ?? row.userId,
      userName: u?.name ?? null,
      userEmail: u?.email ?? null,
      action: row.action,
      module: row.module,
      entityId: row.entityId ?? null,
      before: row.before ?? null,
      after: row.after ?? null,
      ipAddress: row.ipAddress ?? null,
      createdAt: row.createdAt,
    }
  })

  res.json({ success: true, data })
})
