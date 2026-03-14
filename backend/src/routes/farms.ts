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

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", listFarms)
router.post("/", createFarm)
router.get("/:farmId/sites", getFarmSites)
router.get("/:farmId", getFarm)
router.put("/:farmId", updateFarm)
router.patch("/:farmId", updateFarm)
router.delete("/:farmId", deleteFarm)

export default router
