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
import { authorizeRoles } from "../middleware/roleMiddleware"
import { checkPermission } from "../middleware/permissionMiddleware"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", checkPermission("farms", "read"), listFarms)
router.post("/", checkPermission("farms", "write"), createFarm)
router.get("/:farmId/sites", checkPermission("farms", "read"), getFarmSites)
router.get("/:farmId", checkPermission("farms", "read"), getFarm)
router.put("/:farmId", checkPermission("farms", "write"), updateFarm)
router.patch("/:farmId", checkPermission("farms", "write"), updateFarm)
router.delete("/:farmId", authorizeRoles("admin"), deleteFarm)

export default router
