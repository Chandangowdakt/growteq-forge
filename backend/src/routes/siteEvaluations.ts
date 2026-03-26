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
import { checkPermission } from "../middleware/permissionMiddleware"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", checkPermission("evaluations", "read"), listSiteEvaluations)
router.post("/", checkPermission("evaluations", "write"), createSiteEvaluation)
router.get("/:id", checkPermission("evaluations", "read"), getSiteEvaluation)
router.patch("/:id/status", checkPermission("evaluations", "write"), updateStatus)
router.patch("/:id", checkPermission("evaluations", "write"), updateSiteEvaluation)
router.delete("/:id", checkPermission("evaluations", "write"), deleteSiteEvaluation)

export default router
