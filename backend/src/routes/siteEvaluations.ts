import { Router, type IRouter } from "express"
import {
  listSiteEvaluations,
  createSiteEvaluation,
  getSiteEvaluation,
  updateSiteEvaluation,
  updateStatus,
  deleteSiteEvaluation,
} from "../controllers/siteEvaluationController"
import { authMiddleware } from "../middleware/auth"
import { requireRole } from "../middleware/roleMiddleware"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", listSiteEvaluations)
router.post("/", requireRole("admin", "field_evaluator"), createSiteEvaluation)
router.get("/:id", getSiteEvaluation)
router.patch("/:id/status", requireRole("admin", "field_evaluator"), updateStatus)
router.patch("/:id", updateSiteEvaluation)
router.delete("/:id", deleteSiteEvaluation)

export default router
