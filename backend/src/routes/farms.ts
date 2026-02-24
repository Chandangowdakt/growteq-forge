import { Router, type IRouter } from "express"
import {
  listFarms,
  createFarm,
  getFarm,
  updateFarm,
  deleteFarm,
} from "../controllers/farmController"
import { authMiddleware } from "../middleware/auth"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/", listFarms)
router.post("/", createFarm)
router.get("/:id", getFarm)
router.patch("/:id", updateFarm)
router.delete("/:id", deleteFarm)

export default router
