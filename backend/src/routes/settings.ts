import { Router, type IRouter } from "express"
import {
  listTeam,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
  getInfrastructure,
  saveInfrastructure,
} from "../controllers/settingsController"
import { authMiddleware } from "../middleware/auth"
import { requireRole } from "../middleware/roleMiddleware"

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/team", listTeam)
router.post("/team", addTeamMember)
router.put("/team/:userId", requireRole("admin"), updateTeamMember)
router.delete("/team/:userId", requireRole("admin"), removeTeamMember)
router.get("/infrastructure", getInfrastructure)
router.post("/infrastructure", requireRole("admin"), saveInfrastructure)

export default router
