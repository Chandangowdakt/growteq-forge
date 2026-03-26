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
import { checkPermission } from "../middleware/permissionMiddleware"

const router: IRouter = Router()

router.use(authMiddleware)

// Readable by any authenticated user (evaluations, cost engine, etc.)
router.get("/infrastructure", getInfrastructure)

router.post("/infrastructure", checkPermission("settings", "write"), saveInfrastructure)

router.get("/team", checkPermission("settings", "read"), listTeam)
router.post("/team", checkPermission("settings", "write"), addTeamMember)
router.put("/team/:userId", checkPermission("settings", "write"), updateTeamMember)
router.delete("/team/:userId", checkPermission("settings", "write"), removeTeamMember)

export default router
