import { Router } from "express"
import { authMiddleware as authenticateToken } from "../middleware/auth"
import type { AuthenticatedRequest } from "../middleware/auth"
import { checkPermission } from "../middleware/permissionMiddleware"
import { needsOwnUserScope } from "../utils/permissionUtils"
import { Site } from "../models/Site"
import { Farm } from "../models/Farm"

const router = Router()

// POST / — create site
router.post("/", authenticateToken, checkPermission("sites", "write"), async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest
    const userId = authReq.auth!.userId
    const { farmId, name, geojson, area, perimeter, slope, notes } = req.body
    const site = await Site.create({
      farmId,
      name,
      geojson,
      area,
      perimeter,
      slope,
      notes,
      createdBy: userId,
    })
    return res.json({ success: true, data: { ...site.toObject(), id: site._id } })
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

// GET /:siteId — get single site by ID
router.get("/:siteId", authenticateToken, checkPermission("sites", "read"), async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest
    const uid = String(authReq.auth!.userId)
    const site = await Site.findById(req.params.siteId)
    if (!site) {
      return res.status(404).json({ success: false, error: "Site not found" })
    }
    if (needsOwnUserScope(authReq.user, "sites")) {
      const s = site.toObject() as { createdBy?: unknown; farmId?: unknown }
      let allowed = false
      if (s.createdBy && String(s.createdBy) === uid) allowed = true
      else if (s.farmId) {
        const farm = await Farm.findById(s.farmId).lean()
        if (farm && String((farm as { userId?: unknown }).userId) === uid) allowed = true
      }
      if (!allowed) {
        return res.status(403).json({ success: false, error: "Forbidden" })
      }
    }
    return res.json({ success: true, data: site })
  } catch (err: any) {
    console.error("GET /api/sites/:siteId error:", err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

// PATCH /:siteId — update site name/notes/status
router.patch("/:siteId", authenticateToken, checkPermission("sites", "write"), async (req, res) => {
  try {
    const { name, notes, status } = req.body as {
      name?: string
      notes?: string
      status?: string
    }
    const update: Record<string, unknown> = {}
    if (name !== undefined) update.name = name
    if (notes !== undefined) update.notes = notes
    if (status !== undefined) update.status = status
    const site = await Site.findByIdAndUpdate(req.params.siteId, { $set: update }, { new: true })
    return res.json({ success: true, data: site })
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /:siteId — delete site
router.delete("/:siteId", authenticateToken, checkPermission("sites", "write"), async (req, res) => {
  try {
    await Site.findByIdAndDelete(req.params.siteId)
    return res.json({ success: true, data: true })
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router
