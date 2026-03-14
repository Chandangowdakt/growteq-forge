import { Router, type IRouter } from "express"
import { Site } from "../models/Site"
import {
  updateSiteEvaluation,
  deleteSiteEvaluation,
  getSiteDetails,
  getSiteBoundary,
  getSiteGeojsonExport,
} from "../controllers/siteEvaluationController"
import { authMiddleware } from "../middleware/auth"

const router: IRouter = Router()

router.use(authMiddleware)

router.post("/", async (req, res, next) => {
  try {
    const { farmId, name, geojson, area, perimeter, slope, notes } = req.body as {
      farmId?: unknown
      name?: unknown
      geojson?: unknown
      area?: unknown
      perimeter?: unknown
      slope?: unknown
      notes?: unknown
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "name is required" })
    }

    if (typeof geojson !== "object" || geojson === null) {
      return res.status(400).json({ success: false, message: "geojson is required" })
    }

    if (typeof area !== "number" || !Number.isFinite(area)) {
      return res.status(400).json({ success: false, message: "area must be a number" })
    }

    if (typeof perimeter !== "number" || !Number.isFinite(perimeter)) {
      return res.status(400).json({ success: false, message: "perimeter must be a number" })
    }

    const createdSite = await Site.create({
      name: name.trim(),
      geojson,
      area,
      perimeter,
      ...(farmId != null && { farmId }),
      ...(typeof slope === "number" && Number.isFinite(slope) && { slope }),
      ...(typeof notes === "string" && { notes: notes.trim() }),
    })

    const data = createdSite.toObject()
    return res.status(201).json({
      success: true,
      data: { ...data, id: createdSite._id },
    })
  } catch (err) {
    next(err)
  }
})

router.put("/:id", updateSiteEvaluation)
router.delete("/:id", deleteSiteEvaluation)
router.get("/:siteId/details", getSiteDetails)
router.get("/:siteId/boundary", getSiteBoundary)
router.get("/:siteId/export", getSiteGeojsonExport)

export default router

