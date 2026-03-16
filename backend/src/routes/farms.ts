import { Router, type IRouter } from "express"
import {
  listFarms,
  createFarm,
  getFarm,
  updateFarm,
  deleteFarm,
  getFarmSites,
} from "../controllers/farmController"
import { authMiddleware } from "../middleware/auth"
import { requireRole } from "../middleware/roleMiddleware"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", listFarms)
router.post("/", requireRole("admin", "field_evaluator"), createFarm)
router.get("/:farmId/sites", getFarmSites)
router.get("/:farmId", getFarm)
router.put("/:farmId", updateFarm)
router.patch("/:farmId", updateFarm)
router.delete("/:farmId", requireRole("admin"), deleteFarm)

export default router
