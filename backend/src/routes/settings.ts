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

const router: IRouter = Router()

router.use(authMiddleware)

router.get("/team", listTeam)
router.post("/team", addTeamMember)
router.put("/team/:userId", updateTeamMember)
router.delete("/team/:userId", removeTeamMember)
router.get("/infrastructure", getInfrastructure)
router.post("/infrastructure", saveInfrastructure)

export default router
