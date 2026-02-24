import { Router, type IRouter } from "express"
import {
  listSiteEvaluations,
  createSiteEvaluation,
  getSiteEvaluation,
  updateSiteEvaluation,
  deleteSiteEvaluation,
} from "../controllers/siteEvaluationController"
import { authMiddleware } from "../middleware/auth"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", listSiteEvaluations)
router.post("/", createSiteEvaluation)
router.get("/:id", getSiteEvaluation)
router.patch("/:id", updateSiteEvaluation)
router.delete("/:id", deleteSiteEvaluation)

export default router
