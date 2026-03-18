import { Router } from "express"
import { authMiddleware as authenticateToken } from "../middleware/auth"
import { Site } from "../models/Site"

const router = Router()

// POST / — create site
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { farmId, name, geojson, area, perimeter, slope, notes } = req.body
    const site = await Site.create({ farmId, name, geojson, area, perimeter, slope, notes })
    return res.json({ success: true, data: { ...site.toObject(), id: site._id } })
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

// GET /:siteId — get single site by ID
router.get("/:siteId", authenticateToken, async (req, res) => {
  try {
    const site = await Site.findById(req.params.siteId)
    if (!site) {
      return res.status(404).json({ success: false, error: "Site not found" })
    }
    return res.json({ success: true, data: site })
  } catch (err: any) {
    console.error("GET /api/sites/:siteId error:", err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

// PATCH /:siteId — update site name/notes/status
router.patch("/:siteId", authenticateToken, async (req, res) => {
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
    const site = await Site.findByIdAndUpdate(
      req.params.siteId,
      { $set: update },
      { new: true }
    )
    return res.json({ success: true, data: site })
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

// DELETE /:siteId — delete site
router.delete("/:siteId", authenticateToken, async (req, res) => {
  try {
    await Site.findByIdAndDelete(req.params.siteId)
    return res.json({ success: true, data: true })
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

export default router

